use async_trait::async_trait;
use futures_lite::io::AsyncReadExt;
use suppaftp::{AsyncFtpStream, AsyncRustlsFtpStream, AsyncRustlsConnector};
use suppaftp::types::FileType;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;

use crate::core::error::ConnectionError;
use crate::core::session::{FileInfo, FileTransferSession};
use crate::ssh::config::ConnectionType;

/// FTP/FTPS session using suppaftp
/// Uses separate Option fields to hold either plain FTP or secure FTPS stream
pub struct FtpSession {
    id: String,
    /// Plain FTP stream (when use_tls = false)
    ftp_plain: Option<Arc<Mutex<AsyncFtpStream>>>,
    /// Secure FTPS stream (when use_tls = true)
    ftp_secure: Option<Arc<Mutex<AsyncRustlsFtpStream>>>,
    is_ftps: bool,
    home_directory: Option<String>,
    home_resolved_for_root: AtomicBool,
}

/// Macro to execute an operation on either plain or secure FTP stream
macro_rules! ftp_op {
    ($self:expr, $method:ident $(, $arg:expr)*) => {{
        if let Some(ref ftp) = $self.ftp_secure {
            let mut ftp = ftp.lock().await;
            ftp.$method($($arg),*).await
        } else if let Some(ref ftp) = $self.ftp_plain {
            let mut ftp = ftp.lock().await;
            ftp.$method($($arg),*).await
        } else {
            panic!("No FTP connection available")
        }
    }};
}

impl FtpSession {
    /// Create new FTP or FTPS session
    ///
    /// For FTPS, uses explicit TLS (AUTH TLS) - connects plain then upgrades to TLS.
    pub async fn new(
        id: String,
        hostname: &str,
        port: u16,
        username: &str,
        password: &str,
        use_tls: bool,
    ) -> Result<Self, ConnectionError> {
        let addr = format!("{}:{}", hostname, port);

        let (ftp_plain, ftp_secure, home_directory) = if use_tls {
            // FTPS: Connect and upgrade to TLS using explicit FTPS (AUTH TLS)
            log::info!("[FTPS] Connecting to {} with TLS...", addr);

            // Connect with the secure stream type (AsyncRustlsFtpStream) so into_secure works
            // The type allows into_secure to accept AsyncRustlsConnector
            let ftp = AsyncRustlsFtpStream::connect(&addr)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to connect FTPS: {}", e)))?;

            // Create TLS connector chain: ClientConfig -> futures_rustls::TlsConnector -> AsyncRustlsConnector
            let tls_config = Self::create_tls_config();
            let rustls_connector = futures_rustls::TlsConnector::from(Arc::new(tls_config));
            let tls_connector = AsyncRustlsConnector::from(rustls_connector);

            // Upgrade to TLS using AUTH TLS command
            let mut secure_ftp = ftp
                .into_secure(tls_connector, hostname)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to establish TLS: {}", e)))?;

            log::info!("[FTPS] TLS connection established");

            // Login
            secure_ftp.login(username, password)
                .await
                .map_err(|e| ConnectionError::AuthenticationFailed(format!("FTPS login failed: {}", e)))?;

            // Set binary mode
            secure_ftp.transfer_type(FileType::Binary)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to set binary mode: {}", e)))?;

            // Get home directory
            let home = match secure_ftp.pwd().await {
                Ok(home) => {
                    log::info!("[FTPS] Detected home directory: {}", home);
                    Some(home)
                }
                Err(e) => {
                    log::warn!("[FTPS] Failed to get home directory: {}", e);
                    None
                }
            };

            log::info!("FTPS session {} connected to {}", id, addr);
            (None, Some(Arc::new(Mutex::new(secure_ftp))), home)
        } else {
            // Plain FTP connection
            log::info!("[FTP] Connecting to {}...", addr);
            let mut ftp = AsyncFtpStream::connect(&addr)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to connect FTP: {}", e)))?;

            // Login
            ftp.login(username, password)
                .await
                .map_err(|e| ConnectionError::AuthenticationFailed(format!("FTP login failed: {}", e)))?;

            // Set binary mode
            ftp.transfer_type(FileType::Binary)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to set binary mode: {}", e)))?;

            // Get home directory
            let home = match ftp.pwd().await {
                Ok(home) => {
                    log::info!("[FTP] Detected home directory: {}", home);
                    Some(home)
                }
                Err(e) => {
                    log::warn!("[FTP] Failed to get home directory: {}", e);
                    None
                }
            };

            log::info!("FTP session {} connected to {}", id, addr);
            (Some(Arc::new(Mutex::new(ftp))), None, home)
        };

        Ok(Self {
            id,
            ftp_plain,
            ftp_secure,
            is_ftps: use_tls,
            home_directory,
            home_resolved_for_root: AtomicBool::new(false),
        })
    }

