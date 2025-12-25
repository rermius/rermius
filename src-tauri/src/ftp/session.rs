use async_trait::async_trait;
use suppaftp::AsyncFtpStream;
use suppaftp::types::FileType;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;

use crate::core::error::ConnectionError;
use crate::core::session::{FileInfo, FileTransferSession};
use crate::ssh::config::ConnectionType;

/// FTP/FTPS session using suppaftp
pub struct FtpSession {
    id: String,
    ftp: Arc<Mutex<AsyncFtpStream>>,
    is_ftps: bool,
    home_directory: Option<String>, // Cache home directory after login
    /// Whether we've already mapped root/empty path to home for this session
    home_resolved_for_root: AtomicBool,
}

impl FtpSession {
    /// Create new FTP session
    pub async fn new(
        id: String,
        hostname: &str,
        port: u16,
        username: &str,
        password: &str,
        _use_tls: bool,
    ) -> Result<Self, ConnectionError> {
        let addr = format!("{}:{}", hostname, port);
        
        // Plain FTP connection (FTPS requires additional TLS setup)
        let mut ftp = AsyncFtpStream::connect(&addr)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to connect FTP: {}", e)))?;

        // Login
        ftp.login(username, password)
            .await
            .map_err(|e| ConnectionError::AuthenticationFailed(format!("FTP login failed: {}", e)))?;

        // Set binary mode
        ftp.transfer_type(FileType::Binary)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to set binary mode: {}", e)))?;

        // Get home directory (current directory after login is usually home)
        let home_directory = match ftp.pwd().await {
            Ok(home) => {
                log::info!("[FTP] Detected home directory after login: {}", home);
                Some(home)
            }
            Err(e) => {
                log::warn!("[FTP] Failed to get home directory after login: {}", e);
                None
            }
        };

        log::info!("FTP session {} connected to {}", id, addr);

        Ok(Self {
            id,
            ftp: Arc::new(Mutex::new(ftp)),
            is_ftps: _use_tls,
            home_directory,
            home_resolved_for_root: AtomicBool::new(false),
        })
    }
}

#[async_trait]
impl FileTransferSession for FtpSession {
    fn id(&self) -> &str {
        &self.id
    }

    fn connection_type(&self) -> ConnectionType {
        if self.is_ftps {
            ConnectionType::Ftps
        } else {
            ConnectionType::Ftp
        }
    }

    async fn list_directory(&self, path: &str) -> Result<Vec<FileInfo>, ConnectionError> {
        let mut ftp = self.ftp.lock().await;
        
        // Normalize path: remove trailing slash except for root
        let normalized_path = if path == "/" {
            "/"
        } else {
            path.trim_end_matches('/')
        };
        
        // Resolve home directory for root path on first request only
        let is_root_like = normalized_path.is_empty() || normalized_path == "/";
        let use_home_for_root =
            is_root_like && !self.home_resolved_for_root.swap(true, Ordering::SeqCst);

        let target_path = if use_home_for_root {
            if let Some(ref home) = self.home_directory {
                home.clone()
            } else {
                // Fallback: ask server for current directory, or use root on error
                match ftp.pwd().await {
                    Ok(pwd) => pwd,
                    Err(_) => "/".to_string(),
                }
            }
        } else {
            normalized_path.to_string()
        };
        
        // Change to target directory
        let actual_path = match ftp.cwd(&target_path).await {
            Ok(_) => target_path,
            Err(_e) => {
                // Fallback to current directory if target doesn't exist
                ftp.pwd().await.unwrap_or_else(|_| {
                    log::warn!("[FTP] Failed to access {} and PWD failed, using root", target_path);
                    "/".to_string()
                })
            }
        };

        // List files
        let entries = ftp
            .list(None)
            .await
            .map_err(|e| {
                log::error!("[FTP] Failed to list directory {}: {}", actual_path, e);
                ConnectionError::FtpError(format!("Failed to list directory: {}", e))
            })?;

        // Use actual_path for building file paths
        let base_path = if actual_path.is_empty() { "/" } else { &actual_path };
        
        let files: Vec<FileInfo> = entries
            .into_iter()
            .filter_map(|line| parse_ftp_list_line(&line, base_path))
            .collect();

        Ok(files)
    }

