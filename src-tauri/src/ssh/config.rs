use serde::{Deserialize, Serialize};

/// Connection type enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionType {
    Ssh,
    Sftp,
    Ftp,
    Ftps,
    Telnet,
}

impl Default for ConnectionType {
    fn default() -> Self {
        ConnectionType::Ssh
    }
}

/// SSH authentication method
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SshAuth {
    Password(String),
    Key {
        path: String,
        passphrase: Option<String>,
    },
    Agent,
}

/// Configuration for a single SSH host (internal use)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostConfig {
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuth,
    #[serde(default)]
    pub connection_type: ConnectionType,
}

/// Host config from frontend (flat structure for JSON)
#[derive(Debug, Clone, Deserialize)]
pub struct HostConfigInput {
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub key_path: Option<String>,
    pub password: Option<String>,
    #[serde(default)]
    pub connection_type: Option<ConnectionType>,
}

impl HostConfigInput {
    /// Convert to internal HostConfig
    pub fn into_host_config(self) -> Result<HostConfig, String> {
        let auth = match self.auth_method.as_str() {
            "password" => {
                let pwd = self.password.ok_or("Password required")?;
                SshAuth::Password(pwd)
            }
            "key" => {
                let path = self.key_path.ok_or("Key path required")?;
                SshAuth::Key { path, passphrase: None }
            }
            "agent" => SshAuth::Agent,
            _ => return Err(format!("Unknown auth method: {}", self.auth_method)),
        };
        
        Ok(HostConfig {
            hostname: self.hostname,
            port: self.port,
            username: self.username,
            auth,
            connection_type: self.connection_type.unwrap_or(ConnectionType::Ssh),
        })
    }
}

impl Default for HostConfig {
    fn default() -> Self {
        Self {
            hostname: String::new(),
            port: 22,
            username: String::new(),
            auth: SshAuth::Agent,
            connection_type: ConnectionType::Ssh,
        }
    }
}

/// Terminal configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalConfig {
    pub cols: u16,
    pub rows: u16,
}

impl Default for TerminalConfig {
    fn default() -> Self {
        Self { cols: 80, rows: 24 }
    }
}

/// Complete SSH connection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfig {
    pub target: HostConfig,
    pub jumps: Vec<HostConfig>,
    pub terminal: TerminalConfig,
}

/// Progress event for SSH chain connection
#[derive(Clone, Serialize, Deserialize)]
pub struct ChainProgress {
    pub hop_index: usize,
    pub total_hops: usize,
    pub hostname: String,
    pub status: String, // "connecting" | "authenticating" | "connected" | "failed"
    pub message: String,
}

