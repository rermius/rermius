//! Telnet Tauri commands

use tauri::{AppHandle, State};
use crate::managers::TerminalManager;

/// Create a new Telnet session
#[tauri::command]
pub async fn create_telnet_session(
    hostname: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
    manager: State<'_, TerminalManager>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let cols = cols.unwrap_or(80);
    let rows = rows.unwrap_or(24);

    manager
        .create_telnet_session(hostname, port, username, password, cols, rows, app_handle)
        .await
}
