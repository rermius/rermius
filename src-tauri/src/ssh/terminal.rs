use crate::ssh::client::{self, SshClient};
use crate::ssh::config::SshConfig;
use crate::ssh::error::SshError;
use crate::core::error::SessionError;
use crate::core::session::TerminalSession;
use crate::core::terminal_events::TerminalExitEvent;
use crate::terminal::session::SessionType;
use async_trait::async_trait;
use log::{debug, info, warn};
use russh::{client::{Handle, Msg}, Channel, ChannelMsg};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use uuid::Uuid;

/// SSH terminal session (Strategy Pattern implementation)
pub struct SshTerminalSession {
    id: String,
    handle: Handle<SshClient>,
    write_tx: mpsc::UnboundedSender<Vec<u8>>,
    resize_tx: mpsc::UnboundedSender<(u16, u16)>,
    streaming_started: Arc<AtomicBool>,
}

impl SshTerminalSession {
    /// Connect to SSH server (supports direct and ProxyJump)
    /// Returns session immediately - call start_streaming() after FE listener is ready
    pub async fn connect(config: SshConfig, app_handle: AppHandle) -> Result<Self, SshError> {
        let id = Uuid::new_v4().to_string();

        let handle = if config.jumps.is_empty() {
            // Direct connection
            info!("SSH direct connection to {}", config.target.hostname);
            let mut h = client::connect_direct(&config.target).await?;
            client::authenticate(&mut h, &config.target).await?;
            h
        } else {
            // ProxyJump via chain
            info!("SSH chain connection through {} jumps", config.jumps.len());
            use crate::ssh::chain::HopHandler;
            let chain = HopHandler::from_config(&config.jumps, &config.target);
            chain.execute(None, &app_handle).await?
        };
        
        // Open PTY channel
        debug!("SSH opening session channel");
        let channel = handle.channel_open_session().await?;
        debug!("SSH session channel opened, id: {:?}", channel.id());

        // Request PTY with TTY operation settings
        // TTY_OP_ISPEED and TTY_OP_OSPEED are critical for interactive programs like vi/vim
        // Without these, the remote shell may not properly configure raw mode
        debug!("SSH requesting PTY {}x{}", config.terminal.cols, config.terminal.rows);
        channel.request_pty(
            false,
            "xterm-256color",
            config.terminal.cols as u32,
            config.terminal.rows as u32,
            0,
            0,
            &[
                (russh::Pty::TTY_OP_ISPEED, 38400),  // Input baud rate
                (russh::Pty::TTY_OP_OSPEED, 38400),  // Output baud rate
            ],
        ).await?;

        // Start shell (false = non-blocking, don't wait for server response)
        // This matches Kerminal's approach and may improve responsiveness
        debug!("SSH requesting shell");
        channel.request_shell(false).await?;
        info!("SSH shell started");
        
        // Create channels for write and resize commands
        let (write_tx, write_rx) = mpsc::unbounded_channel::<Vec<u8>>();
        let (resize_tx, resize_rx) = mpsc::unbounded_channel::<(u16, u16)>();
        
        // Spawn channel I/O handler - owns the channel exclusively
        let session_id = id.clone();
        let app_handle_clone = app_handle.clone();
        let streaming_started = Arc::new(AtomicBool::new(false));
        let streaming_flag = streaming_started.clone();
        
        tokio::spawn(async move {
            Self::channel_io_loop(
                channel,
                write_rx,
                resize_rx,
                session_id,
                app_handle_clone,
                streaming_flag,
            ).await;
        });
        
        Ok(SshTerminalSession {
            id,
            handle,
            write_tx,
            resize_tx,
            streaming_started,
        })
    }
    