    /// Create TLS configuration for FTPS
    ///
    /// This config accepts all certificates including self-signed ones,
    /// which is common for FTP servers.
    fn create_tls_config() -> rustls::ClientConfig {
        use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
        use rustls_pki_types::{CertificateDer, ServerName, UnixTime};
        use rustls::DigitallySignedStruct;

        /// A certificate verifier that accepts all certificates
        #[derive(Debug)]
        struct AcceptAllCertVerifier;

        impl ServerCertVerifier for AcceptAllCertVerifier {
            fn verify_server_cert(
                &self,
                _end_entity: &CertificateDer<'_>,
                _intermediates: &[CertificateDer<'_>],
                _server_name: &ServerName<'_>,
                _ocsp_response: &[u8],
                _now: UnixTime,
            ) -> Result<ServerCertVerified, rustls::Error> {
                Ok(ServerCertVerified::assertion())
            }

            fn verify_tls12_signature(
                &self,
                _message: &[u8],
                _cert: &CertificateDer<'_>,
                _dss: &DigitallySignedStruct,
            ) -> Result<HandshakeSignatureValid, rustls::Error> {
                Ok(HandshakeSignatureValid::assertion())
            }

            fn verify_tls13_signature(
                &self,
                _message: &[u8],
                _cert: &CertificateDer<'_>,
                _dss: &DigitallySignedStruct,
            ) -> Result<HandshakeSignatureValid, rustls::Error> {
                Ok(HandshakeSignatureValid::assertion())
            }

            fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
                vec![
                    rustls::SignatureScheme::RSA_PKCS1_SHA256,
                    rustls::SignatureScheme::RSA_PKCS1_SHA384,
                    rustls::SignatureScheme::RSA_PKCS1_SHA512,
                    rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
                    rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
                    rustls::SignatureScheme::ECDSA_NISTP521_SHA512,
                    rustls::SignatureScheme::RSA_PSS_SHA256,
                    rustls::SignatureScheme::RSA_PSS_SHA384,
                    rustls::SignatureScheme::RSA_PSS_SHA512,
                    rustls::SignatureScheme::ED25519,
                ]
            }
        }

        rustls::ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(AcceptAllCertVerifier))
            .with_no_client_auth()
    }
}

#[async_trait]
impl FileTransferSession for FtpSession {
    fn id(&self) -> &str {
        &self.id
    }

    fn connection_type(&self) -> ConnectionType {
        if self.is_ftps {
            ConnectionType::Ftps
        } else {
            ConnectionType::Ftp
        }
    }

