//! Auto-login state machine for Telnet connections
//!
//! This module handles automatic detection of login and password prompts
//! and sends saved credentials when detected.

/// Login prompt detection patterns (case-insensitive)
const LOGIN_PATTERNS: &[&str] = &[
    "login:",
    "username:",
    "user:",
    "user name:",
    "login name:",
    "account:",
    "logon:",
];

/// Password prompt detection patterns (case-insensitive)
const PASSWORD_PATTERNS: &[&str] = &[
    "password:",
    "passwd:",
    "pass:",
    "secret:",
];

/// Auto-login state machine
#[derive(Debug, Clone, PartialEq)]
pub enum LoginState {
    /// Waiting for login prompt (if username provided)
    AwaitingLogin,
    /// Waiting for password prompt (after sending username)
    AwaitingPassword,
    /// Authentication complete or disabled
    Authenticated,
    /// Auto-login disabled (no credentials provided)
    Disabled,
}

/// Type of prompt detected
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PromptType {
    Login,
    Password,
}

/// Auto-login handler
#[derive(Debug, Clone)]
pub struct AutoLogin {
    /// Current state
    pub state: LoginState,
    /// Username to send (if any)
    username: Option<String>,
    /// Password to send (if any)
    password: Option<String>,
    /// Buffer for accumulating data to detect prompts
    buffer: String,
    /// Maximum buffer size to prevent memory issues
    max_buffer_size: usize,
}

impl AutoLogin {
    /// Create a new auto-login handler
    pub fn new(username: Option<String>, password: Option<String>) -> Self {
        let state = if username.is_some() {
            LoginState::AwaitingLogin
        } else {
            LoginState::Disabled
        };

        Self {
            state,
            username,
            password,
            buffer: String::with_capacity(256),
            max_buffer_size: 1024,
        }
    }

    /// Process incoming data and check for login/password prompts
    /// Returns bytes to send if a response is needed (username or password + newline)
    pub fn process(&mut self, data: &str) -> Option<Vec<u8>> {
        // If disabled or authenticated, don't process
        if self.state == LoginState::Disabled || self.state == LoginState::Authenticated {
            return None;
        }

        // Add data to buffer
        self.buffer.push_str(data);

        // Truncate buffer if too large (keep the tail)
        if self.buffer.len() > self.max_buffer_size {
            let start = self.buffer.len() - self.max_buffer_size / 2;
            self.buffer = self.buffer[start..].to_string();
        }

        // Check for prompts based on current state
        match self.state {
            LoginState::AwaitingLogin => {
                if let Some(PromptType::Login) = detect_prompt(&self.buffer) {
                    // Found login prompt, send username
                    if let Some(ref username) = self.username {
                        let response = format!("{}\r\n", username);
                        self.state = if self.password.is_some() {
                            LoginState::AwaitingPassword
                        } else {
                            LoginState::Authenticated
                        };
                        self.buffer.clear();
                        return Some(response.into_bytes());
                    }
                }
            }
            LoginState::AwaitingPassword => {
                if let Some(PromptType::Password) = detect_prompt(&self.buffer) {
                    // Found password prompt, send password
                    if let Some(ref password) = self.password {
                        let response = format!("{}\r\n", password);
                        self.state = LoginState::Authenticated;
                        self.buffer.clear();
                        return Some(response.into_bytes());
                    }
                }
            }
            _ => {}
        }

        None
    }

    /// Check if auto-login is complete
    pub fn is_complete(&self) -> bool {
        matches!(self.state, LoginState::Authenticated | LoginState::Disabled)
    }

    /// Reset the auto-login state (for reconnection)
    pub fn reset(&mut self) {
        self.buffer.clear();
        self.state = if self.username.is_some() {
            LoginState::AwaitingLogin
        } else {
            LoginState::Disabled
        };
    }
}

/// Detect if the buffer contains a login or password prompt
fn detect_prompt(buffer: &str) -> Option<PromptType> {
    let lower = buffer.to_lowercase();

    // Check password patterns first (more specific)
    for pattern in PASSWORD_PATTERNS {
        if lower.contains(pattern) {
            return Some(PromptType::Password);
        }
    }

    // Check login patterns
    for pattern in LOGIN_PATTERNS {
        if lower.contains(pattern) {
            return Some(PromptType::Login);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_login_prompt() {
        assert_eq!(detect_prompt("login: "), Some(PromptType::Login));
        assert_eq!(detect_prompt("Username: "), Some(PromptType::Login));
        assert_eq!(detect_prompt("User: "), Some(PromptType::Login));
    }

    #[test]
    fn test_detect_password_prompt() {
        assert_eq!(detect_prompt("Password: "), Some(PromptType::Password));
        assert_eq!(detect_prompt("password:"), Some(PromptType::Password));
    }

    #[test]
    fn test_no_prompt() {
        assert_eq!(detect_prompt("Hello World"), None);
        assert_eq!(detect_prompt("Connected to server"), None);
    }

    #[test]
    fn test_auto_login_disabled() {
        let mut login = AutoLogin::new(None, None);
        assert_eq!(login.state, LoginState::Disabled);
        assert!(login.process("login: ").is_none());
    }

    #[test]
    fn test_auto_login_username_only() {
        let mut login = AutoLogin::new(Some("admin".to_string()), None);
        assert_eq!(login.state, LoginState::AwaitingLogin);

        let response = login.process("login: ");
        assert_eq!(response, Some(b"admin\r\n".to_vec()));
        assert_eq!(login.state, LoginState::Authenticated);
    }

    #[test]
    fn test_auto_login_full() {
        let mut login = AutoLogin::new(Some("admin".to_string()), Some("secret".to_string()));
        assert_eq!(login.state, LoginState::AwaitingLogin);

        // Send username
        let response = login.process("login: ");
        assert_eq!(response, Some(b"admin\r\n".to_vec()));
        assert_eq!(login.state, LoginState::AwaitingPassword);

        // Send password
        let response = login.process("Password: ");
        assert_eq!(response, Some(b"secret\r\n".to_vec()));
        assert_eq!(login.state, LoginState::Authenticated);
    }

    #[test]
    fn test_case_insensitive() {
        assert_eq!(detect_prompt("LOGIN:"), Some(PromptType::Login));
        assert_eq!(detect_prompt("PASSWORD:"), Some(PromptType::Password));
    }
}
