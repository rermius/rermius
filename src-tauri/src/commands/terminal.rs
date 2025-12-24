use tauri::{AppHandle, State};
use crate::managers::TerminalManager;
use crate::core::history::parse_history_output;
use tokio::time::{timeout, Duration};

/// Create a new terminal session
#[tauri::command]
pub async fn create_terminal(
    shell: Option<String>,
    cols: u16,
    rows: u16,
    manager: State<'_, TerminalManager>,
    app_handle: AppHandle,
) -> Result<String, String> {
    manager
        .create_local_session(shell, cols, rows, app_handle)
        .await
}

/// Write data to a terminal session
#[tauri::command]
pub async fn write_terminal(
    session_id: String,
    data: String,
    manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    manager.write_to_session(&session_id, data.as_bytes()).await
}

/// Resize a terminal session
#[tauri::command]
pub async fn resize_terminal(
    session_id: String,
    cols: u16,
    rows: u16,
    manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    manager.resize_session(&session_id, cols, rows).await
}

/// Close a terminal session
#[tauri::command]
pub async fn close_terminal(
    session_id: String,
    manager: State<'_, TerminalManager>,
    app_handle: AppHandle,
) -> Result<(), String> {
    manager.close_session(&session_id, &app_handle).await
}

/// Start streaming for a terminal session (call after FE listener is ready)
#[tauri::command]
pub async fn start_terminal_streaming(
    session_id: String,
    manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    manager.start_streaming(&session_id).await
}

/// Ping a terminal session (keepalive check)
#[tauri::command]
pub async fn ping_terminal(
    session_id: String,
    manager: State<'_, TerminalManager>,
) -> Result<bool, String> {
    manager.ping_session(&session_id).await
}

/// Execute a command on a terminal session and return output (SSH only)
#[tauri::command]
pub async fn execute_terminal_command(
    session_id: String,
    command: String,
    manager: State<'_, TerminalManager>,
) -> Result<String, String> {
    manager.execute_command(&session_id, &command).await
}

/// Fetch command history from an SSH session
#[tauri::command]
pub async fn fetch_command_history(
    session_id: String,
    limit: Option<u32>,
    manager: State<'_, TerminalManager>,
) -> Result<Vec<String>, String> {
    let limit = limit.unwrap_or(100);

    let commands_to_try = vec![
        format!("tail -n {} ~/.bash_history 2>/dev/null", limit),
        format!("tail -n {} ~/.zsh_history 2>/dev/null | cut -d ';' -f 2-", limit),
        format!("HISTFILE=~/.bash_history bash -c 'set -o history; history -r; history {}' 2>/dev/null", limit),
        format!("fc -l -{} 2>/dev/null", limit),
    ];

    for (idx, command) in commands_to_try.iter().enumerate() {
        log::info!("[fetch_command_history] Attempt {}: {}", idx + 1, command);
        let attempt_start = std::time::Instant::now();

        match timeout(
            Duration::from_secs(1),
            manager.execute_command(&session_id, command)
        ).await {
            Ok(Ok(output)) => {
                let elapsed = attempt_start.elapsed();
                log::info!(
                    "[fetch_command_history] Attempt {} completed in {:?}, output length: {} bytes",
                    idx + 1,
                    elapsed,
                    output.len()
                );

                if !output.trim().is_empty() {
                    log::debug!("[fetch_command_history] Raw output:\n{}", output);

                    let history: Vec<String> = parse_history_output(&output);

                    log::info!(
                        "[fetch_command_history] Parsed {} history entries using method {}",
                        history.len(),
                        idx + 1
                    );

                    if !history.is_empty() {
                        return Ok(history);
                    }
                }
            }
            Ok(Err(e)) => {
                let elapsed = attempt_start.elapsed();
                log::debug!(
                    "[fetch_command_history] Attempt {} failed after {:?}: {}",
                    idx + 1,
                    elapsed,
                    e
                );
            }
            Err(_) => {
                let elapsed = attempt_start.elapsed();
                log::warn!(
                    "[fetch_command_history] Attempt {} timeout after {:?}: {}",
                    idx + 1,
                    elapsed,
                    command
                );
            }
        }
    }

    log::warn!("[fetch_command_history] All methods failed to fetch history");
    Ok(Vec::new())
}

/// Fetch command history from the local shell by reading history files directly
#[tauri::command]
pub async fn fetch_local_shell_history(
    shell: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<String>, String> {
    let limit = limit.unwrap_or(100);

    tauri::async_runtime::spawn_blocking(move || crate::core::history::read_local_shell_history(shell, limit))
        .await
        .map_err(|e| format!("Failed to join history task: {}", e))?
}

