// Factory and Handlers
export { connectionFactory } from './factory.js';
export { BaseConnectionHandler } from './handlers/base.js';
export { SSHConnectionHandler } from './handlers/ssh-handler.js';
export { FileTransferConnectionHandler } from './handlers/file-transfer-handler.js';
export { TelnetConnectionHandler } from './handlers/telnet-handler.js';

// SSH Connection
export {
	connectSSH,
	retrySSHConnection,
	writeTempKeyFile,
	prepareHopConfig,
	resolveChain,
	cleanupTempKeys
} from './ssh.js';

// Telnet Connection
export { connectTelnet, retryTelnetConnection } from './telnet.js';

// File Transfer Connection
export { connectFileTransfer, isFileTransferType, isTerminalType } from './file.js';

// Heartbeat
export { connectionHeartbeat } from './heartbeat.js';

// Auto-reconnect
export { attemptReconnect, cancelReconnect, isReconnecting } from './auto-reconnect.js';
