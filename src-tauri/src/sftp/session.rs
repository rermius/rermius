use async_trait::async_trait;
use russh::client::Handle;
use russh_sftp::client::SftpSession as RusshSftpSession;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use std::collections::HashMap;

use crate::core::error::ConnectionError;
use crate::core::session::{FileInfo, FileTransferSession};
use crate::ssh::client::SshClient;
use crate::ssh::config::ConnectionType;

/// SFTP session using russh-sftp
pub struct SftpSession {
    id: String,
    sftp: Arc<Mutex<RusshSftpSession>>,
    ssh_handle: Arc<Mutex<Handle<SshClient>>>,
    // Cache for uid/gid to username/groupname mapping
    uid_cache: Arc<Mutex<HashMap<u32, String>>>,
    gid_cache: Arc<Mutex<HashMap<u32, String>>>,
    /// Whether we've already mapped root/empty path to home for this session
    home_resolved_for_root: AtomicBool,
}

impl SftpSession {
    /// Create new SFTP session from existing SSH handle
    pub async fn new(
        id: String,
        ssh_handle: Handle<SshClient>,
    ) -> Result<Self, ConnectionError> {
        // Open SFTP channel
        let channel = ssh_handle
            .channel_open_session()
            .await
            .map_err(|e| ConnectionError::SftpError(format!("Failed to open channel: {}", e)))?;

        // Request SFTP subsystem
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| ConnectionError::SftpError(format!("Failed to request SFTP subsystem: {}", e)))?;

        // Create SFTP session
        let sftp = RusshSftpSession::new(channel.into_stream())
            .await
            .map_err(|e| ConnectionError::SftpError(format!("Failed to create SFTP session: {}", e)))?;

        Ok(Self {
            id,
            sftp: Arc::new(Mutex::new(sftp)),
            ssh_handle: Arc::new(Mutex::new(ssh_handle)),
            uid_cache: Arc::new(Mutex::new(HashMap::new())),
            gid_cache: Arc::new(Mutex::new(HashMap::new())),
            home_resolved_for_root: AtomicBool::new(false),
        })
    }

    /// Resolve uid to username using SSH command
    async fn resolve_uid(&self, uid: u32) -> Option<String> {
        // Check cache first
        {
            let cache = self.uid_cache.lock().await;
            if let Some(username) = cache.get(&uid) {
                return Some(username.clone());
            }
        }

        // Try to resolve using SSH command
        let handle = self.ssh_handle.lock().await;
        let mut channel = match handle.channel_open_session().await {
            Ok(ch) => ch,
            Err(_) => return None,
        };

        // Execute: getent passwd {uid} | cut -d: -f1
        let command = format!("getent passwd {} | cut -d: -f1", uid);
        
        match channel.exec(true, command.as_bytes()).await {
            Ok(_) => {
                // Read output
                let mut output = Vec::new();
                loop {
                    match channel.wait().await {
                        Some(russh::ChannelMsg::Data { data }) => {
                            output.extend_from_slice(&data);
                        }
                        Some(russh::ChannelMsg::Eof) => break,
                        Some(russh::ChannelMsg::ExitStatus { exit_status }) => {
                            if exit_status != 0 {
                                break;
                            }
                        }
                        None => break,
                        _ => {}
                    }
                }

                let username = String::from_utf8_lossy(&output).trim().to_string();
                if !username.is_empty() {
                    // Cache result (without uid in parentheses for cache key)
                    let mut cache = self.uid_cache.lock().await;
                    cache.insert(uid, username.clone());
                    return Some(format!("{} ({})", username, uid));
                }
            }
            Err(_) => {}
        }

        None
    }

    /// Resolve gid to groupname using SSH command
    async fn resolve_gid(&self, gid: u32) -> Option<String> {
        // Check cache first
        {
            let cache = self.gid_cache.lock().await;
            if let Some(groupname) = cache.get(&gid) {
                return Some(groupname.clone());
            }
        }

        // Try to resolve using SSH command
        let handle = self.ssh_handle.lock().await;
        let mut channel = match handle.channel_open_session().await {
            Ok(ch) => ch,
            Err(_) => return None,
        };

        // Execute: getent group {gid} | cut -d: -f1
        let command = format!("getent group {} | cut -d: -f1", gid);
        
        match channel.exec(true, command.as_bytes()).await {
            Ok(_) => {
                // Read output
                let mut output = Vec::new();
                loop {
                    match channel.wait().await {
                        Some(russh::ChannelMsg::Data { data }) => {
                            output.extend_from_slice(&data);
                        }
                        Some(russh::ChannelMsg::Eof) => break,
                        Some(russh::ChannelMsg::ExitStatus { exit_status }) => {
                            if exit_status != 0 {
                                break;
                            }
                        }
                        None => break,
                        _ => {}
                    }
                }

                let groupname = String::from_utf8_lossy(&output).trim().to_string();
                if !groupname.is_empty() {
                    // Cache result (without gid in parentheses for cache key)
                    let mut cache = self.gid_cache.lock().await;
                    cache.insert(gid, groupname.clone());
                    return Some(format!("{} ({})", groupname, gid));
                }
            }
            Err(_) => {}
        }

        None
    }

    /// Get home directory using SSH command
    async fn get_home_directory(&self) -> Option<String> {
        let handle = self.ssh_handle.lock().await;
        let mut channel = match handle.channel_open_session().await {
            Ok(ch) => ch,
            Err(_) => return None,
        };

        // Try: echo $HOME
        match channel.exec(true, b"echo $HOME").await {
            Ok(_) => {
                let mut output = Vec::new();
                loop {
                    match channel.wait().await {
                        Some(russh::ChannelMsg::Data { data }) => {
                            output.extend_from_slice(&data);
                        }
                        Some(russh::ChannelMsg::Eof) => break,
                        Some(russh::ChannelMsg::ExitStatus { exit_status }) => {
                            if exit_status != 0 {
                                break;
                            }
                        }
                        None => break,
                        _ => {}
                    }
                }

                let home = String::from_utf8_lossy(&output).trim().to_string();
                if !home.is_empty() {
                    return Some(home);
                }
            }
            Err(_) => {}
        }

        None
    }
}

