//! Telnet Terminal Session
//!
//! Implements the TerminalSession trait for Telnet connections,
//! following the same architecture as SSH sessions.

use async_trait::async_trait;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;

use crate::core::error::SessionError;
use crate::core::session::TerminalSession;
use crate::core::terminal_events::TerminalExitEvent;
use crate::terminal::session::SessionType;

use super::client;
use super::config::TelnetConfig;
use super::error::TelnetError;
use super::login::AutoLogin;
use super::protocol::{build_naws, TelnetProtocol};

/// Telnet terminal session implementing TerminalSession trait
pub struct TelnetTerminalSession {
    /// Unique session ID
    id: String,
    /// Channel to send data to the I/O loop
    write_tx: mpsc::UnboundedSender<Vec<u8>>,
    /// Channel to send resize commands
    resize_tx: mpsc::UnboundedSender<(u16, u16)>,
    /// Flag indicating if streaming has started
    streaming_started: Arc<AtomicBool>,
}

impl TelnetTerminalSession {
    /// Connect to a telnet server and create a new session
    pub async fn connect(config: TelnetConfig, app_handle: AppHandle) -> Result<Self, TelnetError> {
        let id = Uuid::new_v4().to_string();

        log::info!(
            "TELNET[{}] Connecting to {}:{}",
            id,
            config.hostname,
            config.port
        );

        // Establish TCP connection
        let stream = client::connect(&config).await?;

        // Create channels for write and resize commands
        let (write_tx, write_rx) = mpsc::unbounded_channel::<Vec<u8>>();
        let (resize_tx, resize_rx) = mpsc::unbounded_channel::<(u16, u16)>();

        let streaming_started = Arc::new(AtomicBool::new(false));

        // Clone values for the I/O loop
        let session_id = id.clone();
        let streaming_flag = streaming_started.clone();
        let initial_cols = config.cols;
        let initial_rows = config.rows;

        // Create auto-login handler
        let auto_login = AutoLogin::new(config.username.clone(), config.password.clone());

        // Spawn the I/O loop
        tokio::spawn(async move {
            Self::io_loop(
                stream,
                write_rx,
                resize_rx,
                session_id,
                app_handle,
                streaming_flag,
                initial_cols,
                initial_rows,
                auto_login,
            )
            .await;
        });

        Ok(Self {
            id,
            write_tx,
            resize_tx,
            streaming_started,
        })
    }

