use crate::ssh::client::{self, SshClient};
use crate::ssh::config::{HostConfig, ChainProgress};
use crate::ssh::error::SshError;
use log::{debug, info, warn};
use russh::{client::{Handle, Msg}, Channel, ChannelMsg};
use std::sync::Arc;
use std::pin::Pin;
use std::future::Future;
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Handler for a single hop in SSH chain (Chain of Responsibility pattern)
pub struct HopHandler {
    config: HostConfig,
    next: Option<Box<HopHandler>>,
    hop_index: usize,
    total_hops: usize,
}

impl HopHandler {
    /// Create a chain of handlers from config
    pub fn from_config(jumps: &[HostConfig], target: &HostConfig) -> Self {
        let mut handlers: Vec<HostConfig> = jumps.to_vec();
        handlers.push(target.clone());
        let total = handlers.len();
        
        Self::build_chain(&handlers, 0, total)
    }
    
    fn build_chain(configs: &[HostConfig], index: usize, total: usize) -> Self {
        match configs {
            [] => panic!("Empty chain"),
            [last] => HopHandler {
                config: last.clone(),
                next: None,
                hop_index: index,
                total_hops: total,
            },
            [first, rest @ ..] => HopHandler {
                config: first.clone(),
                next: Some(Box::new(Self::build_chain(rest, index + 1, total))),
                hop_index: index,
                total_hops: total,
            },
        }
    }
    
    /// Emit progress event to frontend
    fn emit_progress(&self, app_handle: &AppHandle, status: &str, message: &str) {
        let progress = ChainProgress {
            hop_index: self.hop_index,
            total_hops: self.total_hops,
            hostname: self.config.hostname.clone(),
            status: status.to_string(),
            message: message.to_string(),
        };
        let _ = app_handle.emit("ssh-chain-progress", progress);
    }
    
    /// Execute the chain, returning final session handle
    pub fn execute<'a>(
        &'a self,
        transport: Option<Channel<Msg>>,
        app_handle: &'a AppHandle,
    ) -> Pin<Box<dyn Future<Output = Result<Handle<SshClient>, SshError>> + Send + 'a>> {
        Box::pin(async move {
        let hop_label = if self.next.is_some() { "Jump" } else { "Target" };
        
        // 1. Connect this hop
        self.emit_progress(app_handle, "connecting", 
            &format!("{}: Connecting to {}:{}", hop_label, self.config.hostname, self.config.port));
        
        let mut handle = match transport {
            Some(channel) => {
                // Connect over existing channel (tunnel)
                Self::connect_over_channel(channel, &self.config).await?
            }
            None => {
                // First hop: direct TCP connection
                client::connect_direct(&self.config).await?
            }
        };
        
        // 2. Authenticate
        self.emit_progress(app_handle, "authenticating",
            &format!("{}: Authenticating as {}", hop_label, self.config.username));
        client::authenticate(&mut handle, &self.config).await?;
        
        self.emit_progress(app_handle, "connected",
            &format!("{}: Connected to {}", hop_label, self.config.hostname));
        
        // 3. If there's a next hop, create tunnel and delegate
        if let Some(ref next) = self.next {
            // Open tunnel to next hop
            debug!("SSH chain opening tunnel to {}:{}", next.config.hostname, next.config.port);
            
            // Wait a bit for the session to stabilize
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            
            let tunnel = match handle
                .channel_open_direct_tcpip(
                    &next.config.hostname,
                    next.config.port as u32,
                    "127.0.0.1",
                    22222,
                )
                .await
            {
                Ok(ch) => ch,
                Err(e) => {
                    warn!("SSH chain failed to open tunnel: {:?}", e);
                    return Err(SshError::Connection(format!(
                        "Cannot open tunnel to {}:{} - check if TCP forwarding is enabled on jump host and target is reachable. Error: {}",
                        next.config.hostname, next.config.port, e
                    )));
                }
            };
            debug!("SSH chain tunnel opened, channel id: {:?}", tunnel.id());
            
            // Pass tunnel to next handler
            next.execute(Some(tunnel), app_handle).await
        } else {
            // This is the target - return handle for PTY
            Ok(handle)
        }
        })
    }
    
    /// Connect SSH over an existing channel using local port forwarding
    /// Pattern: spawn local TCP listener, bridge channel I/O, connect SSH through it
    async fn connect_over_channel(
        mut channel: Channel<Msg>,
        config: &HostConfig,
    ) -> Result<Handle<SshClient>, SshError> {
        // 1. Bind local listener on random port
        let listener = TcpListener::bind("127.0.0.1:0").await
            .map_err(|e| SshError::Connection(format!("Failed to bind local listener: {}", e)))?;
        let local_addr = listener.local_addr()
            .map_err(|e| SshError::Connection(format!("Failed to get local addr: {}", e)))?;
        
        debug!("SSH chain local bridge listener on {}", local_addr);
        
        // 2. Spawn bridge task: channel <-> TCP
        tokio::spawn(async move {
            // Accept one connection (the SSH client we'll create)
            let Ok((mut stream, _)) = listener.accept().await else {
                warn!("SSH chain bridge: failed to accept");
                return;
            };
            
            debug!("SSH chain bridge: connection accepted, starting I/O loop");
            
            let mut buf = vec![0u8; 65536];
            let mut stream_closed = false;
            
            loop {
                tokio::select! {
                    // TCP -> Channel (data from SSH client to remote)
                    r = stream.read(&mut buf), if !stream_closed => {
                        match r {
                            Ok(0) => {
                                stream_closed = true;
                                let _ = channel.eof().await;
                            }
                            Ok(n) => {
                                if let Err(e) = channel.data(&buf[..n]).await {
                                    warn!("SSH chain bridge: channel write error: {:?}", e);
                                    break;
                                }
                            }
                            Err(e) => {
                                warn!("SSH chain bridge: TCP read error: {:?}", e);
                                break;
                            }
                        }
                    }
                    
                    // Channel -> TCP (data from remote to SSH client)
                    msg = channel.wait() => {
                        match msg {
                            Some(ChannelMsg::Data { ref data }) => {
                                if let Err(e) = stream.write_all(data).await {
                                    warn!("SSH chain bridge: TCP write error: {:?}", e);
                                    break;
                                }
                                let _ = stream.flush().await;
                            }
                            Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                                debug!("SSH chain bridge: channel closed");
                                break;
                            }
                            _ => {}
                        }
                    }
                }
            }
            
            debug!("SSH chain bridge: I/O loop ended");
        });
        
        // 3. Connect SSH client through local bridge
        let ssh_config = Arc::new(russh::client::Config::default());
        let client = SshClient::new();
        
        debug!("SSH chain connecting through bridge to {}:{}", config.hostname, config.port);
        
        russh::client::connect(ssh_config, local_addr, client).await
            .map_err(|e| SshError::Connection(format!("SSH over tunnel failed: {}", e)))
    }
}
