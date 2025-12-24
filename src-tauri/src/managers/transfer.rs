use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};

use crate::core::error::ConnectionError;
use crate::core::session::{FileInfo, FileTransferSession};
use crate::sftp::session::SftpSession;
use crate::ftp::session::FtpSession;
use crate::ssh::client::{SshClient, connect_direct, authenticate};
use crate::ssh::config::{ConnectionType, HostConfig, SshAuth, HostConfigInput};
use crate::ssh::chain::HopHandler;
use tauri::{AppHandle, Emitter, Manager};

/// Configuration for creating a file transfer session
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSessionConfig {
    pub connection_type: String,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub key_path: Option<String>,
    /// Optional chain of jump hosts for SFTP connections (ProxyJump)
    #[serde(default)]
    pub jumps: Vec<HostConfigInput>,
}

/// File info for serialization to frontend
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfoDto {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_directory: bool,
    pub permissions: Option<String>,
    pub modified: Option<String>,
    pub owner: Option<String>,
    pub group: Option<String>,
}

impl From<FileInfo> for FileInfoDto {
    fn from(info: FileInfo) -> Self {
        Self {
            name: info.name,
            path: info.path,
            size: info.size,
            is_directory: info.is_directory,
            permissions: info.permissions,
            modified: info.modified,
            owner: info.owner,
            group: info.group,
        }
    }
}

/// Manager for file transfer sessions
pub struct FileTransferManager {
    sessions: Arc<Mutex<HashMap<String, Arc<dyn FileTransferSession>>>>,
}

impl Default for FileTransferManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Progress event payload
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransferProgressEvent {
    pub transfer_id: String, // Unique ID from frontend
    pub session_id: String,
    pub direction: String, // "upload" | "download"
    pub local_path: String,
    pub remote_path: String,
    pub file_name: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub done: bool,
}