#[async_trait]
impl FileTransferSession for SftpSession {
    fn id(&self) -> &str {
        &self.id
    }

    fn connection_type(&self) -> ConnectionType {
        ConnectionType::Sftp
    }

    async fn list_directory(&self, path: &str) -> Result<Vec<FileInfo>, ConnectionError> {
        // Normalize path: remove trailing slash except for root
        let normalized_path = if path == "/" {
            "/"
        } else {
            path.trim_end_matches('/')
        };
        
        let sftp = self.sftp.lock().await;
        
        // Resolve home directory for root path on first request only
        let is_root_like = normalized_path.is_empty() || normalized_path == "/";
        let use_home_for_root = is_root_like
            && !self.home_resolved_for_root.swap(true, Ordering::SeqCst);

        let target_path = if use_home_for_root {
            self.get_home_directory().await.unwrap_or_else(|| "/".to_string())
        } else {
            normalized_path.to_string()
        };
        
        // Read directory with simple fallback
        let (entries, actual_path) = match sftp.read_dir(&target_path).await {
            Ok(entries) => (entries, target_path),
            Err(e) => {
                // Fallback to root if target fails
                if target_path != "/" {
                    sftp.read_dir("/").await
                        .map(|entries| (entries, "/".to_string()))
                        .map_err(|_| ConnectionError::SftpError(format!(
                            "Failed to read directory {}: {}", target_path, e
                        )))?
                } else {
                    return Err(ConnectionError::SftpError(format!(
                        "Failed to read directory {}: {}", target_path, e
                    )));
                }
            }
        };

        let mut files: Vec<FileInfo> = entries
            .into_iter()
            .filter(|entry| entry.file_name() != "." && entry.file_name() != "..")
            .map(|entry| {
                let attrs = entry.metadata();
                let file_name = entry.file_name();
                let file_path = if actual_path == "/" {
                    format!("/{}", file_name)
                } else {
                    format!("{}/{}", actual_path.trim_end_matches('/'), file_name)
                };

                let owner = if let Some(uid) = attrs.uid {
                    // Try to resolve uid to username, fallback to uid string
                    // Note: We can't await in map closure, so resolve synchronously or use default
                    // For now, store uid and resolve later if needed
                    Some(uid.to_string())
                } else {
                    None
                };

                let group = if let Some(gid) = attrs.gid {
                    Some(gid.to_string())
                } else {
                    None
                };

                // Detect symlink from permissions: bit 0o120000 = symlink (S_IFLNK)
                let is_symlink = attrs.permissions
                    .map(|p| (p & 0o170000) == 0o120000)
                    .unwrap_or(false);

                FileInfo {
                    name: file_name.to_string(),
                    path: file_path,
                    size: attrs.size.unwrap_or(0),
                    is_directory: attrs.is_dir(),
                    is_symlink,
                    symlink_target: None, // Will be resolved below
                    permissions: attrs.permissions.map(|p| format!("{:o}", p)),
                    modified: attrs.mtime.map(|t| t.to_string()),
                    owner,
                    group,
                }
            })
            .collect();

        // Resolve symlink targets for symlinks
        for file in &mut files {
            if file.is_symlink {
                match sftp.read_link(&file.path).await {
                    Ok(target) => {
                        // read_link returns the target path as String
                        file.symlink_target = Some(target.clone());

                        // Stat the target to determine if it's a directory
                        // Use metadata (follows symlinks) to get the target type
                        match sftp.metadata(&target).await {
                            Ok(target_attrs) => {
                                file.is_directory = target_attrs.is_dir();
                            }
                            Err(_) => {
                                // Broken symlink - target doesn't exist, keep is_directory as false
                                log::debug!("[SFTP] Symlink target {} doesn't exist (broken symlink)", target);
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("[SFTP] Failed to read symlink target for {}: {}", file.path, e);
                    }
                }
            }
        }

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
        // Create local file first (before locking SFTP session)
        let mut local_file = tokio::fs::File::create(local_path)
            .await
            .map_err(|e| ConnectionError::IoError(format!("Failed to create local file: {}", e)))?;

        // Only lock SFTP session to get metadata and open remote file handle, then release lock
        let (mut remote_file, total_bytes) = {
            let mut sftp = self.sftp.lock().await;
            
            // Get remote file size for progress (best-effort)
            let total_bytes = match sftp.metadata(remote_path).await {
                Ok(attrs) => attrs.size.unwrap_or(0),
                Err(_) => 0,
            };

            let remote_file = sftp
                .open(remote_path)
                .await
                .map_err(|e| ConnectionError::SftpError(format!("Failed to open remote file: {}", e)))?;
            
            (remote_file, total_bytes)
        };
        // Lock is released here, allowing other transfers to proceed

        // Now transfer data without holding the lock
        let mut buffer = vec![0u8; 32768]; // 32KB buffer
        let mut transferred: u64 = 0;
        loop {
            let n = remote_file
                .read(&mut buffer)
                .await
                .map_err(|e| ConnectionError::SftpError(format!("Failed to read remote file: {}", e)))?;

            if n == 0 {
                break;
            }
            
            local_file
                .write_all(&buffer[..n])
                .await
                .map_err(|e| ConnectionError::IoError(format!("Failed to write local file: {}", e)))?;

            transferred += n as u64;
            if let Some(cb) = &progress {
                cb(transferred, total_bytes);
            }
        }

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
        // Get file metadata and open local file first (before locking SFTP session)
        let meta = tokio::fs::metadata(local_path)
            .await
            .map_err(|e| ConnectionError::IoError(format!("Failed to stat local file: {}", e)))?;
        let total_bytes = meta.len();

        let mut local_file = tokio::fs::File::open(local_path)
            .await
            .map_err(|e| ConnectionError::IoError(format!("Failed to open local file: {}", e)))?;

        // Only lock SFTP session to create remote file handle, then release lock
        let mut remote_file = {
            let sftp = self.sftp.lock().await;
            sftp.create(remote_path)
                .await
                .map_err(|e| ConnectionError::SftpError(format!("Failed to create remote file: {}", e)))?
        };
        // Lock is released here, allowing other transfers to proceed

        // Now transfer data without holding the lock
        let mut buffer = vec![0u8; 32768]; // 32KB buffer
        let mut transferred: u64 = 0;
        loop {
            let n = local_file
                .read(&mut buffer)
                .await
                .map_err(|e| ConnectionError::IoError(format!("Failed to read local file: {}", e)))?;

            if n == 0 {
                break;
            }
            
            remote_file
                .write_all(&buffer[..n])
                .await
                .map_err(|e| ConnectionError::SftpError(format!("Failed to write remote file: {}", e)))?;

            transferred += n as u64;
            if let Some(cb) = &progress {
                cb(transferred, total_bytes);
            }
        }

        Ok(())
    }

    async fn create_directory(&self, path: &str) -> Result<(), ConnectionError> {
        let sftp = self.sftp.lock().await;
        
        sftp.create_dir(path)
            .await
            .map_err(|e| ConnectionError::SftpError(format!("Failed to create directory: {}", e)))?;

        Ok(())
    }

    async fn delete(&self, path: &str, is_directory: bool) -> Result<(), ConnectionError> {
        let sftp = self.sftp.lock().await;
        
        if is_directory {
            sftp.remove_dir(path)
                .await
                .map_err(|e| ConnectionError::SftpError(format!("Failed to remove directory: {}", e)))?;
        } else {
            sftp.remove_file(path)
                .await
                .map_err(|e| ConnectionError::SftpError(format!("Failed to remove file: {}", e)))?;
        }

        Ok(())
    }

    async fn rename(&self, old_path: &str, new_path: &str) -> Result<(), ConnectionError> {
        use crate::core::normalize_remote_path;
        
        let normalized_old = normalize_remote_path(old_path);
        let normalized_new = normalize_remote_path(new_path);
        
        let sftp = self.sftp.lock().await;
        sftp.rename(&normalized_old, &normalized_new)
            .await
            .map_err(|e| {
                log::error!("[SFTP] Failed to rename {} to {}: {}", normalized_old, normalized_new, e);
                ConnectionError::SftpError(format!("Failed to rename: {}", e))
            })?;
        Ok(())
    }

    async fn chmod(&self, path: &str, mode: u32) -> Result<(), ConnectionError> {
        let sftp = self.sftp.lock().await;
        
        // Get current metadata first to preserve other attributes and file type bits
        let current_attrs = sftp
            .metadata(path)
            .await
            .map_err(|e| ConnectionError::SftpError(format!("Failed to get file metadata: {}", e)))?;
        
        // Extract current permissions (may include file type bits)
        let current_perms = current_attrs.permissions.unwrap_or(0);
        // Preserve file type bits (bits above 0o777) and combine with new permissions
        let file_type_bits = current_perms & !0o777; // Get all bits except permission bits
        let new_perms = file_type_bits | (mode & 0o777); // Combine file type with new permissions
        
        println!("[SFTP] chmod: path={}, current_permissions={:o} ({})", 
                 path, current_perms, current_perms);
        println!("[SFTP] chmod: file_type_bits={:o}, new_mode={:o} ({})", 
                 file_type_bits, mode, mode);
        println!("[SFTP] chmod: combined_permissions={:o} ({})", new_perms, new_perms);
        
        // Create new attributes with updated permissions, preserving other attributes
        let mut attrs = russh_sftp::protocol::FileAttributes::default();
        attrs.permissions = Some(new_perms);
        attrs.size = current_attrs.size;
        attrs.uid = current_attrs.uid;
        attrs.gid = current_attrs.gid;
        attrs.atime = current_attrs.atime;
        attrs.mtime = current_attrs.mtime;
        
        println!("[SFTP] chmod: setting metadata with permissions={:o} ({})", new_perms, new_perms);
        
        sftp.set_metadata(path, attrs)
            .await
            .map_err(|e| {
                let error_msg = format!("Failed to chmod: {}", e);
                println!("[SFTP] chmod error: {}", error_msg);
                ConnectionError::SftpError(error_msg)
            })?;

        // Verify the change by reading metadata again
        let verify_attrs = sftp
            .metadata(path)
            .await
            .map_err(|e| {
                println!("[SFTP] chmod: warning - failed to verify permissions: {}", e);
                // Don't fail the chmod if verification fails
            })
            .ok();
        
        if let Some(verify) = verify_attrs {
            let verify_perms = verify.permissions.unwrap_or(0);
            let verify_mode = verify_perms & 0o777; // Extract permission bits only
            println!("[SFTP] chmod: verified permissions after change: {:o} (full: {:o}, expected mode: {:o})", 
                     verify_mode, verify_perms, mode);
            if verify_mode != (mode & 0o777) {
                println!("[SFTP] chmod: WARNING - permissions mismatch! Expected {:o}, got {:o}", 
                         mode & 0o777, verify_mode);
            } else {
                println!("[SFTP] chmod: SUCCESS - permissions match!");
            }
        }
        
        println!("[SFTP] chmod: success for path={}, mode={:o}", path, mode);
        Ok(())
    }

    async fn stat(&self, path: &str) -> Result<FileInfo, ConnectionError> {
        let sftp = self.sftp.lock().await;

        let attrs = sftp
            .metadata(path)
            .await
            .map_err(|e| ConnectionError::SftpError(format!("Failed to stat file: {}", e)))?;

        let name = path.split('/').last().unwrap_or(path).to_string();

        // Resolve uid/gid to username/groupname
        let owner = if let Some(uid) = attrs.uid {
            match self.resolve_uid(uid).await {
                Some(resolved) => Some(resolved),
                None => Some(uid.to_string()), // Fallback to uid if resolve fails
            }
        } else {
            None
        };

        let group = if let Some(gid) = attrs.gid {
            match self.resolve_gid(gid).await {
                Some(resolved) => Some(resolved),
                None => Some(gid.to_string()), // Fallback to gid if resolve fails
            }
        } else {
            None
        };

        // Detect symlink from permissions
        let is_symlink = attrs.permissions
            .map(|p| (p & 0o170000) == 0o120000)
            .unwrap_or(false);

        // Get symlink target and determine target type
        let (symlink_target, target_is_directory) = if is_symlink {
            match sftp.read_link(path).await {
                Ok(target) => {
                    // Stat the target to determine if it's a directory
                    let is_dir = sftp.metadata(&target).await
                        .map(|a| a.is_dir())
                        .unwrap_or(false);
                    (Some(target), is_dir)
                }
                Err(_) => (None, false)
            }
        } else {
            (None, attrs.is_dir())
        };

        let is_directory = if is_symlink { target_is_directory } else { attrs.is_dir() };

        Ok(FileInfo {
            name,
            path: path.to_string(),
            size: attrs.size.unwrap_or(0),
            is_directory,
            is_symlink,
            symlink_target,
            permissions: attrs.permissions.map(|p| format!("{:o}", p)),
            modified: attrs.mtime.map(|t| t.to_string()),
            owner,
            group,
        })
    }

    async fn read_file(&self, path: &str) -> Result<Vec<u8>, ConnectionError> {
        let sftp = self.sftp.lock().await;
        
        let mut file = sftp
            .open(path)
            .await
            .map_err(|e| ConnectionError::SftpError(format!("Failed to open file: {}", e)))?;

        let mut content = Vec::new();
        file.read_to_end(&mut content)
            .await
            .map_err(|e| ConnectionError::SftpError(format!("Failed to read file: {}", e)))?;

        Ok(content)
    }

    async fn write_file(&self, path: &str, content: &[u8]) -> Result<(), ConnectionError> {
        let sftp = self.sftp.lock().await;
        
        let mut file = sftp
            .create(path)
            .await
            .map_err(|e| ConnectionError::SftpError(format!("Failed to create file: {}", e)))?;

        file.write_all(content)
            .await
            .map_err(|e| ConnectionError::SftpError(format!("Failed to write file: {}", e)))?;

        Ok(())
    }

    async fn close(&mut self) -> Result<(), ConnectionError> {
        // SFTP session will be closed when dropped
        // SSH handle will also be closed when dropped
        Ok(())
    }
}

