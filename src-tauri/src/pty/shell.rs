use std::path::Path;

/// Shell option with availability status
#[derive(serde::Serialize)]
pub struct ShellOption {
    pub label: String,
    pub value: String,
    pub available: bool,
}

/// Cross-platform shell detection
/// Returns the default shell path for the current operating system
pub fn get_default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        // On Windows, use PowerShell as default
        "powershell.exe".to_string()
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, default to zsh (Catalina+)
        std::env::var("SHELL")
            .unwrap_or_else(|_| "/bin/zsh".to_string())
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, default to bash
        std::env::var("SHELL")
            .unwrap_or_else(|_| "/bin/bash".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        // Fallback for other Unix-like systems
        std::env::var("SHELL")
            .unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

/// Check if a shell executable exists
fn check_shell_exists(path: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        // Check if executable exists in PATH or as absolute path
        if Path::new(path).exists() {
            return true;
        }

        // Check in PATH
        if let Ok(path_var) = std::env::var("PATH") {
            for dir in std::env::split_paths(&path_var) {
                let full_path = dir.join(path);
                if full_path.exists() {
                    return true;
                }
            }
        }

        false
    }

    #[cfg(not(target_os = "windows"))]
    {
        Path::new(path).exists()
    }
}

/// Detect available shells on the system
/// Returns a list of shells with their availability status
#[tauri::command]
pub fn detect_available_shells() -> Vec<ShellOption> {
    let mut shells = Vec::new();

    #[cfg(target_os = "windows")]
    {
        shells.push(ShellOption {
            label: "PowerShell".to_string(),
            value: "powershell.exe".to_string(),
            available: check_shell_exists("powershell.exe"),
        });

        shells.push(ShellOption {
            label: "Git Bash".to_string(),
            value: "C:\\Program Files\\Git\\bin\\bash.exe".to_string(),
            available: check_shell_exists("C:\\Program Files\\Git\\bin\\bash.exe"),
        });

        shells.push(ShellOption {
            label: "Command Prompt".to_string(),
            value: "cmd.exe".to_string(),
            available: check_shell_exists("cmd.exe"),
        });

        shells.push(ShellOption {
            label: "WSL".to_string(),
            value: "wsl.exe".to_string(),
            available: check_shell_exists("wsl.exe"),
        });
    }

    #[cfg(target_os = "macos")]
    {
        shells.push(ShellOption {
            label: "Zsh".to_string(),
            value: "/bin/zsh".to_string(),
            available: check_shell_exists("/bin/zsh"),
        });

        shells.push(ShellOption {
            label: "Bash".to_string(),
            value: "/bin/bash".to_string(),
            available: check_shell_exists("/bin/bash"),
        });
    }

    #[cfg(target_os = "linux")]
    {
        shells.push(ShellOption {
            label: "Bash".to_string(),
            value: "/bin/bash".to_string(),
            available: check_shell_exists("/bin/bash"),
        });

        shells.push(ShellOption {
            label: "Zsh".to_string(),
            value: "/bin/zsh".to_string(),
            available: check_shell_exists("/bin/zsh"),
        });

        shells.push(ShellOption {
            label: "Fish".to_string(),
            value: "/usr/bin/fish".to_string(),
            available: check_shell_exists("/usr/bin/fish"),
        });
    }

    shells
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_default_shell() {
        let shell = get_default_shell();
        assert!(!shell.is_empty(), "Shell path should not be empty");

        #[cfg(target_os = "windows")]
        assert!(
            shell.contains("powershell") || shell.contains("cmd"),
            "Windows should use PowerShell or CMD"
        );

        #[cfg(any(target_os = "macos", target_os = "linux"))]
        assert!(
            shell.starts_with('/'),
            "Unix shells should have absolute paths"
        );
    }
}
