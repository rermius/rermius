// Terminal module - kept for SessionType enum and factory
// Note: Actual sessions moved to pty/ and ssh/terminal.rs
// Manager moved to managers/terminal.rs

pub mod session; // SessionType enum
pub mod factory; // SessionFactory (uses pty/ and ssh/terminal)

pub use factory::SessionFactory;
pub use session::SessionType;
