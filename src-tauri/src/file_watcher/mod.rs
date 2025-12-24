use notify::{Watcher, RecursiveMode, Result as NotifyResult, Event, EventKind};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use log::{info, error};

const DEBOUNCE_MS: u128 = 500; // Debounce time in milliseconds

pub struct FileWatcherManager {
    watchers: Arc<Mutex<HashMap<String, notify::RecommendedWatcher>>>,
    last_event: Arc<Mutex<HashMap<String, Instant>>>,
}

impl FileWatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
            last_event: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn watch_file(&self, path: String, app_handle: AppHandle) -> Result<(), String> {
        let path_buf = PathBuf::from(&path);
        
        if !path_buf.exists() {
            return Err(format!("File does not exist: {}", path));
        }

        let app_handle_clone = app_handle.clone();
        let path_clone = path.clone();
        let last_event = Arc::clone(&self.last_event);

        let mut watcher = notify::recommended_watcher(move |res: NotifyResult<Event>| {
            match res {
                Ok(event) => {
                    // Only emit on modify events (save)
                    if matches!(event.kind, EventKind::Modify(_)) {
                        // Debounce: check if we recently emitted for this file
                        let mut last_events = last_event.lock().unwrap();
                        let now = Instant::now();
                        
                        if let Some(last) = last_events.get(&path_clone) {
                            if now.duration_since(*last).as_millis() < DEBOUNCE_MS {
                                // Skip - too soon after last event
                                return;
                            }
                        }
                        
                        // Update last event time
                        last_events.insert(path_clone.clone(), now);
                        drop(last_events); // Release lock before emit
                        
                        info!("[FileWatcher] File modified: {:?}", path_clone);
                        if let Err(e) = app_handle_clone.emit("file-changed", &path_clone) {
                            error!("[FileWatcher] Failed to emit event: {}", e);
                        }
                    }
                }
                Err(e) => error!("[FileWatcher] Watch error: {:?}", e),
            }
        })
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher
            .watch(&path_buf, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch file: {}", e))?;

        let mut watchers = self.watchers.lock().unwrap();
        watchers.insert(path.clone(), watcher);

        info!("[FileWatcher] Started watching: {}", path);
        Ok(())
    }

    pub fn unwatch_file(&self, path: &str) -> Result<(), String> {
        let mut watchers = self.watchers.lock().unwrap();
        
        if let Some(mut watcher) = watchers.remove(path) {
            let path_buf = PathBuf::from(path);
            watcher
                .unwatch(&path_buf)
                .map_err(|e| format!("Failed to unwatch file: {}", e))?;
            
            info!("[FileWatcher] Stopped watching: {}", path);
            Ok(())
        } else {
            Err(format!("No watcher found for path: {}", path))
        }
    }

    pub fn unwatch_all(&self) {
        let mut watchers = self.watchers.lock().unwrap();
        watchers.clear();
        info!("[FileWatcher] Stopped watching all files");
    }
}

