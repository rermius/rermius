//! Telnet Protocol Implementation (RFC 854, 855, 1073, 1184)
//!
//! This module handles telnet protocol parsing and option negotiation.
//! Telnet uses IAC (Interpret As Command) sequences to communicate
//! control information within the data stream.

// Telnet command bytes
pub const IAC: u8 = 255;   // Interpret As Command
pub const DONT: u8 = 254;  // Refuse to perform option
pub const DO: u8 = 253;    // Request to perform option
pub const WONT: u8 = 252;  // Refusal to perform option
pub const WILL: u8 = 251;  // Agreement to perform option
pub const SB: u8 = 250;    // Subnegotiation Begin
pub const GA: u8 = 249;    // Go Ahead
pub const EL: u8 = 248;    // Erase Line
pub const EC: u8 = 247;    // Erase Character
pub const AYT: u8 = 246;   // Are You There
pub const AO: u8 = 245;    // Abort Output
pub const IP: u8 = 244;    // Interrupt Process
pub const BRK: u8 = 243;   // Break
pub const DM: u8 = 242;    // Data Mark
pub const NOP: u8 = 241;   // No Operation
pub const SE: u8 = 240;    // Subnegotiation End

// Telnet options we care about
pub const OPT_ECHO: u8 = 1;        // Echo
pub const OPT_SGA: u8 = 3;         // Suppress Go Ahead
pub const OPT_TTYPE: u8 = 24;      // Terminal Type
pub const OPT_NAWS: u8 = 31;       // Negotiate About Window Size
pub const OPT_LINEMODE: u8 = 34;   // Linemode
pub const OPT_ENVIRON: u8 = 39;    // Environment Variables

/// State machine for parsing telnet protocol data
#[derive(Debug, Clone, Copy, PartialEq)]
enum ParseState {
    Data,
    Iac,
    Will,
    Wont,
    Do,
    Dont,
    Sb,
    SbData,
    SbIac,
}

/// Telnet protocol context for tracking negotiation state
#[derive(Debug, Clone)]
pub struct TelnetProtocol {
    /// Whether NAWS has been negotiated
    pub naws_enabled: bool,
    /// Whether SGA has been negotiated
    pub sga_enabled: bool,
    /// Whether ECHO is being handled by remote
    pub echo_enabled: bool,
}

impl Default for TelnetProtocol {
    fn default() -> Self {
        Self::new()
    }
}

impl TelnetProtocol {
    pub fn new() -> Self {
        Self {
            naws_enabled: false,
            sga_enabled: false,
            echo_enabled: false,
        }
    }

    /// Process incoming telnet data, returning (responses_to_send, clean_data, naws_requested)
    ///
    /// This function:
    /// 1. Parses IAC sequences from the data stream
    /// 2. Generates appropriate responses to option negotiations
    /// 3. Returns clean data with IAC sequences stripped
    pub fn process_data(&mut self, data: &[u8]) -> (Vec<u8>, Vec<u8>, bool) {
        let mut responses = Vec::new();
        let mut clean_data = Vec::new();
        let mut state = ParseState::Data;
        let mut sb_option: u8 = 0;
        let mut naws_requested = false;

        for &byte in data {
            match state {
                ParseState::Data => {
                    if byte == IAC {
                        state = ParseState::Iac;
                    } else {
                        clean_data.push(byte);
                    }
                }

                ParseState::Iac => {
                    match byte {
                        IAC => {
                            // Escaped IAC (255 255 -> literal 255)
                            clean_data.push(IAC);
                            state = ParseState::Data;
                        }
                        WILL => state = ParseState::Will,
                        WONT => state = ParseState::Wont,
                        DO => state = ParseState::Do,
                        DONT => state = ParseState::Dont,
                        SB => state = ParseState::Sb,
                        GA | NOP | DM | BRK | IP | AO | AYT | EC | EL => {
                            // Single-byte commands, ignore
                            state = ParseState::Data;
                        }
                        SE => {
                            // Unexpected SE outside subnegotiation
                            state = ParseState::Data;
                        }
                        _ => {
                            // Unknown command, skip
                            state = ParseState::Data;
                        }
                    }
                }

                ParseState::Will => {
                    // Remote wants to enable an option
                    match byte {
                        OPT_ECHO => {
                            // Allow remote to echo
                            self.echo_enabled = true;
                            responses.extend_from_slice(&[IAC, DO, OPT_ECHO]);
                        }
                        OPT_SGA => {
                            // Allow suppress go-ahead
                            self.sga_enabled = true;
                            responses.extend_from_slice(&[IAC, DO, OPT_SGA]);
                        }
                        _ => {
                            // Refuse other options
                            responses.extend_from_slice(&[IAC, DONT, byte]);
                        }
                    }
                    state = ParseState::Data;
                }

                ParseState::Wont => {
                    // Remote refuses to enable an option
                    match byte {
                        OPT_ECHO => self.echo_enabled = false,
                        OPT_SGA => self.sga_enabled = false,
                        _ => {}
                    }
                    state = ParseState::Data;
                }

                ParseState::Do => {
                    // Remote wants us to enable an option
                    match byte {
                        OPT_NAWS => {
                            // Accept NAWS - we will send window size
                            self.naws_enabled = true;
                            naws_requested = true;
                            responses.extend_from_slice(&[IAC, WILL, OPT_NAWS]);
                        }
                        OPT_TTYPE => {
                            // Accept terminal type negotiation
                            responses.extend_from_slice(&[IAC, WILL, OPT_TTYPE]);
                        }
                        OPT_SGA => {
                            // Accept suppress go-ahead
                            self.sga_enabled = true;
                            responses.extend_from_slice(&[IAC, WILL, OPT_SGA]);
                        }
                        _ => {
                            // Refuse other options
                            responses.extend_from_slice(&[IAC, WONT, byte]);
                        }
                    }
                    state = ParseState::Data;
                }

                ParseState::Dont => {
                    // Remote wants us to disable an option
                    match byte {
                        OPT_NAWS => self.naws_enabled = false,
                        OPT_SGA => self.sga_enabled = false,
                        _ => {}
                    }
                    // Acknowledge with WONT
                    responses.extend_from_slice(&[IAC, WONT, byte]);
                    state = ParseState::Data;
                }

                ParseState::Sb => {
                    // Start of subnegotiation, byte is the option
                    sb_option = byte;
                    state = ParseState::SbData;
                }

                ParseState::SbData => {
                    if byte == IAC {
                        state = ParseState::SbIac;
                    }
                    // We don't collect subnegotiation data for now
                    // (we only send, not receive NAWS/TTYPE subneg)
                }

                ParseState::SbIac => {
                    if byte == SE {
                        // End of subnegotiation
                        // Handle terminal type request
                        if sb_option == OPT_TTYPE {
                            // Send terminal type: xterm-256color
                            responses.extend_from_slice(&[
                                IAC, SB, OPT_TTYPE, 0, // IS (0)
                            ]);
                            responses.extend_from_slice(b"xterm-256color");
                            responses.extend_from_slice(&[IAC, SE]);
                        }
                        state = ParseState::Data;
                    } else if byte == IAC {
                        // Escaped IAC in subnegotiation data
                        state = ParseState::SbData;
                    } else {
                        // Unexpected byte after IAC in subnegotiation
                        state = ParseState::SbData;
                    }
                }
            }
        }

        (responses, clean_data, naws_requested)
    }
}

