use std::path::PathBuf;

/// Parse history output from either shell commands or history files
/// Supports:
/// - "  123  command" (bash `history` style)
/// - "command" (plain line)
/// - ": timestamp:0;command" (zsh extended history)
pub fn parse_history_output(output: &str) -> Vec<String> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }

            if line.chars().next().map(|c| c.is_numeric()).unwrap_or(false) {
                let parts: Vec<&str> = line.splitn(2, char::is_whitespace).collect();
                if parts.len() >= 2 {
                    return Some(parts[1].trim().to_string());
                }
            }

            if line.starts_with(':') && line.contains(';') {
                if let Some(idx) = line.find(';') {
                    let cmd = line[idx + 1..].trim();
                    if !cmd.is_empty() {
                        return Some(cmd.to_string());
                    }
                }
            }

            Some(line.to_string())
        })
        .collect()
}

fn get_home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            return Some(PathBuf::from(userprofile));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Some(PathBuf::from(home));
        }
    }

    None
}

fn detect_local_history_files(shell: Option<&str>) -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    let home = match get_home_dir() {
        Some(h) => h,
        None => return candidates,
    };

    let bash_hist = home.join(".bash_history");
    let zsh_hist = home.join(".zsh_history");

    if let Some(shell) = shell {
        let shell_lower = shell.to_lowercase();
        if shell_lower.contains("bash") {
            candidates.push(bash_hist.clone());
        } else if shell_lower.contains("zsh") {
            candidates.push(zsh_hist.clone());
        }
    }

    if !candidates.iter().any(|p| p.ends_with(".bash_history")) {
        candidates.push(bash_hist);
    }
    if !candidates.iter().any(|p| p.ends_with(".zsh_history")) {
        candidates.push(zsh_hist);
    }

    candidates
}

fn read_local_history_from_file(path: &PathBuf, limit: u32) -> Result<Vec<String>, String> {
    use std::fs;
    use std::io::{BufRead, BufReader};

    let file = fs::File::open(path)
        .map_err(|e| format!("Failed to read history file {}: {}", path.display(), e))?;

    let reader = BufReader::new(file);
    let mut lines: Vec<String> = Vec::new();

    for line_result in reader.lines() {
        if let Ok(line) = line_result {
            let valid_chars = line.chars().filter(|c| c.is_ascii() || !c.is_control()).count();
            if valid_chars > 0 && valid_chars * 2 > line.len() {
                lines.push(line);
            }
        }
    }

    let start = lines.len().saturating_sub(limit as usize);
    let limited = lines[start..].join("\n");
    Ok(parse_history_output(&limited))
}

/// Read local shell history directly from history files on the system
pub fn read_local_shell_history(shell: Option<String>, limit: u32) -> Result<Vec<String>, String> {
    let candidates = detect_local_history_files(shell.as_deref());
    
    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    for path in candidates.iter() {
        match read_local_history_from_file(path, limit) {
            Ok(history) if !history.is_empty() => {
                return Ok(history);
            }
            Ok(_) | Err(_) => continue,
        }
    }

    Ok(Vec::new())
}

