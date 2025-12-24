use serde::{Deserialize, Serialize};

/// Terminal exit event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalExitEvent {
    /// Exit code (0 = success, non-zero = error)
    pub exit_code: i32,
    /// Reason for exit
    pub reason: Option<String>,
}

impl TerminalExitEvent {
    /// Create a new terminal exit event
    pub fn new(exit_code: i32, reason: Option<String>) -> Self {
        Self { exit_code, reason }
    }

    /// Create exit event for user-closed connection
    pub fn user_closed() -> Self {
        Self {
            exit_code: 0,
            reason: Some("user-closed".to_string()),
        }
    }

    /// Create exit event for connection lost
    pub fn connection_lost() -> Self {
        Self {
            exit_code: 1,
            reason: Some("connection-lost".to_string()),
        }
    }

    /// Create exit event for server disconnect
    pub fn server_disconnect(message: Option<String>) -> Self {
        Self {
            exit_code: 1,
            reason: Some(format!("server-disconnect:{}", message.unwrap_or_default())),
        }
    }

    /// Create exit event for connection error
    pub fn connection_error(message: String) -> Self {
        Self {
            exit_code: 1,
            reason: Some(format!("connection-error:{}", message)),
        }
    }
}

