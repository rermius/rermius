//! Telnet TCP client connection

use std::time::Duration;
use tokio::net::TcpStream;

use super::config::TelnetConfig;
use super::error::TelnetError;

/// Default connection timeout in seconds
const DEFAULT_TIMEOUT_SECS: u64 = 30;

/// Connect to a telnet server
pub async fn connect(config: &TelnetConfig) -> Result<TcpStream, TelnetError> {
    let addr = format!("{}:{}", config.hostname, config.port);

    log::info!(
        "TELNET: Connecting to {} (timeout: {}s)",
        addr,
        DEFAULT_TIMEOUT_SECS
    );

    // Connect with timeout
    let stream = tokio::time::timeout(
        Duration::from_secs(DEFAULT_TIMEOUT_SECS),
        TcpStream::connect(&addr),
    )
    .await
    .map_err(|_| TelnetError::Timeout)?
    .map_err(|e| TelnetError::Connection(format!("Failed to connect to {}: {}", addr, e)))?;

    // Set TCP options for low latency
    stream
        .set_nodelay(true)
        .map_err(|e| TelnetError::Connection(format!("Failed to set TCP_NODELAY: {}", e)))?;

    log::info!("TELNET: Connected to {}", addr);

    Ok(stream)
}
