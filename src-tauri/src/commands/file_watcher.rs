use tauri::{AppHandle, State};
use crate::file_watcher::FileWatcherManager;

/// Start watching a file for changes
#[tauri::command]
pub fn watch_file(
    path: String,
    app_handle: AppHandle,
    watcher_manager: State<'_, FileWatcherManager>,
) -> Result<(), String> {
    watcher_manager.watch_file(path, app_handle)
}

/// Stop watching a file
#[tauri::command]
pub fn unwatch_file(
    path: String,
    watcher_manager: State<'_, FileWatcherManager>,
) -> Result<(), String> {
    watcher_manager.unwatch_file(&path)
}

