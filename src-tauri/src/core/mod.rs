/// Core abstractions and shared utilities
pub mod session;
pub mod error;
pub mod path_utils;
pub mod terminal_events;
pub mod history;

pub use session::{TerminalSession, FileTransferSession, FileInfo};
pub use error::{SessionError, ConnectionError};
pub use path_utils::normalize_remote_path;
pub use terminal_events::TerminalExitEvent;
pub use history::{parse_history_output, read_local_shell_history};