    async fn download_file(&self, remote_path: &str, local_path: &str) -> Result<(), ConnectionError> {
        self.download_file_with_progress(remote_path, local_path, None).await
    }

    async fn download_file_with_progress(
        &self,
        remote_path: &str,
        local_path: &str,
        progress: Option<Arc<dyn Fn(u64, u64) + Send + Sync>>,
    ) -> Result<(), ConnectionError> {
        let mut ftp = self.ftp.lock().await;
        
        // Try to get remote file size (best-effort)
        let total_bytes = match ftp.size(remote_path).await {
            Ok(len) => len as u64,
            Err(_) => 0,
        };
        
        let mut reader = ftp
            .retr_as_stream(remote_path)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to download file: {}", e)))?;

        use futures_lite::io::AsyncReadExt;
        use tokio::io::AsyncWriteExt as TokioAsyncWriteExt;

        let mut file = tokio::fs::File::create(local_path)
            .await
            .map_err(|e| ConnectionError::IoError(format!("Failed to create local file: {}", e)))?;

        let mut buf = vec![0u8; 32768];
        let mut transferred: u64 = 0;
        loop {
            let n = reader
                .read(&mut buf)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to read stream: {}", e)))?;
            if n == 0 {
                break;
            }

            file.write_all(&buf[..n])
                .await
                .map_err(|e| ConnectionError::IoError(format!("Failed to write local file: {}", e)))?;

            transferred += n as u64;
            if let Some(cb) = &progress {
                cb(transferred, total_bytes);
            }
        }

        ftp.finalize_retr_stream(reader)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to finalize transfer: {}", e)))?;

        Ok(())
    }

    async fn upload_file(&self, local_path: &str, remote_path: &str) -> Result<(), ConnectionError> {
        self.upload_file_with_progress(local_path, remote_path, None).await
    }

    async fn upload_file_with_progress(
        &self,
        local_path: &str,
        remote_path: &str,
        progress: Option<Arc<dyn Fn(u64, u64) + Send + Sync>>,
    ) -> Result<(), ConnectionError> {
        let mut ftp = self.ftp.lock().await;
        
        let file = tokio::fs::File::open(local_path)
            .await
            .map_err(|e| ConnectionError::IoError(format!("Failed to read local file: {}", e)))?;

        let meta = file.metadata()
            .await
            .map_err(|e| ConnectionError::IoError(format!("Failed to stat local file: {}", e)))?;
        let total_bytes = meta.len();

        use tokio::io::{AsyncReadExt, BufReader};

        // Read file in chunks and report progress
        let mut reader = BufReader::new(file);
        let mut buf = Vec::new();
        let mut transferred: u64 = 0;
        let chunk_size = 64 * 1024; // 64KB chunks for progress reporting
        let mut read_buf = vec![0u8; chunk_size];
        
        loop {
            let n = reader.read(&mut read_buf).await
                .map_err(|e| ConnectionError::IoError(format!("Failed to read local file: {}", e)))?;
            
            if n == 0 {
                break;
            }
            
            buf.extend_from_slice(&read_buf[..n]);
            transferred += n as u64;
            
            // Report progress during read phase
            if let Some(cb) = &progress {
                // Report progress as if we're uploading (even though we're still reading)
                // This gives better UX than waiting until the end
                cb(transferred, total_bytes);
            }
        }

        // Upload in one shot
        ftp.put_file(remote_path, &mut buf.as_slice())
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to upload file: {}", e)))?;

        // Final progress update
        if let Some(cb) = &progress {
            cb(total_bytes, total_bytes);
        }

        Ok(())
    }

