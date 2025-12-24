use crate::core::error::SessionError;
use crate::core::session::TerminalSession;
use crate::terminal::session::SessionType;
use async_trait::async_trait;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::{Read, Write};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use uuid::Uuid;

/// Local PTY terminal session
pub struct LocalPtySession {
    id: String,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pty_pair: Arc<Mutex<portable_pty::PtyPair>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
}

impl LocalPtySession {
    /// Create a new local PTY terminal session
    pub fn new(
        shell: Option<String>,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<Self, SessionError> {
        let id = Uuid::new_v4().to_string();

        // Get PTY system
        let pty_system = NativePtySystem::default();

        // Create PTY with specified size
        let pty_pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| SessionError::PtyError(format!("Failed to open PTY: {}", e)))?;

        // Determine shell to use
        let shell_path = shell.unwrap_or_else(|| crate::pty::shell::get_default_shell());

        // Create command
        let mut cmd = CommandBuilder::new(&shell_path);

        // Set environment variables
        cmd.env("TERM", "xterm-256color");

        // Spawn child process
        let child = pty_pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| SessionError::PtyError(format!("Failed to spawn shell: {}", e)))?;

        // Get reader and writer
        let reader = pty_pair
            .master
            .try_clone_reader()
            .map_err(|e| SessionError::PtyError(format!("Failed to clone reader: {}", e)))?;

        let writer = pty_pair
            .master
            .take_writer()
            .map_err(|e| SessionError::PtyError(format!("Failed to get writer: {}", e)))?;

        let pty_pair = Arc::new(Mutex::new(pty_pair));
        let child = Arc::new(Mutex::new(child));
        let writer = Arc::new(Mutex::new(writer));

        // Spawn background task to read PTY output and emit events
        let session_id = id.clone();
        let app_handle_clone = app_handle.clone();

        tokio::spawn(async move {
            let mut reader = reader;
            let mut buffer = [0u8; 8192];

            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        // EOF - process exited
                        use crate::core::terminal_events::TerminalExitEvent;
                        let exit_event = TerminalExitEvent::new(0, Some("process-exited".to_string()));
                        app_handle_clone
                            .emit(&format!("terminal-exit:{}", session_id), exit_event)
                            .ok();
                        break;
                    }
                    Ok(n) => {
                        // Got data from PTY
                        let data = String::from_utf8_lossy(&buffer[..n]).to_string();

                        // Emit output event
                        app_handle_clone
                            .emit(&format!("terminal-output:{}", session_id), data)
                            .ok();
                    }
                    Err(e) => {
                        // Read error
                        app_handle_clone
                            .emit(
                                &format!("terminal-error:{}", session_id),
                                format!("Read error: {}", e),
                            )
                            .ok();
                        break;
                    }
                }
            }
        });

        Ok(LocalPtySession {
            id,
            writer,
            pty_pair,
            child,
        })
    }
}

#[async_trait]
impl TerminalSession for LocalPtySession {
    fn id(&self) -> &str {
        &self.id
    }

    fn session_type(&self) -> SessionType {
        SessionType::Local
    }

    async fn write(&self, data: &[u8]) -> Result<(), SessionError> {
        let mut writer = self.writer.lock().await;
        writer
            .write_all(data)
            .map_err(|e| SessionError::IoError(e))?;

        writer
            .flush()
            .map_err(|e| SessionError::IoError(e))?;

        Ok(())
    }

    async fn resize(&self, cols: u16, rows: u16) -> Result<(), SessionError> {
        let pty = self.pty_pair.lock().await;
        pty.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| SessionError::PtyError(format!("Failed to resize PTY: {}", e)))
    }

    async fn close(&mut self) -> Result<(), SessionError> {
        let mut child = self.child.lock().await;
        child.kill().map_err(|e| SessionError::PtyError(format!("Failed to kill process: {}", e)))
    }
}

