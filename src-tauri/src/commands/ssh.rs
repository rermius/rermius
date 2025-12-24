use tauri::{AppHandle, State};
use crate::managers::TerminalManager;
use crate::ssh::config::HostConfigInput;

/// Create a new SSH session
#[tauri::command]
pub async fn create_ssh_session(
    hostname: String,
    port: u16,
    username: String,
    auth_method: String,
    key_path: Option<String>,
    password: Option<String>,
    _connection_type: Option<String>,
    manager: State<'_, TerminalManager>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let cols = 80;
    let rows = 24;

    manager
        .create_ssh_session(
            hostname,
            port,
            username,
            auth_method,
            key_path,
            password,
            cols,
            rows,
            app_handle,
        )
        .await
}

/// Create a chained SSH session through jump hosts (ProxyJump)
#[tauri::command]
pub async fn create_chained_ssh_session(
    chain: Vec<HostConfigInput>,
    cols: u16,
    rows: u16,
    _connection_type: Option<String>,
    manager: State<'_, TerminalManager>,
    app_handle: AppHandle,
) -> Result<String, String> {
    if chain.is_empty() {
        return Err("Chain cannot be empty".to_string());
    }

    let chain: Vec<_> = chain
        .into_iter()
        .map(|h| h.into_host_config())
        .collect::<Result<Vec<_>, _>>()?;

    manager
        .create_chained_ssh_session(chain, cols, rows, app_handle)
        .await
}