    /// Main I/O loop handling read/write operations
    async fn io_loop(
        stream: TcpStream,
        mut write_rx: mpsc::UnboundedReceiver<Vec<u8>>,
        mut resize_rx: mpsc::UnboundedReceiver<(u16, u16)>,
        session_id: String,
        app_handle: AppHandle,
        streaming_started: Arc<AtomicBool>,
        initial_cols: u16,
        initial_rows: u16,
        auto_login: AutoLogin,
    ) {
        let (mut reader, mut writer) = stream.into_split();
        let mut buffer = [0u8; 8192];
        let mut pending_buffer: Vec<String> = Vec::new();
        let mut protocol = TelnetProtocol::new();
        let auto_login = Arc::new(Mutex::new(auto_login));

        // Track current terminal size
        let mut current_cols = initial_cols;
        let mut current_rows = initial_rows;

        log::debug!("TELNET[{}] I/O loop started", session_id);

        loop {
            tokio::select! {
                // Handle writes from frontend (user input)
                Some(data) = write_rx.recv() => {
                    if let Err(e) = writer.write_all(&data).await {
                        log::warn!("TELNET[{}] Write error: {:?}", session_id, e);
                        break;
                    }
                    if let Err(e) = writer.flush().await {
                        log::warn!("TELNET[{}] Flush error: {:?}", session_id, e);
                        break;
                    }
                }

                // Handle resize requests
                Some((cols, rows)) = resize_rx.recv() => {
                    current_cols = cols;
                    current_rows = rows;

                    // If NAWS is enabled, send window size update
                    if protocol.naws_enabled {
                        let naws_data = build_naws(cols, rows);
                        if let Err(e) = writer.write_all(&naws_data).await {
                            log::warn!("TELNET[{}] NAWS send error: {:?}", session_id, e);
                        } else {
                            log::debug!("TELNET[{}] Sent NAWS: {}x{}", session_id, cols, rows);
                        }
                    }
                }

                // Read from socket
                result = reader.read(&mut buffer) => {
                    match result {
                        Ok(0) => {
                            // Connection closed by remote
                            log::info!("TELNET[{}] Connection closed by remote", session_id);
                            let exit_event = TerminalExitEvent::connection_lost();
                            let _ = app_handle.emit(&format!("terminal-exit:{}", session_id), exit_event);
                            break;
                        }
                        Ok(n) => {
                            // Process telnet protocol data
                            let (responses, clean_data, naws_requested) = protocol.process_data(&buffer[..n]);

                            // Send protocol responses
                            if !responses.is_empty() {
                                if let Err(e) = writer.write_all(&responses).await {
                                    log::warn!("TELNET[{}] Protocol response error: {:?}", session_id, e);
                                }
                            }

                            // If NAWS was just negotiated, send initial window size
                            if naws_requested {
                                let naws_data = build_naws(current_cols, current_rows);
                                if let Err(e) = writer.write_all(&naws_data).await {
                                    log::warn!("TELNET[{}] Initial NAWS error: {:?}", session_id, e);
                                } else {
                                    log::debug!("TELNET[{}] Sent initial NAWS: {}x{}", session_id, current_cols, current_rows);
                                }
                            }

                            // Convert clean data to string
                            if !clean_data.is_empty() {
                                let output = String::from_utf8_lossy(&clean_data).to_string();

                                // Check for auto-login prompts
                                {
                                    let mut login = auto_login.lock().await;
                                    if let Some(response) = login.process(&output) {
                                        log::debug!("TELNET[{}] Auto-login: sending credentials", session_id);
                                        if let Err(e) = writer.write_all(&response).await {
                                            log::warn!("TELNET[{}] Auto-login send error: {:?}", session_id, e);
                                        }
                                    }
                                }

                                // Emit to frontend
                                if streaming_started.load(Ordering::SeqCst) {
                                    // Flush any pending buffer first
                                    if !pending_buffer.is_empty() {
                                        let buffered = pending_buffer.join("");
                                        pending_buffer.clear();
                                        let _ = app_handle.emit(
                                            &format!("terminal-output:{}", session_id),
                                            buffered
                                        );
                                    }
                                    // Emit current data
                                    let _ = app_handle.emit(
                                        &format!("terminal-output:{}", session_id),
                                        output
                                    );
                                } else {
                                    // Buffer until streaming starts
                                    pending_buffer.push(output);
                                }
                            }
                        }
                        Err(e) => {
                            log::warn!("TELNET[{}] Read error: {:?}", session_id, e);
                            let exit_event = TerminalExitEvent::connection_error(e.to_string());
                            let _ = app_handle.emit(&format!("terminal-exit:{}", session_id), exit_event);
                            break;
                        }
                    }
                }
            }
        }

        log::debug!("TELNET[{}] I/O loop ended", session_id);
    }
}

#[async_trait]
impl TerminalSession for TelnetTerminalSession {
    fn id(&self) -> &str {
        &self.id
    }

    fn session_type(&self) -> SessionType {
        SessionType::Telnet
    }

    async fn write(&self, data: &[u8]) -> Result<(), SessionError> {
        self.write_tx
            .send(data.to_vec())
            .map_err(|e| SessionError::IoError(std::io::Error::new(
                std::io::ErrorKind::BrokenPipe,
                format!("Channel closed: {}", e),
            )))?;
        Ok(())
    }

    async fn resize(&self, cols: u16, rows: u16) -> Result<(), SessionError> {
        self.resize_tx
            .send((cols, rows))
            .map_err(|e| SessionError::IoError(std::io::Error::new(
                std::io::ErrorKind::BrokenPipe,
                format!("Channel closed: {}", e),
            )))?;
        Ok(())
    }

    async fn close(&mut self) -> Result<(), SessionError> {
        // Dropping the senders will cause the I/O loop to exit
        log::info!("TELNET[{}] Session closed", self.id);
        Ok(())
    }

    fn start_streaming(&self) {
        if self.streaming_started.swap(true, Ordering::SeqCst) {
            log::debug!("TELNET[{}] Streaming already started", self.id);
            return;
        }
        log::debug!("TELNET[{}] Streaming started", self.id);
    }
}
