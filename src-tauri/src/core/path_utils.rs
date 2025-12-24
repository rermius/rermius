/// Path normalization utilities for file transfer protocols

/// Normalize a path for remote file transfer (SFTP/FTP)
/// 
/// - Replaces backslashes with forward slashes
/// - Removes double slashes
/// - Removes trailing slash except for root path
pub fn normalize_remote_path(path: &str) -> String {
    let mut normalized = path.replace('\\', "/");
    
    // Remove double slashes (keep single leading slash for absolute paths)
    while normalized.contains("//") {
        normalized = normalized.replace("//", "/");
    }
    
    // Remove trailing slash except for root
    if normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    
    normalized
}

