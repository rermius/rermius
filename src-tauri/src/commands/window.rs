use tauri::AppHandle;
use log::info;

fn spawn_new_instance() -> Result<(), String> {
    use std::process::Command;
    
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    
    Command::new(&exe_path)
        .spawn()
        .map_err(|e| format!("Failed to spawn new process: {}", e))?;
    
    info!("Spawned new application instance");
    Ok(())
}

/// Create a new window (spawns new instance)
#[tauri::command]
pub async fn create_new_window(_app_handle: AppHandle) -> Result<(), String> {
    spawn_new_instance()
}

pub fn spawn_new_instance_for_menu() -> Result<(), String> {
    spawn_new_instance()
}