impl FileTransferManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a new file transfer session
    pub async fn create_session(&self, config: FileSessionConfig, app_handle: AppHandle) -> Result<String, ConnectionError> {
        let session_id = uuid::Uuid::new_v4().to_string();
        
        let session: Arc<dyn FileTransferSession> = match config.connection_type.as_str() {
            "sftp" => {
                // Create SSH connection first
                let target_config = HostConfig {
                    hostname: config.hostname.clone(),
                    port: config.port,
                    username: config.username.clone(),
                    auth: if let Some(key_path) = config.key_path {
                        SshAuth::Key { path: key_path, passphrase: None }
                    } else if let Some(password) = config.password.clone() {
                        SshAuth::Password(password)
                    } else {
                        return Err(ConnectionError::AuthenticationFailed("No auth method provided".to_string()));
                    },
                    connection_type: ConnectionType::Sftp,
                };

                // Check if we need to use chain connection
                let ssh_handle = if config.jumps.is_empty() {
                    // Direct connection
                    log::info!("SFTP direct connection to {}", target_config.hostname);
                    let mut handle = connect_direct(&target_config).await
                        .map_err(|e| ConnectionError::ConnectionFailed(e.to_string()))?;
                    
                    authenticate(&mut handle, &target_config).await
                        .map_err(|e| ConnectionError::AuthenticationFailed(e.to_string()))?;
                    
                    handle
                } else {
                    // Chain connection via jump hosts
                    log::info!("SFTP chain connection through {} jumps", config.jumps.len());
                    
                    // Convert frontend input to internal HostConfig
                    let jumps: Vec<HostConfig> = config.jumps
                        .into_iter()
                        .map(|h| h.into_host_config())
                        .collect::<Result<Vec<_>, _>>()
                        .map_err(|e| ConnectionError::ConnectionFailed(format!("Invalid jump host config: {}", e)))?;
                    
                    // Create chain handler and execute
                    let chain = HopHandler::from_config(&jumps, &target_config);
                    chain.execute(None, &app_handle).await
                        .map_err(|e| ConnectionError::ConnectionFailed(format!("Chain connection failed: {}", e)))?
                };

                Arc::new(SftpSession::new(session_id.clone(), ssh_handle).await?)
            }
            "ftp" => {
                let password = config.password.unwrap_or_default();
                Arc::new(FtpSession::new(
                    session_id.clone(),
                    &config.hostname,
                    config.port,
                    &config.username,
                    &password,
                    false,
                ).await?)
            }
            "ftps" => {
                let password = config.password.unwrap_or_default();
                Arc::new(FtpSession::new(
                    session_id.clone(),
                    &config.hostname,
                    config.port,
                    &config.username,
                    &password,
                    true,
                ).await?)
            }
            other => {
                return Err(ConnectionError::UnsupportedType(other.to_string()));
            }
        };

        let mut sessions = self.sessions.lock().await;
        sessions.insert(session_id.clone(), session);
        
        log::info!("Created file transfer session: {} (total sessions: {})", session_id, sessions.len());
        Ok(session_id)
    }

    /// Helper: Get session Arc and release lock immediately
    async fn get_session_arc(&self, session_id: &str) -> Option<Arc<dyn FileTransferSession>> {
        let sessions = self.sessions.lock().await;
        sessions.get(session_id).cloned()
    }

    /// List directory contents
    pub async fn list_directory(&self, session_id: &str, path: &str) -> Result<Vec<FileInfoDto>, ConnectionError> {
        let session = self.get_session_arc(session_id).await
            .ok_or_else(|| ConnectionError::Unknown(format!("Session not found: {}", session_id)))?;
        
        let files = session.list_directory(path).await?;
        Ok(files.into_iter().map(FileInfoDto::from).collect())
    }

    fn emit_progress(app_handle: &AppHandle, event: &TransferProgressEvent) {
        if let Err(e) = app_handle.emit("file-transfer-progress", event) {
            log::error!("[FileTransfer] Failed to emit progress event: {}", e);
        }
    }

    /// Download file
    pub async fn download_file(
        &self,
        app_handle: &AppHandle,
        session_id: &str,
        remote_path: &str,
        local_path: &str,
        transfer_id: &str,
    ) -> Result<(), ConnectionError> {
        let session = self.get_session_arc(session_id).await
            .ok_or_else(|| ConnectionError::Unknown(format!("Session not found: {}", session_id)))?;

        let file_info = session.stat(remote_path).await?;
        let total_bytes = file_info.size;
        let file_name = file_info.name.clone();
        let file_name_for_final = file_name.clone();
        let file_name_for_cb = file_name.clone();
        
        log::info!("[FileTransfer] Starting download: {}", file_name);

        let session_id_str = session_id.to_string();
        let remote = remote_path.to_string();
        let local = local_path.to_string();
        let app = app_handle.clone();
        let total_bytes_captured = total_bytes;

        let transfer_id_str = transfer_id.to_string();
        let progress_cb = std::sync::Arc::new(move |bytes: u64, total: u64| {
            let event = TransferProgressEvent {
                transfer_id: transfer_id_str.clone(),
                session_id: session_id_str.clone(),
                direction: "download".to_string(),
                local_path: local.clone(),
                remote_path: remote.clone(),
                file_name: file_name_for_cb.clone(),
                bytes_transferred: bytes,
                total_bytes: if total > 0 { total } else { total_bytes_captured },
                done: false,
            };
            Self::emit_progress(&app, &event);
        });

        session
            .download_file_with_progress(remote_path, local_path, Some(progress_cb))
            .await?;

        let final_event = TransferProgressEvent {
            transfer_id: transfer_id.to_string(),
            session_id: session_id.to_string(),
            direction: "download".to_string(),
            local_path: local_path.to_string(),
            remote_path: remote_path.to_string(),
            file_name: file_name_for_final,
            bytes_transferred: total_bytes,
            total_bytes,
            done: true,
        };
        Self::emit_progress(app_handle, &final_event);
        log::info!("[FileTransfer] Download completed: {}", file_name);

        Ok(())
    }
    
    /// Upload file
    /// Generate unique filename by appending (N) if duplicate exists
    fn generate_unique_filename(base_name: &str, existing_files: &[FileInfo]) -> String {
        let existing_names: std::collections::HashSet<String> = existing_files
            .iter()
            .filter(|f| !f.is_directory)
            .map(|f| f.name.to_lowercase())
            .collect();
        
        let base_lower = base_name.to_lowercase();
        if !existing_names.contains(&base_lower) {
            return base_name.to_string();
        }
        
        // Extract name and extension
        let (name_without_ext, ext) = if let Some(dot_pos) = base_name.rfind('.') {
            (&base_name[..dot_pos], &base_name[dot_pos..])
        } else {
            (base_name, "")
        };
        
        // Find unique name by appending (N)
        let mut counter = 1;
        loop {
            let new_name = format!("{}{} ({}){}", name_without_ext, "", counter, ext);
            if !existing_names.contains(&new_name.to_lowercase()) {
                return new_name;
            }
            counter += 1;
            if counter > 1000 {
                // Fallback: use timestamp
                return format!("{}_{}{}", name_without_ext, std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(), ext);
            }
        }
    }

    pub async fn upload_file(
        &self,
        app_handle: &AppHandle,
        session_id: &str,
        local_path: &str,
        remote_path: &str,
        transfer_id: &str,
    ) -> Result<(), ConnectionError> {
        let session = self.get_session_arc(session_id).await
            .ok_or_else(|| ConnectionError::Unknown(format!("Session not found: {}", session_id)))?;

        let meta = tokio::fs::metadata(local_path)
            .await
            .map_err(|e| ConnectionError::IoError(format!("Failed to stat local file: {}", e)))?;
        let total_bytes = meta.len();
        let original_file_name = std::path::Path::new(remote_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(remote_path)
            .to_string();
        
        // Check for duplicates and generate unique filename
        let remote_dir = std::path::Path::new(remote_path)
            .parent()
            .and_then(|p| p.to_str())
            .unwrap_or("/");
        
        let existing_files = session.list_directory(remote_dir).await.unwrap_or_default();
        let unique_file_name = Self::generate_unique_filename(&original_file_name, &existing_files);
        
        // Build final remote path with unique filename
        // Normalize path to use forward slashes (Unix-style) for remote paths
        use crate::core::normalize_remote_path;
        let final_remote_path = if unique_file_name != original_file_name {
            let joined = if remote_dir == "/" {
                format!("/{}", unique_file_name)
            } else {
                format!("{}/{}", remote_dir.trim_end_matches('/'), unique_file_name)
            };
            normalize_remote_path(&joined)
        } else {
            normalize_remote_path(remote_path)
        };
        
        let file_name_for_final = unique_file_name.clone();
        let file_name_for_cb = unique_file_name.clone();
        
        if final_remote_path != remote_path {
            log::info!("[FileTransfer] Renamed due to duplicate: {} -> {}", original_file_name, file_name_for_final.clone());
        }
        log::info!("[FileTransfer] Starting upload: {}", file_name_for_final.clone());

        let session_id_str = session_id.to_string();
        let remote = final_remote_path.clone();
        let local = local_path.to_string();
        let app = app_handle.clone();
        let total_bytes_captured = total_bytes;

        let transfer_id_str = transfer_id.to_string();
        let progress_cb = std::sync::Arc::new(move |bytes: u64, total: u64| {
            let event = TransferProgressEvent {
                transfer_id: transfer_id_str.clone(),
                session_id: session_id_str.clone(),
                direction: "upload".to_string(),
                local_path: local.clone(),
                remote_path: remote.clone(),
                file_name: file_name_for_cb.clone(),
                bytes_transferred: bytes,
                total_bytes: if total > 0 { total } else { total_bytes_captured },
                done: false,
            };
            Self::emit_progress(&app, &event);
        });

        session
            .upload_file_with_progress(local_path, &final_remote_path, Some(progress_cb))
            .await?;

        let final_event = TransferProgressEvent {
            transfer_id: transfer_id.to_string(),
            session_id: session_id.to_string(),
            direction: "upload".to_string(),
            local_path: local_path.to_string(),
            remote_path: final_remote_path.clone(),
            file_name: file_name_for_final.clone(),
            bytes_transferred: total_bytes,
            total_bytes,
            done: true,
        };
        Self::emit_progress(app_handle, &final_event);
        log::info!("[FileTransfer] Upload completed: {}", file_name_for_final);

        Ok(())
    }

    /// Create directory
    pub async fn create_directory(&self, session_id: &str, path: &str) -> Result<(), ConnectionError> {
        let session = self.get_session_arc(session_id).await
            .ok_or_else(|| ConnectionError::Unknown(format!("Session not found: {}", session_id)))?;
        session.create_directory(path).await
    }

    /// Delete file or directory
    pub async fn delete(&self, session_id: &str, path: &str, is_directory: bool) -> Result<(), ConnectionError> {
        let session = self.get_session_arc(session_id).await
            .ok_or_else(|| ConnectionError::Unknown(format!("Session not found: {}", session_id)))?;
        session.delete(path, is_directory).await
    }

    /// Rename file or directory
    pub async fn rename(&self, session_id: &str, old_path: &str, new_path: &str) -> Result<(), ConnectionError> {
        let session = self.get_session_arc(session_id).await
            .ok_or_else(|| ConnectionError::Unknown(format!("Session not found: {}", session_id)))?;
        session.rename(old_path, new_path).await
    }

    /// Change file permissions (SFTP only)
    pub async fn chmod(&self, session_id: &str, path: &str, mode: u32) -> Result<(), ConnectionError> {
        let session = self.get_session_arc(session_id).await
            .ok_or_else(|| ConnectionError::Unknown(format!("Session not found: {}", session_id)))?;
        session.chmod(path, mode).await
    }

    /// Get file info/metadata
    pub async fn stat(&self, session_id: &str, path: &str) -> Result<FileInfoDto, ConnectionError> {
        let session = self.get_session_arc(session_id).await
            .ok_or_else(|| ConnectionError::Unknown(format!("Session not found: {}", session_id)))?;
        let file_info = session.stat(path).await?;
        Ok(FileInfoDto::from(file_info))
    }

    /// Read file content (for small files)
    pub async fn read_file(&self, session_id: &str, path: &str) -> Result<Vec<u8>, ConnectionError> {
        let session = self.get_session_arc(session_id).await
            .ok_or_else(|| ConnectionError::Unknown(format!("Session not found: {}", session_id)))?;
        session.read_file(path).await
    }

    /// Write file content
    pub async fn write_file(&self, session_id: &str, path: &str, content: &[u8]) -> Result<(), ConnectionError> {
        let session = self.get_session_arc(session_id).await
            .ok_or_else(|| ConnectionError::Unknown(format!("Session not found: {}", session_id)))?;
        session.write_file(path, content).await
    }

    /// Close session
    /// Session will be dropped when removed from HashMap
    pub async fn close_session(&self, session_id: &str) -> Result<(), ConnectionError> {
        let mut sessions = self.sessions.lock().await;
        if sessions.remove(session_id).is_some() {
            log::info!("[FileTransfer] Closed file session: {}", session_id);
        } else {
            log::warn!("[FileTransfer] close_session: session not found: {}", session_id);
        }
        Ok(())
    }
}

