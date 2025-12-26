use thiserror::Error;

/// Telnet-specific errors
#[derive(Error, Debug)]
pub enum TelnetError {
    #[error("Connection error: {0}")]
    Connection(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Protocol error: {0}")]
    ProtocolError(String),

    #[error("Connection timeout")]
    Timeout,

    #[error("Connection closed by remote host")]
    ConnectionClosed,

    #[error("Channel error: {0}")]
    ChannelError(String),
}