    async fn list_directory(&self, path: &str) -> Result<Vec<FileInfo>, ConnectionError> {
        // Normalize path: remove trailing slash except for root
        let normalized_path = if path == "/" {
            "/"
        } else {
            path.trim_end_matches('/')
        };

        // Resolve home directory for root path on first request only
        let is_root_like = normalized_path.is_empty() || normalized_path == "/";
        let use_home_for_root =
            is_root_like && !self.home_resolved_for_root.swap(true, Ordering::SeqCst);

        let target_path = if use_home_for_root {
            if let Some(ref home) = self.home_directory {
                home.clone()
            } else {
                ftp_op!(self, pwd).unwrap_or_else(|_| "/".to_string())
            }
        } else {
            normalized_path.to_string()
        };

        // Change to target directory
        let actual_path = match ftp_op!(self, cwd, &target_path) {
            Ok(_) => target_path,
            Err(_e) => {
                ftp_op!(self, pwd).unwrap_or_else(|_| {
                    log::warn!("[FTP] Failed to access {} and PWD failed", target_path);
                    "/".to_string()
                })
            }
        };

        // List files
        let entries = ftp_op!(self, list, None)
            .map_err(|e| {
                log::error!("[FTP] Failed to list directory {}: {}", actual_path, e);
                ConnectionError::FtpError(format!("Failed to list directory: {}", e))
            })?;

        let base_path = if actual_path.is_empty() { "/" } else { &actual_path };

        let files: Vec<FileInfo> = entries
            .into_iter()
            .filter_map(|line| parse_ftp_list_line(&line, base_path))
            .collect();

        Ok(files)
    }

    async fn download_file(&self, remote_path: &str, local_path: &str) -> Result<(), ConnectionError> {
        self.download_file_with_progress(remote_path, local_path, None).await
    }

    async fn download_file_with_progress(
        &self,
        remote_path: &str,
        local_path: &str,
        progress: Option<Arc<dyn Fn(u64, u64) + Send + Sync>>,
    ) -> Result<(), ConnectionError> {
        // Get file size first
        let total_bytes = ftp_op!(self, size, remote_path).unwrap_or(0) as u64;

        // Download using retr_as_stream and read all data
        let data = if let Some(ref ftp) = self.ftp_secure {
            let mut ftp = ftp.lock().await;
            let mut stream = ftp.retr_as_stream(remote_path)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to start download: {}", e)))?;

            let mut buffer = Vec::new();
            stream.read_to_end(&mut buffer)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to read file data: {}", e)))?;

            ftp.finalize_retr_stream(stream)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to finalize download: {}", e)))?;

            buffer
        } else if let Some(ref ftp) = self.ftp_plain {
            let mut ftp = ftp.lock().await;
            let mut stream = ftp.retr_as_stream(remote_path)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to start download: {}", e)))?;

            let mut buffer = Vec::new();
            stream.read_to_end(&mut buffer)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to read file data: {}", e)))?;

            ftp.finalize_retr_stream(stream)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to finalize download: {}", e)))?;

            buffer
        } else {
            return Err(ConnectionError::FtpError("No FTP connection".to_string()));
        };

        // Write to local file
        tokio::fs::write(local_path, &data)
            .await
            .map_err(|e| ConnectionError::IoError(format!("Failed to write local file: {}", e)))?;

        // Report final progress
        if let Some(cb) = &progress {
            cb(data.len() as u64, total_bytes.max(data.len() as u64));
        }

        Ok(())
    }

    async fn upload_file(&self, local_path: &str, remote_path: &str) -> Result<(), ConnectionError> {
        self.upload_file_with_progress(local_path, remote_path, None).await
    }

    async fn upload_file_with_progress(
        &self,
        local_path: &str,
        remote_path: &str,
        progress: Option<Arc<dyn Fn(u64, u64) + Send + Sync>>,
    ) -> Result<(), ConnectionError> {
        // Read local file
        let data = tokio::fs::read(local_path)
            .await
            .map_err(|e| ConnectionError::IoError(format!("Failed to read local file: {}", e)))?;

        let total_bytes = data.len() as u64;

        // Upload
        let mut reader: &[u8] = &data;
        if let Some(ref ftp) = self.ftp_secure {
            let mut ftp = ftp.lock().await;
            ftp.put_file(remote_path, &mut reader)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to upload file: {}", e)))?;
        } else if let Some(ref ftp) = self.ftp_plain {
            let mut ftp = ftp.lock().await;
            ftp.put_file(remote_path, &mut reader)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to upload file: {}", e)))?;
        } else {
            return Err(ConnectionError::FtpError("No FTP connection".to_string()));
        }

        // Report final progress
        if let Some(cb) = &progress {
            cb(total_bytes, total_bytes);
        }

        Ok(())
    }