    /// Channel I/O loop - handles both reading and writing without mutex
    async fn channel_io_loop(
        mut channel: Channel<Msg>,
        mut write_rx: mpsc::UnboundedReceiver<Vec<u8>>,
        mut resize_rx: mpsc::UnboundedReceiver<(u16, u16)>,
        session_id: String,
        app_handle: AppHandle,
        streaming_started: Arc<AtomicBool>,
    ) {
        debug!("SSH[{}] channel I/O loop started", session_id);
        
        // Buffer for data received before streaming starts
        let mut pending_buffer: Vec<String> = Vec::new();
        
        loop {
            tokio::select! {
                // Use biased to prioritize writes (user input) over reads
                // This ensures responsive input handling for interactive programs like vi
                biased;

                // Handle write requests from FE (prioritized)
                Some(data) = write_rx.recv() => {
                    if let Err(e) = channel.data(&data[..]).await {
                        warn!("SSH[{}] write error: {:?}", session_id, e);
                        break;
                    }
                }
                
                // Handle resize requests
                Some((cols, rows)) = resize_rx.recv() => {
                    if let Err(e) = channel.window_change(cols as u32, rows as u32, 0, 0).await {
                        warn!("SSH[{}] resize error: {:?}", session_id, e);
                    }
                }
                
                // Handle incoming data from SSH server
                msg = channel.wait() => {
                    match msg {
                        Some(ChannelMsg::Data { data }) => {
                            let output = String::from_utf8_lossy(&data).to_string();

                            if streaming_started.load(Ordering::SeqCst) {
                                // Flush pending buffer first
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
                                // Buffer data until streaming starts
                                pending_buffer.push(output);
                            }
                        }
                        Some(ChannelMsg::ExtendedData { data, .. }) => {
                            let output = String::from_utf8_lossy(&data).to_string();
                            if streaming_started.load(Ordering::SeqCst) {
                                let _ = app_handle.emit(
                                    &format!("terminal-output:{}", session_id),
                                    output
                                );
                            } else {
                                pending_buffer.push(output);
                            }
                        }
                        Some(ChannelMsg::Eof) => {
                            // EOF = Server closed write stream
                            // NOTE: This could be normal session end OR unexpected disconnect
                            // Frontend heartbeat mechanism will distinguish zombie connections
                            debug!("SSH[{}] received channel EOF - connection closing", session_id);
                            let exit_event = TerminalExitEvent::connection_lost();
                            let _ = app_handle.emit(&format!("terminal-exit:{}", session_id), exit_event);
                            break;
                        }
                        Some(ChannelMsg::Close) => {
                            // Close = Channel fully closed by server
                            // Emitted after both sides agree to close
                            debug!("SSH[{}] received channel Close - connection terminated", session_id);
                            let exit_event = TerminalExitEvent::connection_lost();
                            let _ = app_handle.emit(&format!("terminal-exit:{}", session_id), exit_event);
                            break;
                        }
                        Some(ChannelMsg::ExitStatus { exit_status }) => {
                            // Exit status from remote command
                            debug!("SSH[{}] remote process exited with status: {}", session_id, exit_status);
                            // Don't break here - wait for EOF/Close
                        }
                        Some(ChannelMsg::ExitSignal { signal_name, .. }) => {
                            // Process killed by signal
                            debug!("SSH[{}] remote process killed by signal: {:?}", session_id, signal_name);
                            // Don't break here - wait for EOF/Close
                        }
                        Some(_) => {
                            // Other channel messages (WindowAdjusted, etc.)
                        }
                        None => {
                            // Channel wait() returned None = connection dropped unexpectedly
                            debug!("SSH[{}] channel wait returned None - network disconnected", session_id);
                            let exit_event = TerminalExitEvent::connection_lost();
                            let _ = app_handle.emit(&format!("terminal-exit:{}", session_id), exit_event);
                            break;
                        }
                    }
                }
            }
        }
        
        debug!("SSH[{}] channel I/O loop ended", session_id);
    }
    
