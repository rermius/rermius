use tauri::{AppHandle, State};
use crate::managers::FileTransferManager;

/// Get file stat/info (local)
#[tauri::command]
pub async fn get_local_file_stat(path: String) -> Result<serde_json::Value, String> {
    use tokio::fs;
    use std::time::UNIX_EPOCH;
    
    let metadata = fs::metadata(&path)
        .await
        .map_err(|e| format!("Failed to get file stat: {}", e))?;
    
    let modified = metadata.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    
    let accessed = metadata.accessed()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    
    #[cfg(unix)]
    let permissions: Option<u32> = {
        use std::os::unix::fs::PermissionsExt;
        Some(metadata.permissions().mode())
    };
    
    #[cfg(not(unix))]
    let permissions: Option<u32> = None;
    
    Ok(serde_json::json!({
        "size": metadata.len(),
        "isDirectory": metadata.is_dir(),
        "isFile": metadata.is_file(),
        "modified": modified,
        "accessed": accessed,
        "permissions": permissions.map(|p| format!("{:o}", p)),
        "mode": permissions
    }))
}

/// Get local file info including symlink detection
/// Uses symlink_metadata to detect symlinks without following them
#[tauri::command]
pub async fn get_local_file_info(path: String) -> Result<serde_json::Value, String> {
    use std::fs;
    use std::time::UNIX_EPOCH;

    // Use symlink_metadata to not follow symlinks
    let metadata = fs::symlink_metadata(&path)
        .map_err(|e| format!("Failed to get file info: {}", e))?;

    let is_symlink = metadata.file_type().is_symlink();

    // Get symlink target if applicable
    let symlink_target = if is_symlink {
        fs::read_link(&path)
            .ok()
            .map(|p| p.to_string_lossy().to_string())
    } else {
        None
    };

    // For symlinks, also get the target's metadata to determine if it points to a directory
    let target_is_directory = if is_symlink {
        fs::metadata(&path).map(|m| m.is_dir()).unwrap_or(false)
    } else {
        metadata.is_dir()
    };

    let modified = metadata.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    #[cfg(unix)]
    let permissions: Option<u32> = {
        use std::os::unix::fs::PermissionsExt;
        Some(metadata.permissions().mode())
    };

    #[cfg(not(unix))]
    let permissions: Option<u32> = None;

    Ok(serde_json::json!({
        "size": metadata.len(),
        "isDirectory": target_is_directory,
        "isFile": metadata.is_file(),
        "isSymlink": is_symlink,
        "symlinkTarget": symlink_target,
        "modified": modified,
        "permissions": permissions.map(|p| format!("{:o}", p))
    }))
}

/// Convert Unix permissions string (e.g., "drwxr-xr-x") to octal mode
fn parse_permissions_string(perm_str: &str) -> Option<u32> {
    log::debug!("[get_remote_file_stat] Parsing permissions string: {}", perm_str);
    
    if perm_str.len() < 10 {
        log::debug!("[get_remote_file_stat] Permissions string too short: {}", perm_str.len());
        return None;
    }
    
    let perm_chars: Vec<char> = perm_str.chars().skip(1).take(9).collect();
    if perm_chars.len() != 9 {
        log::debug!("[get_remote_file_stat] Permissions chars length != 9: {}", perm_chars.len());
        return None;
    }
    
    let mut mode = 0u32;
    
    if perm_chars[0] == 'r' { mode |= 0o400; }
    if perm_chars[1] == 'w' { mode |= 0o200; }
    if perm_chars[2] == 'x' || perm_chars[2] == 's' || perm_chars[2] == 'S' { mode |= 0o100; }
    
    if perm_chars[3] == 'r' { mode |= 0o040; }
    if perm_chars[4] == 'w' { mode |= 0o020; }
    if perm_chars[5] == 'x' || perm_chars[5] == 's' || perm_chars[5] == 'S' { mode |= 0o010; }
    
    if perm_chars[6] == 'r' { mode |= 0o004; }
    if perm_chars[7] == 'w' { mode |= 0o002; }
    if perm_chars[8] == 'x' || perm_chars[8] == 't' || perm_chars[8] == 'T' { mode |= 0o001; }
    
    log::debug!("[get_remote_file_stat] Parsed mode: {:o} from permissions: {}", mode, perm_str);
    Some(mode)
}

/// Get file stat/info (remote)
#[tauri::command]
pub async fn get_remote_file_stat(
    session_id: String,
    path: String,
    manager: State<'_, FileTransferManager>,
) -> Result<serde_json::Value, String> {
    let stat = manager.stat(&session_id, &path).await
        .map_err(|e| format!("Failed to get file stat: {}", e))?;
    
    log::debug!("[get_remote_file_stat] File: {}, permissions: {:?}", path, stat.permissions);
    let mode = stat.permissions.as_ref().and_then(|p| {
        log::debug!("[get_remote_file_stat] Attempting to parse permissions: {}", p);
        if let Ok(m) = u32::from_str_radix(p.trim_start_matches("0o"), 8) {
            log::debug!("[get_remote_file_stat] Parsed as octal: {:o}", m);
            Some(m & 0o777)
        } else {
            log::debug!("[get_remote_file_stat] Not octal, trying permissions string");
            parse_permissions_string(p)
        }
    });
    log::debug!("[get_remote_file_stat] Final mode: {:?}", mode);
    
    Ok(serde_json::json!({
        "size": stat.size,
        "isDirectory": stat.is_directory,
        "isFile": !stat.is_directory,
        "modified": stat.modified,
        "accessed": null,
        "permissions": stat.permissions,
        "mode": mode,
        "owner": stat.owner,
        "group": stat.group
    }))
}