    async fn create_directory(&self, path: &str) -> Result<(), ConnectionError> {
        let mut ftp = self.ftp.lock().await;
        
        ftp.mkdir(path)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to create directory: {}", e)))?;

        Ok(())
    }

    async fn delete(&self, path: &str, is_directory: bool) -> Result<(), ConnectionError> {
        // Use path exactly as provided - don't normalize or modify
        // The path should match exactly what was stored in FileInfo from LIST output
        log::info!("[FTP] Attempting to delete {}: path='{}'", 
            if is_directory { "directory" } else { "file" },
            path);
        
        let mut ftp = self.ftp.lock().await;
        
        let result = if is_directory {
            ftp.rmdir(path).await
        } else {
            ftp.rm(path).await
        };
        
        match result {
            Ok(()) => {
                log::info!("[FTP] Successfully deleted {}: {}", 
                    if is_directory { "directory" } else { "file" },
                    path);
                Ok(())
            },
            Err(e) => {
                let error_msg = e.to_string();
                log::error!("[FTP] Failed to delete {} {}: {}", 
                    if is_directory { "directory" } else { "file" },
                    path,
                    error_msg);
                
                Err(ConnectionError::FtpError(format!(
                    "Failed to remove {} {}: {}", 
                    if is_directory { "directory" } else { "file" },
                    path, 
                    e
                )))
            }
        }
    }

    async fn rename(&self, old_path: &str, new_path: &str) -> Result<(), ConnectionError> {
        use crate::core::normalize_remote_path;
        
        let normalized_old = normalize_remote_path(old_path);
        let normalized_new = normalize_remote_path(new_path);
        
        let mut ftp = self.ftp.lock().await;
        ftp.rename(&normalized_old, &normalized_new)
            .await
            .map_err(|e| {
                log::error!("[FTP] Failed to rename {} to {}: {}", normalized_old, normalized_new, e);
                ConnectionError::FtpError(format!("Failed to rename {} to {}: {}", normalized_old, normalized_new, e))
            })?;
        Ok(())
    }

    async fn chmod(&self, _path: &str, _mode: u32) -> Result<(), ConnectionError> {
        // FTP does not support chmod
        Err(ConnectionError::FtpError("FTP does not support chmod".to_string()))
    }

    async fn stat(&self, path: &str) -> Result<FileInfo, ConnectionError> {
        let mut ftp = self.ftp.lock().await;
        
        // Get parent directory and file name
        let parts: Vec<&str> = path.rsplitn(2, '/').collect();
        let (name, dir) = if parts.len() == 2 {
            (parts[0], parts[1])
        } else {
            (path, "/")
        };

        // Change to directory and list
        ftp.cwd(dir)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to change directory: {}", e)))?;

        let entries = ftp
            .list(None)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to list directory: {}", e)))?;

        // Find the file in the list
        for line in entries {
            if let Some(file_info) = parse_ftp_list_line(&line, dir) {
                if file_info.name == name {
                    return Ok(file_info);
                }
            }
        }

        Err(ConnectionError::FtpError(format!("File not found: {}", path)))
    }

    async fn read_file(&self, path: &str) -> Result<Vec<u8>, ConnectionError> {
        let mut ftp = self.ftp.lock().await;
        
        let mut reader = ftp
            .retr_as_stream(path)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to read file: {}", e)))?;

        use futures_lite::io::AsyncReadExt;
        let mut content = Vec::new();
        reader.read_to_end(&mut content)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to read stream: {}", e)))?;

        ftp.finalize_retr_stream(reader)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to finalize transfer: {}", e)))?;

        Ok(content)
    }

    async fn write_file(&self, path: &str, content: &[u8]) -> Result<(), ConnectionError> {
        let mut ftp = self.ftp.lock().await;
        
        let mut reader: &[u8] = content;
        ftp.put_file(path, &mut reader)
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to write file: {}", e)))?;

        Ok(())
    }

