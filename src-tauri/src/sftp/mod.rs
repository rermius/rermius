/// SFTP file transfer module
/// Provides file operations over SSH using russh-sftp

pub mod session;

pub use session::SftpSession;
