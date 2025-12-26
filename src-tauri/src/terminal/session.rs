use serde::{Deserialize, Serialize};

/// Session type enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SessionType {
    Local,
    Ssh,
    Telnet,
}
