use async_trait::async_trait;
use std::sync::Arc;
use crate::core::error::{SessionError, ConnectionError};
use crate::ssh::config::ConnectionType;
use crate::terminal::session::SessionType;

/// Terminal session trait (Strategy Pattern)
/// Implemented by PTY and SSH terminal sessions
#[async_trait]
pub trait TerminalSession: Send + Sync {
    fn id(&self) -> &str;
    fn session_type(&self) -> SessionType;

    async fn write(&self, data: &[u8]) -> Result<(), SessionError>;
    async fn resize(&self, cols: u16, rows: u16) -> Result<(), SessionError>;
    async fn close(&mut self) -> Result<(), SessionError>;

    /// Start streaming output to frontend (for SSH sessions)
    /// Default implementation does nothing (local sessions auto-stream)
    fn start_streaming(&self) {}

    /// Execute a command and return output (SSH sessions only)
    /// Default implementation returns error (not supported for local PTY)
    async fn execute_command(&self, _command: &str) -> Result<String, SessionError> {
        Err(SessionError::UnsupportedOperation(
            "Command execution not supported for this session type".to_string()
        ))
    }
}

/// File information for directory listings
#[derive(Debug, Clone)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub permissions: Option<String>,
    pub modified: Option<String>,
    pub owner: Option<String>,
    pub group: Option<String>,
}

/// File transfer session trait
/// Implemented by SFTP, FTP, FTPS connections
#[async_trait]
pub trait FileTransferSession: Send + Sync {
    /// Get unique session ID
    fn id(&self) -> &str;
    
    /// Get connection type
    fn connection_type(&self) -> ConnectionType;
    
    /// List directory contents
    async fn list_directory(&self, path: &str) -> Result<Vec<FileInfo>, ConnectionError>;
    
    /// Download file from remote to local
    async fn download_file(&self, remote_path: &str, local_path: &str) -> Result<(), ConnectionError>;
    
    /// Upload file from local to remote
    async fn upload_file(&self, local_path: &str, remote_path: &str) -> Result<(), ConnectionError>;

    /// Download file with optional progress callback (bytes_transferred, total_bytes)
    /// Default implementation falls back to download_file without progress.
    async fn download_file_with_progress(
        &self,
        remote_path: &str,
        local_path: &str,
        _progress: Option<Arc<dyn Fn(u64, u64) + Send + Sync>>,
    ) -> Result<(), ConnectionError> {
        self.download_file(remote_path, local_path).await
    }
    
    /// Upload file with optional progress callback (bytes_transferred, total_bytes)
    /// Default implementation falls back to upload_file without progress.
    async fn upload_file_with_progress(
        &self,
        local_path: &str,
        remote_path: &str,
        _progress: Option<Arc<dyn Fn(u64, u64) + Send + Sync>>,
    ) -> Result<(), ConnectionError> {
        self.upload_file(local_path, remote_path).await
    }
    
    /// Create directory on remote
    async fn create_directory(&self, path: &str) -> Result<(), ConnectionError>;
    
    /// Delete file or directory on remote
    async fn delete(&self, path: &str, is_directory: bool) -> Result<(), ConnectionError>;
    
    /// Rename/move file or directory
    async fn rename(&self, old_path: &str, new_path: &str) -> Result<(), ConnectionError>;
    
    /// Change file permissions (SFTP only, returns error for FTP)
    async fn chmod(&self, path: &str, mode: u32) -> Result<(), ConnectionError>;
    
    /// Get file info/metadata
    async fn stat(&self, path: &str) -> Result<FileInfo, ConnectionError>;
    
    /// Read file content (for small files)
    async fn read_file(&self, path: &str) -> Result<Vec<u8>, ConnectionError>;
    
    /// Write file content
    async fn write_file(&self, path: &str, content: &[u8]) -> Result<(), ConnectionError>;
    
    /// Close the connection
    async fn close(&mut self) -> Result<(), ConnectionError>;
}