    /// Start streaming output to frontend
    /// Call this AFTER frontend has setup event listener
    pub fn start_streaming(&self) {
        if self.streaming_started.swap(true, Ordering::SeqCst) {
            debug!("SSH[{}] streaming already started", self.id);
            return;
        }
        debug!("SSH[{}] streaming started", self.id);
    }

    /// Execute a command and capture its output (non-interactive exec channel)
    /// Used for fetching command history, environment variables, etc.
    /// Note: No timeout here - callers should add timeout if needed
    pub async fn execute_command(&self, command: &str) -> Result<String, SshError> {
        info!("SSH[{}] executing command: {}", self.id, command);

        // Open a new exec channel (separate from the PTY)
        let mut channel = self.handle.channel_open_session().await?;
        debug!("SSH[{}] exec channel opened", self.id);

        // Execute the command
        channel.exec(true, command).await?;
        debug!("SSH[{}] command execution started", self.id);

        // Collect all output
        let mut output = String::new();
        let mut error_output = String::new();
        let mut exit_status_received = false;

        loop {
            match channel.wait().await {
                Some(ChannelMsg::Data { data }) => {
                    let chunk = String::from_utf8_lossy(&data).to_string();
                    debug!("SSH[{}] received data chunk: {} bytes", self.id, data.len());
                    output.push_str(&chunk);
                }
                Some(ChannelMsg::ExtendedData { data, .. }) => {
                    let chunk = String::from_utf8_lossy(&data).to_string();
                    debug!("SSH[{}] received error data: {} bytes", self.id, data.len());
                    error_output.push_str(&chunk);
                }
                Some(ChannelMsg::ExitStatus { exit_status }) => {
                    info!("SSH[{}] command exited with status: {}", self.id, exit_status);
                    exit_status_received = true;
                    if exit_status != 0 {
                        warn!("SSH[{}] command failed. stderr: {}", self.id, error_output);
                        return Err(SshError::CommandFailed(format!(
                            "Command failed with status {}: {}",
                            exit_status,
                            error_output
                        )));
                    }
                }
                Some(ChannelMsg::Eof) => {
                    debug!("SSH[{}] received EOF", self.id);
                }
                Some(ChannelMsg::Close) => {
                    debug!("SSH[{}] channel closed", self.id);
                    break;
                }
                None => {
                    debug!("SSH[{}] channel wait returned None", self.id);
                    break;
                }
                _ => {
                    debug!("SSH[{}] received other channel message", self.id);
                }
            }
        }

        info!("SSH[{}] command completed. Output: {} bytes, Stderr: {} bytes, Exit status received: {}",
              self.id, output.len(), error_output.len(), exit_status_received);

        if !output.is_empty() {
            debug!("SSH[{}] output preview: {}", self.id,
                   if output.len() > 200 { &output[..200] } else { &output });
        }

        Ok(output)
    }
}

#[async_trait]
impl TerminalSession for SshTerminalSession {
    fn id(&self) -> &str {
        &self.id
    }

    fn session_type(&self) -> SessionType {
        SessionType::Ssh
    }

    async fn write(&self, data: &[u8]) -> Result<(), SessionError> {
        self.write_tx.send(data.to_vec())
            .map_err(|e| SessionError::SshError(SshError::ChannelError(e.to_string())))?;
        Ok(())
    }

    async fn resize(&self, cols: u16, rows: u16) -> Result<(), SessionError> {
        self.resize_tx.send((cols, rows))
            .map_err(|e| SessionError::SshError(SshError::ChannelError(e.to_string())))?;
        Ok(())
    }

    async fn close(&mut self) -> Result<(), SessionError> {
        // Dropping the senders will cause the I/O loop to exit
        Ok(())
    }

    fn start_streaming(&self) {
        SshTerminalSession::start_streaming(self);
    }

    async fn execute_command(&self, command: &str) -> Result<String, SessionError> {
        self.execute_command(command)
            .await
            .map_err(SessionError::SshError)
    }
}