/// Build NAWS (window size) subnegotiation message
/// Format: IAC SB NAWS <width-high> <width-low> <height-high> <height-low> IAC SE
pub fn build_naws(cols: u16, rows: u16) -> Vec<u8> {
    let mut msg = vec![IAC, SB, OPT_NAWS];

    // Width (2 bytes, network byte order)
    let col_high = (cols >> 8) as u8;
    let col_low = (cols & 0xff) as u8;

    // Height (2 bytes, network byte order)
    let row_high = (rows >> 8) as u8;
    let row_low = (rows & 0xff) as u8;

    // Escape any 255 bytes
    for &b in &[col_high, col_low, row_high, row_low] {
        msg.push(b);
        if b == IAC {
            msg.push(IAC); // Escape
        }
    }

    msg.extend_from_slice(&[IAC, SE]);
    msg
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_naws() {
        let naws = build_naws(80, 24);
        assert_eq!(naws[0], IAC);
        assert_eq!(naws[1], SB);
        assert_eq!(naws[2], OPT_NAWS);
        // 80 = 0x0050, 24 = 0x0018
        assert_eq!(naws[3], 0);
        assert_eq!(naws[4], 80);
        assert_eq!(naws[5], 0);
        assert_eq!(naws[6], 24);
        assert_eq!(naws[7], IAC);
        assert_eq!(naws[8], SE);
    }

    #[test]
    fn test_process_plain_data() {
        let mut proto = TelnetProtocol::new();
        let data = b"Hello, World!";
        let (responses, clean, _) = proto.process_data(data);
        assert!(responses.is_empty());
        assert_eq!(clean, data.to_vec());
    }

    #[test]
    fn test_process_will_echo() {
        let mut proto = TelnetProtocol::new();
        let data = [IAC, WILL, OPT_ECHO];
        let (responses, clean, _) = proto.process_data(&data);
        assert_eq!(responses, vec![IAC, DO, OPT_ECHO]);
        assert!(clean.is_empty());
        assert!(proto.echo_enabled);
    }

    #[test]
    fn test_process_do_naws() {
        let mut proto = TelnetProtocol::new();
        let data = [IAC, DO, OPT_NAWS];
        let (responses, clean, naws_requested) = proto.process_data(&data);
        assert_eq!(responses, vec![IAC, WILL, OPT_NAWS]);
        assert!(clean.is_empty());
        assert!(proto.naws_enabled);
        assert!(naws_requested);
    }

    #[test]
    fn test_escaped_iac() {
        let mut proto = TelnetProtocol::new();
        let data = [b'A', IAC, IAC, b'B'];
        let (responses, clean, _) = proto.process_data(&data);
        assert!(responses.is_empty());
        assert_eq!(clean, vec![b'A', IAC, b'B']);
    }
}
