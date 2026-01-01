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

/// Copy file or directory locally (recursive)
#[tauri::command]
pub async fn copy_local_path(
    source_path: String,
    dest_path: String,
) -> Result<(), String> {
    use tokio::fs;

    // Check if source exists
    let metadata = fs::metadata(&source_path)
        .await
        .map_err(|e| format!("Source not found: {}", e))?;

    if metadata.is_dir() {
        // Recursive directory copy
        copy_dir_recursive(&source_path, &dest_path)
            .await
            .map_err(|e| format!("Failed to copy directory: {}", e))
    } else {
        // File copy
        fs::copy(&source_path, &dest_path)
            .await
            .map_err(|e| format!("Failed to copy file: {}", e))?;
        Ok(())
    }
}

/// Move file or directory locally (rename is atomic, fallback to copy+delete)
#[tauri::command]
pub async fn move_local_path(
    source_path: String,
    dest_path: String,
) -> Result<(), String> {
    use tokio::fs;

    // Try atomic rename first (works if on same filesystem)
    match fs::rename(&source_path, &dest_path).await {
        Ok(_) => Ok(()),
        Err(_) => {
            // Fallback: copy then delete (for cross-filesystem moves)
            copy_local_path(source_path.clone(), dest_path).await?;

            let metadata = fs::metadata(&source_path)
                .await
                .map_err(|e| format!("Failed to check source: {}", e))?;

            if metadata.is_dir() {
                fs::remove_dir_all(&source_path)
                    .await
                    .map_err(|e| format!("Failed to remove source directory: {}", e))?;
            } else {
                fs::remove_file(&source_path)
                    .await
                    .map_err(|e| format!("Failed to remove source file: {}", e))?;
            }
            Ok(())
        }
    }
}

/// Helper: Recursive directory copy
async fn copy_dir_recursive(source: &str, dest: &str) -> Result<(), std::io::Error> {
    use tokio::fs;
    use std::path::Path;

    // Create destination directory
    fs::create_dir_all(dest).await?;

    // Read source directory entries
    let mut entries = fs::read_dir(source).await?;

    while let Some(entry) = entries.next_entry().await? {
        let source_path = entry.path();
        let file_name = entry.file_name();
        let dest_path = Path::new(dest).join(&file_name);

        let metadata = entry.metadata().await?;

        if metadata.is_dir() {
            // Recursive copy for subdirectories
            Box::pin(copy_dir_recursive(
                source_path.to_str().unwrap(),
                dest_path.to_str().unwrap()
            )).await?;
        } else {
            // Copy file
            fs::copy(&source_path, &dest_path).await?;
        }
    }

    Ok(())
}

/// Copy file or directory on remote (SFTP/FTP)
#[tauri::command]
pub async fn copy_remote_path(
    session_id: String,
    source_path: String,
    dest_path: String,
    manager: State<'_, FileTransferManager>,
) -> Result<(), String> {
    manager
        .copy_remote(&session_id, &source_path, &dest_path)
        .await
        .map_err(|e| e.to_string())
}

/// Move file or directory on remote (uses rename from trait)
#[tauri::command]
pub async fn move_remote_path(
    session_id: String,
    source_path: String,
    dest_path: String,
    manager: State<'_, FileTransferManager>,
) -> Result<(), String> {
    // Reuse existing rename command (rename = move in SFTP/FTP)
    manager
        .rename(&session_id, &source_path, &dest_path)
        .await
        .map_err(|e| e.to_string())
}

