use thiserror::Error;

/// Terminal session errors
#[derive(Error, Debug)]
pub enum SessionError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("SSH error: {0}")]
    SshError(#[from] crate::ssh::error::SshError),

    #[error("PTY error: {0}")]
    PtyError(String),

    #[error("Session not found")]
    SessionNotFound,

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("Unsupported operation: {0}")]
    UnsupportedOperation(String),
}

/// File transfer connection errors
#[derive(Debug, Error)]
pub enum ConnectionError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),
    
    #[error("I/O error: {0}")]
    IoError(String),
    
    #[error("SFTP error: {0}")]
    SftpError(String),
    
    #[error("FTP error: {0}")]
    FtpError(String),
    
    #[error("Unsupported connection type: {0}")]
    UnsupportedType(String),
    
    #[error("Unknown error: {0}")]
    Unknown(String),
}

