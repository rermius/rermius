use crate::ssh::config::{HostConfig, SshAuth};
use crate::ssh::error::SshError;
use log::{debug, info, warn};
use russh::client::Handle;
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
            return Err(SshError::AuthFailed(
                "SSH agent authentication not yet implemented.".to_string()
            ));
        }
    }
    Ok(())
}

