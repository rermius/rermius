mod core;
mod pty;
mod ssh;
mod sftp;
mod ftp;
mod telnet;
mod managers;
mod terminal;
mod file_watcher;
mod commands;

use tauri::{AppHandle, Manager};
use tauri::menu::{Menu, MenuItem, Submenu};
use managers::{TerminalManager, FileTransferManager};
use file_watcher::FileWatcherManager;
use pty::shell::detect_available_shells;
use commands::window::spawn_new_instance_for_menu;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir { file_name: Some("app.log".into()) },
                ))
                .level(log::LevelFilter::Info)
                .max_file_size(5_000_000)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_handle = app.handle();
            let new_window = MenuItem::with_id(app_handle, "new-window", "New Window", true, None::<&str>)?;
            let window_menu = Submenu::with_items(app_handle, "Window", true, &[&new_window])?;
            let menu = Menu::with_items(app_handle, &[&window_menu])?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|_app, event| {
            if event.id().as_ref() == "new-window" {
                if let Err(e) = spawn_new_instance_for_menu() {
                    eprintln!("Failed to spawn new instance: {}", e);
                }
            }
        })
        .manage(TerminalManager::new())
        .manage(FileTransferManager::new())
        .manage(FileWatcherManager::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            // Terminal commands
            commands::terminal::create_terminal,
            commands::terminal::write_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal,
            commands::terminal::start_terminal_streaming,
            commands::terminal::ping_terminal,
            commands::terminal::execute_terminal_command,
            commands::terminal::fetch_command_history,
            commands::terminal::fetch_local_shell_history,
            // SSH commands
            commands::ssh::create_ssh_session,
            commands::ssh::create_chained_ssh_session,
            // Telnet commands
            commands::telnet::create_telnet_session,
            // Shell detection
            detect_available_shells,
            // File transfer commands
            commands::file_transfer::create_file_session,
            commands::file_transfer::list_directory,
            commands::file_transfer::download_file,
            commands::file_transfer::upload_file,
            commands::file_transfer::test_file_transfer_event,
            commands::file_transfer::create_remote_directory,
            commands::file_transfer::delete_remote_path,
            commands::file_transfer::rename_remote_path,
            commands::file_transfer::rename_local_path,
            commands::file_transfer::close_file_session,
            commands::file_transfer::chmod_remote,
            commands::file_transfer::copy_local_path,
            commands::file_transfer::move_local_path,
            commands::file_transfer::copy_remote_path,
            commands::file_transfer::move_remote_path,
            // File operations
            commands::file_operations::get_local_file_stat,
            commands::file_operations::get_local_file_info,
            commands::file_operations::get_remote_file_stat,
            commands::file_operations::list_windows_drives,
            commands::file_operations::open_file_with_system,
            commands::file_operations::open_file_with_app,
            commands::file_operations::show_open_with_dialog,
            commands::file_operations::show_in_file_manager,
            commands::file_operations::read_file_content,
            commands::file_operations::write_file_content,
            // File watcher
            commands::file_watcher::watch_file,
            commands::file_watcher::unwatch_file,
            // Window management
            commands::window::create_new_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
