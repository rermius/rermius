use thiserror::Error;

/// SSH-related errors
#[derive(Error, Debug)]
pub enum SshError {
    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Key error: {0}")]
    KeyError(String),

    #[error("Channel error: {0}")]
    ChannelError(String),

    #[error("Command execution failed: {0}")]
    CommandFailed(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("SSH protocol error: {0}")]
    ProtocolError(String),
}

impl From<russh::Error> for SshError {
    fn from(err: russh::Error) -> Self {
        match err {
            russh::Error::IO(e) => SshError::IoError(e),
            russh::Error::Disconnect => SshError::Connection("Disconnected".to_string()),
            russh::Error::ChannelOpenFailure(_) => SshError::ChannelError("Channel open failed".to_string()),
            _ => SshError::ProtocolError(err.to_string()),
        }
    }
}

