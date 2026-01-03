/**
 * File Services
 * File browsing, transfers, and file management
 */

export {
	createFileService,
	listLocalDirectory as listLocalFiles,
	listRemoteDirectory as listRemoteFiles,
	downloadFile,
	uploadFile,
	deleteLocalPath as deleteLocalFile,
	deleteRemotePath as deleteRemoteFile,
	createLocalDirectory,
	createRemoteDirectory,
	renameLocalPath as renameLocalFile,
	renameRemotePath as renameRemoteFile,
	getLocalFileStat,
	getRemoteFileStat,
	closeFileSession,
	getParentPath,
	isWindowsPath,
	getHomeDirectory,
	joinPath,
	showInFileManager,
	openFileWithSystem,
	openFileWithApp,
	showOpenWithDialog,
	formatFileSize,
	getFileExtension,
	isAbsolutePath,
	chmodRemote,
	readFileContent,
	writeFileContent,
	copyLocalPath,
	moveLocalPath,
	copyRemotePath,
	moveRemotePath,
	createFileSession
} from './browser.js';

export {
	getAppPreference,
	setAppPreference,
	clearAppPreference,
	getAllAppPreferences
} from './app-preference.js';

export {
	initFileTransferProgressListener
} from './events.js';