    async fn create_directory(&self, path: &str) -> Result<(), ConnectionError> {
        ftp_op!(self, mkdir, path)
            .map_err(|e| ConnectionError::FtpError(format!("Failed to create directory: {}", e)))?;
        Ok(())
    }

    async fn delete(&self, path: &str, is_directory: bool) -> Result<(), ConnectionError> {
        log::info!("[FTP] Attempting to delete {}: path='{}'",
            if is_directory { "directory" } else { "file" },
            path);

        let result = if is_directory {
            ftp_op!(self, rmdir, path)
        } else {
            ftp_op!(self, rm, path)
        };

        match result {
            Ok(()) => {
                log::info!("[FTP] Successfully deleted {}: {}",
                    if is_directory { "directory" } else { "file" },
                    path);
                Ok(())
            },
            Err(e) => {
                log::error!("[FTP] Failed to delete {} {}: {}",
                    if is_directory { "directory" } else { "file" },
                    path,
                    e);
                Err(ConnectionError::FtpError(format!(
                    "Failed to remove {} {}: {}",
                    if is_directory { "directory" } else { "file" },
                    path,
                    e
                )))
            }
        }
    }

    async fn rename(&self, old_path: &str, new_path: &str) -> Result<(), ConnectionError> {
        use crate::core::normalize_remote_path;

        let normalized_old = normalize_remote_path(old_path);
        let normalized_new = normalize_remote_path(new_path);

        ftp_op!(self, rename, &normalized_old, &normalized_new)
            .map_err(|e| {
                log::error!("[FTP] Failed to rename {} to {}: {}", normalized_old, normalized_new, e);
                ConnectionError::FtpError(format!("Failed to rename {} to {}: {}", normalized_old, normalized_new, e))
            })?;
        Ok(())
    }

    async fn chmod(&self, _path: &str, _mode: u32) -> Result<(), ConnectionError> {
        Err(ConnectionError::FtpError("FTP does not support chmod".to_string()))
    }

    async fn stat(&self, path: &str) -> Result<FileInfo, ConnectionError> {
        // Get parent directory and file name
        let parts: Vec<&str> = path.rsplitn(2, '/').collect();
        let (name, dir) = if parts.len() == 2 {
            (parts[0], parts[1])
        } else {
            (path, "/")
        };

        // Change to directory
        ftp_op!(self, cwd, dir)
            .map_err(|e| ConnectionError::FtpError(format!("Failed to change directory: {}", e)))?;

        // List and find file
        let entries = ftp_op!(self, list, None)
            .map_err(|e| ConnectionError::FtpError(format!("Failed to list directory: {}", e)))?;

        for line in entries {
            if let Some(file_info) = parse_ftp_list_line(&line, dir) {
                if file_info.name == name {
                    return Ok(file_info);
                }
            }
        }

        Err(ConnectionError::FtpError(format!("File not found: {}", path)))
    }

    async fn read_file(&self, path: &str) -> Result<Vec<u8>, ConnectionError> {
        let data = if let Some(ref ftp) = self.ftp_secure {
            let mut ftp = ftp.lock().await;
            let mut stream = ftp.retr_as_stream(path)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to start read: {}", e)))?;

            let mut buffer = Vec::new();
            stream.read_to_end(&mut buffer)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to read file: {}", e)))?;

            ftp.finalize_retr_stream(stream)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to finalize read: {}", e)))?;

            buffer
        } else if let Some(ref ftp) = self.ftp_plain {
            let mut ftp = ftp.lock().await;
            let mut stream = ftp.retr_as_stream(path)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to start read: {}", e)))?;

            let mut buffer = Vec::new();
            stream.read_to_end(&mut buffer)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to read file: {}", e)))?;

            ftp.finalize_retr_stream(stream)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to finalize read: {}", e)))?;

            buffer
        } else {
            return Err(ConnectionError::FtpError("No FTP connection".to_string()));
        };

        Ok(data)
    }

