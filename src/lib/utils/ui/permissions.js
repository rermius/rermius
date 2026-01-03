/**
 * Convert octal mode to Unix permissions string (e.g., "drwxr-xr-x", "-rw-r--r--")
 * @param {number|string} mode - Octal mode (e.g., 0o755, 436, "100664")
 * @param {boolean} isDirectory - Whether it's a directory
 * @returns {string} - Permissions string (e.g., "drwxr-xr-x")
 */
export function modeToPermissionsString(mode, isDirectory = false) {
	// Handle null/undefined
	if (mode === null || mode === undefined) {
		return '----------';
	}

	// Handle string input (e.g., "100664", "0664", "drwxr-xr-x")
	if (typeof mode === 'string') {
		// If it's already a permissions string, return as is
		if (/^[d-l][rwx-]{9}/.test(mode)) {
			return mode;
		}

		// Remove leading '0o' or '0' if present
		const cleaned = mode.replace(/^0o?/i, '');
		mode = parseInt(cleaned, 8);
		if (isNaN(mode)) {
			return '----------';
		}
	}

	// Ensure mode is a number
	if (typeof mode !== 'number' || isNaN(mode)) {
		return '----------';
	}

	// Extract only permission bits (0o777)
	const permBits = mode & 0o777;

	// File type character
	const fileType = isDirectory ? 'd' : '-';

	// Owner permissions
	const ownerRead = permBits & 0o400 ? 'r' : '-';
	const ownerWrite = permBits & 0o200 ? 'w' : '-';
	const ownerExecute = permBits & 0o100 ? 'x' : '-';

	// Group permissions
	const groupRead = permBits & 0o040 ? 'r' : '-';
	const groupWrite = permBits & 0o020 ? 'w' : '-';
	const groupExecute = permBits & 0o010 ? 'x' : '-';

	// Others permissions
	const othersRead = permBits & 0o004 ? 'r' : '-';
	const othersWrite = permBits & 0o002 ? 'w' : '-';
	const othersExecute = permBits & 0o001 ? 'x' : '-';

	return `${fileType}${ownerRead}${ownerWrite}${ownerExecute}${groupRead}${groupWrite}${groupExecute}${othersRead}${othersWrite}${othersExecute}`;
}

/**
 * Convert permissions string to octal mode
 * @param {string} permStr - Permissions string (e.g., "drwxr-xr-x", "-rw-r--r--")
 * @returns {number|null} - Octal mode or null if invalid
 */
export function permissionsStringToMode(permStr) {
	if (!permStr || permStr.length < 10) return null;

	// Skip first character (file type: d, -, l, etc.)
	const permChars = permStr.slice(1, 10);
	if (permChars.length !== 9) return null;

	let mode = 0;

	// Owner permissions (positions 0-2)
	if (permChars[0] === 'r') mode |= 0o400;
	if (permChars[1] === 'w') mode |= 0o200;
	if (permChars[2] === 'x' || permChars[2] === 's' || permChars[2] === 'S') mode |= 0o100;

	// Group permissions (positions 3-5)
	if (permChars[3] === 'r') mode |= 0o040;
	if (permChars[4] === 'w') mode |= 0o020;
	if (permChars[5] === 'x' || permChars[5] === 's' || permChars[5] === 'S') mode |= 0o010;

	// Others permissions (positions 6-8)
	if (permChars[6] === 'r') mode |= 0o004;
	if (permChars[7] === 'w') mode |= 0o002;
	if (permChars[8] === 'x' || permChars[8] === 't' || permChars[8] === 'T') mode |= 0o001;

	return mode;
}
