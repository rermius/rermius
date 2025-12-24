/**
 * File info related functions - ADAPTED FROM ELECTERM
 */

// Detect Windows environment
export const isWin =
	typeof window !== 'undefined' &&
	(navigator.platform.includes('Win') || navigator.userAgent.includes('Windows'));

export const getFileExt = fileName => {
	const sep = '.';
	const arr = fileName.split(sep);
	const len = arr.length;
	if (len === 1) {
		return { base: fileName, ext: '' };
	}
	return {
		base: arr.slice(0, len - 1).join(sep),
		ext: arr[len - 1] || ''
	};
};

export const getFolderFromFilePath = (filePath, isRemote) => {
	const sep = isRemote ? '/' : isWin ? '\\' : '/';
	const arr = filePath.split(sep);
	const len = arr.length;
	const isWinDisk = isWin && filePath.endsWith(sep);

	const path = isWinDisk ? '/' : arr.slice(0, len - 1).join(sep);
	const name = isWinDisk ? filePath.replace(sep, '') : arr[len - 1];

	return {
		path,
		name,
		...getFileExt(name)
	};
};

export const isAbsolutePath = (path = '') => {
	return path.startsWith('/') || /^[a-zA-Z]:/.test(path);
};
