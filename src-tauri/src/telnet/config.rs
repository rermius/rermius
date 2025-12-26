use serde::{Deserialize, Serialize};

/// Telnet connection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelnetConfig {
    /// Hostname or IP address
    pub hostname: String,
    /// Port number (default: 23)
    pub port: u16,
    /// Terminal columns
    pub cols: u16,
    /// Terminal rows
    pub rows: u16,
    /// Username for auto-login (optional)
    pub username: Option<String>,
    /// Password for auto-login (optional)
    pub password: Option<String>,
}

impl Default for TelnetConfig {
    fn default() -> Self {
        Self {
            hostname: String::new(),
            port: 23,
            cols: 80,
            rows: 24,
            username: None,
            password: None,
        }
    }
}

impl TelnetConfig {
    /// Create a new TelnetConfig with required fields
    pub fn new(hostname: impl Into<String>, port: u16) -> Self {
        Self {
            hostname: hostname.into(),
            port,
            ..Default::default()
        }
    }

    /// Set terminal size
    pub fn with_size(mut self, cols: u16, rows: u16) -> Self {
        self.cols = cols;
        self.rows = rows;
        self
    }

    /// Set auto-login credentials
    pub fn with_credentials(mut self, username: Option<String>, password: Option<String>) -> Self {
        self.username = username;
        self.password = password;
        self
    }
}
