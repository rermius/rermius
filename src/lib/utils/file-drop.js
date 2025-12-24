/**
 * File drop utilities - ADAPTED FROM ELECTERM
 */
import { getFolderFromFilePath } from './path/file-utils';

export const getFilePath = file => {
	if (file.path) return file.path;
	// Try Tauri API if available
	if (window.__TAURI__ && file.path) {
		return file.path;
	}
	return file.name;
};

export const getDropFileList = dataTransfer => {
	const fromFile = dataTransfer.getData('fromFile');
	if (fromFile) {
		try {
			return [JSON.parse(fromFile)];
		} catch (e) {
			console.error('Failed to parse fromFile:', e);
			return [];
		}
	}

	const { files } = dataTransfer;
	const res = [];
	for (let i = 0; i < files.length; i++) {
		const item = files[i];
		if (!item) continue;

		const filePath = getFilePath(item);
		const fileObj = getFolderFromFilePath(filePath, false);
		res.push({
			...fileObj,
			type: 'local'
		});
	}
	return res;
};

export const isUnsafeFilename = filename => {
	return /["'\n\r]/.test(filename);
};