/// List Windows drives (C:, D:, E:, etc.)
/// Returns empty array on non-Windows systems
#[tauri::command]
pub async fn list_windows_drives() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use log::info;
        
        let output = Command::new("powershell.exe")
            .args(&[
                "-Command",
                "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"
            ])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
        
        if !output.status.success() {
            return Err(format!("PowerShell command failed: {}", 
                String::from_utf8_lossy(&output.stderr)));
        }
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let drives: Vec<String> = stdout
            .lines()
            .map(|line| line.trim().to_string())
            .filter(|line| {
                line.len() == 3 && line.ends_with('\\') && line.chars().next().unwrap().is_ascii_alphabetic()
            })
            .map(|drive| {
                drive[..2].to_string()
            })
            .collect();
        
        info!("Found {} Windows drives: {:?}", drives.len(), drives);
        Ok(drives)
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec![])
    }
}

/// Open file with system default app (local only)
#[tauri::command]
pub async fn open_file_with_system(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open file: {}", e))
}

/// Open file with specific application
#[tauri::command]
pub async fn open_file_with_app(path: String, app_path: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(app) = app_path {
            std::process::Command::new(&app)
                .arg(&path)
                .spawn()
                .map_err(|e| format!("Failed to open file with {}: {}", app, e))?;
        } else {
            std::process::Command::new("rundll32.exe")
                .args(&["shell32.dll", "OpenAs_RunDLL", &path])
                .spawn()
                .map_err(|e| format!("Failed to open file dialog: {}", e))?;
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        if let Some(app) = app_path {
            std::process::Command::new("open")
                .args(&["-a", &app, &path])
                .spawn()
                .map_err(|e| format!("Failed to open file with {}: {}", app, e))?;
        } else {
            open::that(&path).map_err(|e| format!("Failed to open file: {}", e))?;
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        if let Some(app) = app_path {
            std::process::Command::new("xdg-open")
                .arg(&path)
                .env("DESKTOP_STARTUP_ID", "")
                .spawn()
                .map_err(|e| format!("Failed to open file with {}: {}", app, e))?;
        } else {
            open::that(&path).map_err(|e| format!("Failed to open file: {}", e))?;
        }
    }
    
    Ok(())
}

/// Show file picker dialog to select application
#[tauri::command]
pub async fn show_open_with_dialog(
    app_handle: AppHandle,
    _path: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::mpsc;
    
    let (tx, rx) = mpsc::channel();
    
    #[cfg(target_os = "windows")]
    {
        app_handle
            .dialog()
            .file()
            .set_title("Select Application")
            .add_filter("Executable", &["exe", "bat", "cmd"])
            .pick_file(move |file_path_opt| {
                let result = file_path_opt.and_then(|p| {
                    p.as_path()
                        .and_then(|path| path.to_str())
                        .map(|s| s.to_string())
                });
                let _ = tx.send(result);
            });
    }
    
    #[cfg(target_os = "macos")]
    {
        app_handle
            .dialog()
            .file()
            .set_title("Select Application")
            .add_filter("Application", &["app"])
            .pick_file(move |file_path_opt| {
                let result = file_path_opt.and_then(|p| {
                    p.as_path()
                        .and_then(|path| path.to_str())
                        .map(|s| s.to_string())
                });
                let _ = tx.send(result);
            });
    }
    
    #[cfg(target_os = "linux")]
    {
        app_handle
            .dialog()
            .file()
            .set_title("Select Application")
            .add_filter("Executable", &["bin", "sh", "run"])
            .pick_file(move |file_path_opt| {
                let result = file_path_opt.and_then(|p| {
                    p.as_path()
                        .and_then(|path| path.to_str())
                        .map(|s| s.to_string())
                });
                let _ = tx.send(result);
            });
    }
    
    use std::time::Duration;
    match rx.recv_timeout(Duration::from_secs(300)) {
        Ok(result) => Ok(result),
        Err(_) => Ok(None),
    }
}

/// Show file in system file manager (local only)
#[tauri::command]
pub async fn show_in_file_manager(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(&["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to show in Explorer: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(&["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to show in Finder: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        let parent = std::path::Path::new(&path)
            .parent()
            .and_then(|p| p.to_str())
            .unwrap_or(&path);
        
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| format!("Failed to show in file manager: {}", e))?;
    }
    
    Ok(())
}

/// Read file content for editing (small files)
#[tauri::command]
pub async fn read_file_content(
    session_id: Option<String>,
    path: String,
    is_local: bool,
    manager: State<'_, FileTransferManager>,
) -> Result<String, String> {
    if is_local {
        tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| format!("Failed to read local file: {}", e))
    } else {
        let session_id = session_id.ok_or("No session ID provided for remote file")?;
        let content = manager.read_file(&session_id, &path).await
            .map_err(|e| e.to_string())?;
        String::from_utf8(content).map_err(|e| format!("Failed to decode file content: {}", e))
    }
}

/// Write file content after editing
#[tauri::command]
pub async fn write_file_content(
    session_id: Option<String>,
    path: String,
    content: String,
    is_local: bool,
    manager: State<'_, FileTransferManager>,
) -> Result<(), String> {
    if is_local {
        tokio::fs::write(&path, content.as_bytes())
            .await
            .map_err(|e| format!("Failed to write local file: {}", e))
    } else {
        let session_id = session_id.ok_or("No session ID provided for remote file")?;
        manager.write_file(&session_id, &path, content.as_bytes()).await
            .map_err(|e| e.to_string())
    }
}

