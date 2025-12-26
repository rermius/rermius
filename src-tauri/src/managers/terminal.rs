use crate::core::error::SessionError;
use crate::core::session::TerminalSession;
use crate::core::terminal_events::TerminalExitEvent;
use crate::pty::session::LocalPtySession;
use crate::ssh::terminal::SshTerminalSession;
use crate::ssh::config::{SshAuth, SshConfig, HostConfig};
use crate::ssh::error::SshError;
use crate::telnet::TelnetConfig;
use crate::terminal::factory::SessionFactory;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;

/// Terminal manager (Singleton Pattern via Tauri's .manage())
/// Manages all active terminal sessions
pub struct TerminalManager {
    sessions: Arc<RwLock<HashMap<String, Box<dyn TerminalSession>>>>,
}

impl TerminalManager {
    /// Create a new terminal manager
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new local terminal session
    pub async fn create_local_session(
        &self,
        shell: Option<String>,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let session = SessionFactory::local(shell, cols, rows, app_handle)
            .map_err(|e| e.to_string())?;
        let session_id = session.id().to_string();

        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.clone(), session);

        Ok(session_id)
    }

    /// Create a new SSH terminal session
    pub async fn create_ssh_session(
        &self,
        hostname: String,
        port: u16,
        username: String,
        auth_method: String,
        key_path: Option<String>,
        password: Option<String>,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        // Convert auth method string to SshAuth
        let auth = match auth_method.as_str() {
            "password" => {
                let pwd = password.ok_or_else(|| "Password required".to_string())?;
                SshAuth::Password(pwd)
            }
            "key" => {
                let path = key_path.ok_or_else(|| "Key path required".to_string())?;
                SshAuth::Key {
                    path,
                    passphrase: None,
                }
            }
            "agent" => SshAuth::Agent,
            _ => return Err(format!("Unknown auth method: {}", auth_method)),
        };

        let config = SshConfig {
            target: HostConfig {
                hostname,
                port,
                username,
                auth,
                connection_type: crate::ssh::config::ConnectionType::Ssh,
            },
            jumps: Vec::new(),
            terminal: crate::ssh::config::TerminalConfig { cols, rows },
        };

        let session = SessionFactory::create(
            crate::terminal::factory::SessionConfig::Ssh(config),
            app_handle,
        )
        .await
        .map_err(|e| e.to_string())?;

        let session_id = session.id().to_string();

        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.clone(), session);

        Ok(session_id)
    }

    /// Create a chained SSH session through jump hosts (ProxyJump)
    pub async fn create_chained_ssh_session(
        &self,
        chain: Vec<HostConfig>,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        if chain.is_empty() {
            return Err("Chain cannot be empty".to_string());
        }

        // Last element is target, rest are jumps
        let target = chain.last().unwrap().clone();
        let jumps = chain[..chain.len() - 1].to_vec();

        let config = SshConfig {
            target,
            jumps,
            terminal: crate::ssh::config::TerminalConfig { cols, rows },
        };

        let session = SessionFactory::create(
            crate::terminal::factory::SessionConfig::Ssh(config),
            app_handle,
        )
        .await
        .map_err(|e| e.to_string())?;

        let session_id = session.id().to_string();

        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.clone(), session);

        Ok(session_id)
    }

    /// Create a new Telnet terminal session
    pub async fn create_telnet_session(
        &self,
        hostname: String,
        port: u16,
        username: Option<String>,
        password: Option<String>,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let config = TelnetConfig {
            hostname,
            port,
            cols,
            rows,
            username,
            password,
        };

        let session = SessionFactory::create(
            crate::terminal::factory::SessionConfig::Telnet(config),
            app_handle,
        )
        .await
        .map_err(|e| e.to_string())?;

        let session_id = session.id().to_string();

        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.clone(), session);

        Ok(session_id)
    }

    /// Write data to a terminal session
    pub async fn write_to_session(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let sessions = self.sessions.read().await;

        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.write(data).await.map_err(|e| e.to_string())
    }

    /// Resize a terminal session
    pub async fn resize_session(
        &self,
        session_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        let sessions = self.sessions.read().await;

        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.resize(cols, rows).await.map_err(|e| e.to_string())
    }

    /// Start streaming for SSH session (call after FE listener is ready)
    pub async fn start_streaming(&self, session_id: &str) -> Result<(), String> {
        let sessions = self.sessions.read().await;

        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session.start_streaming();
        Ok(())
    }

    /// Ping a terminal session (keepalive check)
    /// Returns true if session exists and is responsive
    pub async fn ping_session(&self, session_id: &str) -> Result<bool, String> {
        let sessions = self.sessions.read().await;

        // Check if session exists
        if sessions.contains_key(session_id) {
            Ok(true) // Session exists and is responsive
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    /// Close a terminal session
    pub async fn close_session(&self, session_id: &str, app_handle: &AppHandle) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;

        if let Some(mut session) = sessions.remove(session_id) {
            log::info!("[TerminalManager] Closing terminal session: {}", session_id);

            // Emit exit event with user-closed reason before closing
            let exit_event = TerminalExitEvent::user_closed();
            let _ = app_handle.emit(&format!("terminal-exit:{}", session_id), exit_event);

            session.close().await.map_err(|e| e.to_string())?;
        } else {
            log::warn!("[TerminalManager] close_session: session not found: {}", session_id);
        }

        Ok(())
    }

    /// Execute a command on a terminal session and return output
    /// Works for SSH sessions; returns error for local PTY sessions
    pub async fn execute_command(&self, session_id: &str, command: &str) -> Result<String, String> {
        let sessions = self.sessions.read().await;

        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        session
            .execute_command(command)
            .await
            .map_err(|e| e.to_string())
    }

    /// Get number of active sessions
    #[allow(dead_code)]
    pub async fn session_count(&self) -> usize {
        let sessions = self.sessions.read().await;
        sessions.len()
    }

    /// Close all sessions
    #[allow(dead_code)]
    pub async fn close_all_sessions(&self) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;

        for (_, mut session) in sessions.drain() {
            session.close().await.ok(); // Ignore errors when closing
        }

        Ok(())
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}
