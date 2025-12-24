use crate::ssh::config::SshConfig;
use crate::ssh::terminal::SshTerminalSession;
use crate::core::error::SessionError;
use crate::core::session::TerminalSession;
use crate::pty::session::LocalPtySession;
use crate::terminal::session::SessionType;
use tauri::AppHandle;

/// Session configuration
pub enum SessionConfig {
    Local {
        shell: Option<String>,
        cols: u16,
        rows: u16,
    },
    Ssh(SshConfig),
}

/// Factory for creating terminal sessions (Factory Pattern)
pub struct SessionFactory;

impl SessionFactory {
    /// Create a session based on config type
    pub async fn create(
        config: SessionConfig,
        app_handle: AppHandle,
    ) -> Result<Box<dyn TerminalSession>, SessionError> {
        match config {
            SessionConfig::Local { shell, cols, rows } => {
                let session = LocalPtySession::new(shell, cols, rows, app_handle)?;
                Ok(Box::new(session))
            }
            SessionConfig::Ssh(ssh_config) => {
                let session = SshTerminalSession::connect(ssh_config, app_handle).await?;
                Ok(Box::new(session))
            }
        }
    }
    
    /// Convenience: create local session
    pub fn local(
        shell: Option<String>,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<Box<dyn TerminalSession>, SessionError> {
        let session = LocalPtySession::new(shell, cols, rows, app_handle)?;
        Ok(Box::new(session))
    }
}