    async fn write_file(&self, path: &str, content: &[u8]) -> Result<(), ConnectionError> {
        let mut reader: &[u8] = content;

        if let Some(ref ftp) = self.ftp_secure {
            let mut ftp = ftp.lock().await;
            ftp.put_file(path, &mut reader)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to write file: {}", e)))?;
        } else if let Some(ref ftp) = self.ftp_plain {
            let mut ftp = ftp.lock().await;
            ftp.put_file(path, &mut reader)
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to write file: {}", e)))?;
        } else {
            return Err(ConnectionError::FtpError("No FTP connection".to_string()));
        }

        Ok(())
    }

    async fn close(&mut self) -> Result<(), ConnectionError> {
        if let Some(ref ftp) = self.ftp_secure {
            let mut ftp = ftp.lock().await;
            ftp.quit()
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to close FTPS: {}", e)))?;
        } else if let Some(ref ftp) = self.ftp_plain {
            let mut ftp = ftp.lock().await;
            ftp.quit()
                .await
                .map_err(|e| ConnectionError::FtpError(format!("Failed to close FTP: {}", e)))?;
        }
        Ok(())
    }
}

/// Parse FTP LIST output line (Unix-style)
fn parse_ftp_list_line(line: &str, base_path: &str) -> Option<FileInfo> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();

    if parts.len() < 9 {
        log::debug!("[FTP] LIST line has < 9 parts ({}): {}", parts.len(), trimmed);
        return None;
    }

    let permissions = parts[0];

    if permissions.len() < 10 {
        log::debug!("[FTP] Permissions too short ({} chars): {}", permissions.len(), permissions);
        return None;
    }

    let first_char = permissions.chars().next();
    if !matches!(first_char, Some('d' | '-' | 'l' | 'c' | 'b' | 'p' | 's')) {
        log::debug!("[FTP] Invalid permissions first char: {:?}", first_char);
        return None;
    }

    let is_directory = permissions.starts_with('d');
    let is_symlink = permissions.starts_with('l');

    let size: u64 = parts.get(4)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let raw_name = parts[8..].join(" ");

    let (name, symlink_target) = if is_symlink && raw_name.contains(" -> ") {
        let parts_split: Vec<&str> = raw_name.splitn(2, " -> ").collect();
        (parts_split[0].to_string(), Some(parts_split[1].to_string()))
    } else {
        (raw_name, None)
    };

    if name.is_empty() || name == "." || name == ".." {
        return None;
    }

    let file_path = if name.contains('\\') || name.contains('/') {
        if name.starts_with('/') || name.starts_with('\\') {
            name.clone()
        } else if base_path == "/" {
            format!("/{}", name)
        } else {
            format!("{}/{}", base_path.trim_end_matches('/'), name)
        }
    } else {
        if base_path == "/" {
            format!("/{}", name)
        } else {
            format!("{}/{}", base_path.trim_end_matches('/'), name)
        }
    };

    let modified = if parts.len() > 7 {
        Some(format!("{} {} {}", parts[5], parts[6], parts[7]))
    } else {
        None
    };

    let owner = parts.get(2).map(|s| s.to_string());
    let group = parts.get(3).map(|s| s.to_string());

    Some(FileInfo {
        name: name.clone(),
        path: file_path,
        size,
        is_directory,
        is_symlink,
        symlink_target,
        permissions: Some(permissions.to_string()),
        modified,
        owner,
        group,
    })
}
