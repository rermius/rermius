use tauri::{AppHandle, State, Emitter};
use crate::managers::{FileTransferManager, FileSessionConfig, FileInfoDto};

/// Create a new file transfer session (SFTP/FTP/FTPS)
#[tauri::command]
pub async fn create_file_session(
    config: FileSessionConfig,
    manager: State<'_, FileTransferManager>,
    app_handle: AppHandle,
) -> Result<String, String> {
    manager.create_session(config, app_handle).await.map_err(|e| e.to_string())
}

/// List directory contents
#[tauri::command]
pub async fn list_directory(
    session_id: String,
    path: String,
    manager: State<'_, FileTransferManager>,
) -> Result<Vec<FileInfoDto>, String> {
    manager.list_directory(&session_id, &path).await.map_err(|e| e.to_string())
}

/// Download file from remote to local
#[tauri::command]
pub async fn download_file(
    app_handle: tauri::AppHandle,
    session_id: String,
    remote_path: String,
    local_path: String,
    transfer_id: String,
    manager: State<'_, FileTransferManager>,
) -> Result<(), String> {
    manager
        .download_file(&app_handle, &session_id, &remote_path, &local_path, &transfer_id)
        .await
        .map_err(|e| e.to_string())
}

/// Upload file from local to remote
#[tauri::command]
pub async fn upload_file(
    app_handle: tauri::AppHandle,
    session_id: String,
    local_path: String,
    remote_path: String,
    transfer_id: String,
    manager: State<'_, FileTransferManager>,
) -> Result<(), String> {
    manager
        .upload_file(&app_handle, &session_id, &local_path, &remote_path, &transfer_id)
        .await
        .map_err(|e| e.to_string())
}

/// Test event emission (for debugging)
#[tauri::command]
pub async fn test_file_transfer_event(app_handle: tauri::AppHandle) -> Result<(), String> {
    use serde_json::json;
    log::info!("[Test] Emitting test event");
    if let Err(e) = app_handle.emit("file-transfer-progress", &json!({
        "sessionId": "test",
        "direction": "upload",
        "localPath": "test/path",
        "remotePath": "test/remote",
        "fileName": "test.txt",
        "bytesTransferred": 100,
        "totalBytes": 200,
        "done": false
    })) {
        log::error!("[Test] Failed to emit test event: {}", e);
        Err(format!("Failed to emit test event: {}", e))
    } else {
        log::info!("[Test] Successfully emitted test event");
        Ok(())
    }
}

/// Create directory on remote
#[tauri::command]
pub async fn create_remote_directory(
    session_id: String,
    path: String,
    manager: State<'_, FileTransferManager>,
) -> Result<(), String> {
    manager.create_directory(&session_id, &path).await.map_err(|e| e.to_string())
}

/// Delete file or directory on remote
#[tauri::command]
pub async fn delete_remote_path(
    session_id: String,
    path: String,
    is_directory: bool,
    manager: State<'_, FileTransferManager>,
) -> Result<(), String> {
    manager.delete(&session_id, &path, is_directory).await.map_err(|e| e.to_string())
}

/// Rename file or directory on remote
#[tauri::command]
pub async fn rename_remote_path(
    session_id: String,
    old_path: String,
    new_path: String,
    manager: State<'_, FileTransferManager>,
) -> Result<(), String> {
    manager.rename(&session_id, &old_path, &new_path).await.map_err(|e| e.to_string())
}

/// Rename file or directory locally
#[tauri::command]
pub async fn rename_local_path(
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    use tokio::fs;
    fs::rename(&old_path, &new_path)
        .await
        .map_err(|e| format!("Failed to rename: {}", e))
}

/// Close file transfer session
#[tauri::command]
pub async fn close_file_session(
    session_id: String,
    manager: State<'_, FileTransferManager>,
) -> Result<(), String> {
    manager.close_session(&session_id).await.map_err(|e| e.to_string())
}

/// Change file permissions (SFTP only)
#[tauri::command]
pub async fn chmod_remote(
    session_id: String,
    path: String,
    mode: u32,
    manager: State<'_, FileTransferManager>,
) -> Result<(), String> {
    manager.chmod(&session_id, &path, mode).await.map_err(|e| e.to_string())
}