    async fn close(&mut self) -> Result<(), ConnectionError> {
        let mut ftp = self.ftp.lock().await;
        
        ftp.quit()
            .await
            .map_err(|e| ConnectionError::FtpError(format!("Failed to close FTP connection: {}", e)))?;

        Ok(())
    }
}

/// Parse FTP LIST output line (Unix-style)
/// Format: "drwxr-xr-x 2 user group 4096 Jan 15 10:30 dirname"
/// or:     "drwxr-xr-x 2 user group 4096 Jan 15 2024 dirname"
fn parse_ftp_list_line(line: &str, base_path: &str) -> Option<FileInfo> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    
    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    
    // Need at least 9 parts for Unix-style LIST format
    // Format: permissions links owner group size month day time/year name
    if parts.len() < 9 {
        log::debug!("[FTP] LIST line has < 9 parts ({}): {}", parts.len(), trimmed);
        return None;
    }

    let permissions = parts[0];
    
    // Validate permissions format (should start with d, -, l, etc. and be 10 chars)
    // Example: "drwxr-xr-x", "-rw-r--r--", "lrwxrwxrwx"
    if permissions.len() < 10 {
        log::debug!("[FTP] Permissions too short ({} chars): {}", permissions.len(), permissions);
        return None;
    }
    
    let first_char = permissions.chars().next();
    if !matches!(first_char, Some('d' | '-' | 'l' | 'c' | 'b' | 'p' | 's')) {
        log::debug!("[FTP] Invalid permissions first char: {:?} in {}", first_char, permissions);
        return None;
    }
    
    let is_directory = permissions.starts_with('d');
    let is_symlink = permissions.starts_with('l');

    // Parse size (usually at index 4)
    let size: u64 = parts.get(4)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    // Name starts from index 8 onwards (may contain spaces)
    // IMPORTANT: Keep name exactly as returned by FTP server - don't normalize separators
    let raw_name = parts[8..].join(" ");

    // For symlinks, parse "name -> target" format
    let (name, symlink_target) = if is_symlink && raw_name.contains(" -> ") {
        let parts_split: Vec<&str> = raw_name.splitn(2, " -> ").collect();
        (parts_split[0].to_string(), Some(parts_split[1].to_string()))
    } else {
        (raw_name, None)
    };

    if name.is_empty() || name == "." || name == ".." {
        return None;
    }

    // Build file path - keep name exactly as is (preserve backslashes if present)
    // If name contains path separator, it's already a full path from server's perspective
    let file_path = if name.contains('\\') || name.contains('/') {
        // Name already contains path separator - use it as-is
        // If it starts with separator, it's absolute; otherwise prepend base_path
        if name.starts_with('/') || name.starts_with('\\') {
            name.clone()
        } else if base_path == "/" {
            format!("/{}", name)
        } else {
            format!("{}/{}", base_path.trim_end_matches('/'), name)
        }
    } else {
        // Simple filename without separator
        if base_path == "/" {
            format!("/{}", name)
        } else {
            format!("{}/{}", base_path.trim_end_matches('/'), name)
        }
    };
    
    // Parse date: parts[5] = month, parts[6] = day, parts[7] = year or time
    // Format: "Jan 15 10:30" or "Jan 15 2024"
    // Frontend will handle parsing this date string
    let modified = if parts.len() > 7 {
        Some(format!("{} {} {}", parts[5], parts[6], parts[7]))
    } else {
        None
    };
    
    // Extract owner (parts[2]) and group (parts[3]) from FTP LIST output
    let owner = parts.get(2).map(|s| s.to_string());
    let group = parts.get(3).map(|s| s.to_string());

    Some(FileInfo {
        name: name.clone(),
        path: file_path,
        size,
        is_directory,
        is_symlink,
        symlink_target,
        permissions: Some(permissions.to_string()),
        modified,
        owner,
        group,
    })
}

