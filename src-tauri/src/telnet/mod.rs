//! Telnet Terminal Module
//!
//! Provides Telnet protocol support for terminal connections.
//! Implements the TerminalSession trait for seamless integration
//! with the existing terminal infrastructure.

pub mod client;
pub mod config;
pub mod error;
pub mod login;
pub mod protocol;
pub mod session;

pub use config::TelnetConfig;
pub use error::TelnetError;
pub use session::TelnetTerminalSession;
