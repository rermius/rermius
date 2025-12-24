/**
 * SSH configuration constants and defaults
 */

export const SSH_DEFAULTS = {
	PORT: 22,
	TIMEOUT: 30000, // 30 seconds
	KEEPALIVE_INTERVAL: 60000, // 1 minute
	RETRY_ATTEMPTS: 3,
	RETRY_DELAY: 1000, // 1 second
	MAX_SESSIONS: 10
};

/**
 * SSH connection states
 */
export const SSH_STATES = {
	DISCONNECTED: 'disconnected',
	CONNECTING: 'connecting',
	CONNECTED: 'connected',
	AUTHENTICATING: 'authenticating',
	READY: 'ready',
	ERROR: 'error',
	TIMEOUT: 'timeout'
};

/**
 * SSH authentication methods
 */
export const SSH_AUTH_METHODS = {
	PASSWORD: 'password',
	PUBLIC_KEY: 'publickey',
	KEYBOARD_INTERACTIVE: 'keyboard-interactive',
	AGENT: 'agent'
};

/**
 * SSH key types
 */
export const SSH_KEY_TYPES = {
	RSA: 'ssh-rsa',
	ED25519: 'ssh-ed25519',
	ECDSA_256: 'ecdsa-sha2-nistp256',
	ECDSA_384: 'ecdsa-sha2-nistp384',
	ECDSA_521: 'ecdsa-sha2-nistp521'
};

/**
 * Port forwarding types
 */
export const PORT_FORWARD_TYPES = {
	LOCAL: 'local', // -L
	REMOTE: 'remote', // -R
	DYNAMIC: 'dynamic' // -D (SOCKS proxy)
};

/**
 * Terminal settings
 */
export const TERMINAL_DEFAULTS = {
	COLS: 80,
	ROWS: 24,
	TERM: 'xterm-256color',
	ENCODING: 'utf-8',
	SCROLLBACK: 1000
};

/**
 * SFTP settings
 */
export const SFTP_DEFAULTS = {
	MAX_PACKET_SIZE: 32768,
	MAX_CONCURRENT_READS: 64,
	MAX_CONCURRENT_WRITES: 64
};
