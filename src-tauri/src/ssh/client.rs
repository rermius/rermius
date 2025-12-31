use crate::ssh::config::{HostConfig, SshAuth};
use crate::ssh::error::SshError;
use log::{debug, info, warn};
use russh::client::Handle;
use russh::keys::agent::client::AgentClient;
use russh::*;
use std::sync::Arc;

/// SSH client handler implementing russh::client::Handler
pub struct SshClient;

impl SshClient {
    pub fn new() -> Self {
        Self
    }
}

impl client::Handler for SshClient {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Accept all server keys (can be made configurable later)
        Ok(true)
    }
}

/// Connect directly to SSH server via TCP
pub async fn connect_direct(config: &HostConfig) -> Result<Handle<SshClient>, SshError> {
    let addr = format!("{}:{}", config.hostname, config.port);
    info!("SSH connecting to {}", addr);
    
    let ssh_config = Arc::new(client::Config::default());
    let client = SshClient::new();
    
    client::connect(ssh_config, &addr, client).await
        .map_err(|e| {
            warn!("SSH connection failed: {:?}", e);
            SshError::Connection(e.to_string())
        })
}

/// Authenticate SSH session
pub async fn authenticate(handle: &mut Handle<SshClient>, config: &HostConfig) -> Result<(), SshError> {
    info!("SSH authenticating user: {}", config.username);
    
    match &config.auth {
        SshAuth::Password(pwd) => {
            let result = handle.authenticate_password(&config.username, pwd).await?;
            if !result.success() {
                return Err(SshError::AuthFailed(format!("Password auth failed for {}", config.username)));
            }
            info!("SSH password auth success");
        }
        SshAuth::Key { path, passphrase } => {
            let key = keys::load_secret_key(path, passphrase.as_deref())
                .map_err(|e| SshError::KeyError(e.to_string()))?;
            
            debug!("SSH key loaded, type: {:?}", key.algorithm());
            
            // RSA keys need explicit hash algorithm
            let hash_alg = Some(keys::HashAlg::Sha256);
            let key_with_alg = keys::PrivateKeyWithHashAlg::new(Arc::new(key), hash_alg);
            
            let result = handle.authenticate_publickey(&config.username, key_with_alg).await?;
            if !result.success() {
                return Err(SshError::AuthFailed(format!("Key auth failed for {}", config.username)));
            }
            info!("SSH publickey auth success");
        }
        SshAuth::Agent => {
            authenticate_with_agent(handle, &config.username).await?;
            info!("SSH agent auth success");
        }
    }
    Ok(())
}

/// Authenticate using SSH agent
async fn authenticate_with_agent(
    handle: &mut Handle<SshClient>,
    username: &str,
) -> Result<(), SshError> {
    #[cfg(unix)]
    {
        authenticate_with_agent_unix(handle, username).await
    }

    #[cfg(windows)]
    {
        authenticate_with_agent_windows(handle, username).await
    }
}

#[cfg(unix)]
async fn authenticate_with_agent_unix(
    handle: &mut Handle<SshClient>,
    username: &str,
) -> Result<(), SshError> {
    use tokio::net::UnixStream;

    // 1. Get agent socket path
    let agent_path = get_agent_socket_path()?;
    debug!("SSH agent socket: {}", agent_path);

    // 2. Connect to Unix socket
    let stream = UnixStream::connect(&agent_path).await
        .map_err(|e| SshError::AuthFailed(
            format!("Failed to connect to SSH agent: {}. Ensure ssh-agent is running.", e)
        ))?;

    let mut agent_client = AgentClient::connect(stream);

    // 3. Try authentication with agent keys
    try_agent_keys(handle, username, &mut agent_client).await
}

#[cfg(windows)]
async fn authenticate_with_agent_windows(
    handle: &mut Handle<SshClient>,
    username: &str,
) -> Result<(), SshError> {
    use tokio::net::windows::named_pipe::ClientOptions;

    // 1. Get agent pipe path
    let agent_path = get_agent_socket_path()?;
    debug!("SSH agent pipe: {}", agent_path);

    // 2. Connect to named pipe
    let stream = ClientOptions::new()
        .open(&agent_path)
        .map_err(|e| SshError::AuthFailed(
            format!("Failed to connect to SSH agent: {}. Ensure OpenSSH Authentication Agent service is running.", e)
        ))?;

    let mut agent_client = AgentClient::connect(stream);

    // 3. Try authentication with agent keys
    try_agent_keys(handle, username, &mut agent_client).await
}

/// Try authenticating with each key from the agent
async fn try_agent_keys<S>(
    handle: &mut Handle<SshClient>,
    username: &str,
    agent_client: &mut AgentClient<S>,
) -> Result<(), SshError>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    // Request identities from agent
    let identities = agent_client.request_identities().await
        .map_err(|e| SshError::AuthFailed(
            format!("Failed to list agent keys: {}", e)
        ))?;

    if identities.is_empty() {
        return Err(SshError::AuthFailed(
            "SSH agent has no keys loaded. Add keys with: ssh-add ~/.ssh/id_rsa".to_string()
        ));
    }

    info!("SSH agent has {} key(s), trying each...", identities.len());

    // Try each identity until one succeeds
    let mut last_error = None;
    for (idx, identity) in identities.iter().enumerate() {
        let key_info = identity.comment();
        debug!("Trying agent key {}/{}: {}", idx + 1, identities.len(), key_info);

        // Determine hash algorithm based on key type
        let hash_alg = if identity.algorithm().is_rsa() {
            Some(keys::HashAlg::Sha256)
        } else {
            None
        };

        // Use authenticate_publickey_with which delegates signing to the agent
        match handle.authenticate_publickey_with(
            username,
            identity.clone(),
            hash_alg,
            agent_client
        ).await {
            Ok(result) if result.success() => {
                info!("SSH agent key {} ({}) accepted by server", idx + 1, key_info);
                return Ok(());
            }
            Ok(_) => {
                debug!("Server rejected key {}, trying next", idx + 1);
                continue;
            }
            Err(e) => {
                warn!("Error trying key {}: {:?}", idx + 1, e);
                last_error = Some(format!("{:?}", e));
                continue;
            }
        }
    }

    Err(SshError::AuthFailed(format!(
        "All {} agent key(s) rejected by server. Last error: {:?}",
        identities.len(),
        last_error
    )))
}

/// Get SSH agent socket path (platform-specific)
fn get_agent_socket_path() -> Result<String, SshError> {
    #[cfg(unix)]
    {
        std::env::var("SSH_AUTH_SOCK").map_err(|_| {
            SshError::AuthFailed(
                "SSH_AUTH_SOCK environment variable not set. Start ssh-agent with: eval $(ssh-agent -s)".to_string()
            )
        })
    }

    #[cfg(windows)]
    {
        // Try OpenSSH for Windows agent first
        let openssh_pipe = r"\\.\pipe\openssh-ssh-agent";

        // Check if pipe exists by trying to query its metadata
        if std::fs::metadata(openssh_pipe).is_ok() {
            Ok(openssh_pipe.to_string())
        } else {
            // Fallback: Try SSH_AUTH_SOCK (for WSL, Git Bash, etc.)
            std::env::var("SSH_AUTH_SOCK").map_err(|_| {
                SshError::AuthFailed(
                    "SSH agent not found. Start OpenSSH agent service or set SSH_AUTH_SOCK.".to_string()
                )
            })
        }
    }
}

