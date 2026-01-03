/**
 * Composable for key scanning and import operations
 * Handles folder scanning, file selection, and batch import with progress tracking
 */
	import { tauriFs, tauriDialog, importKeyFromFile } from '$lib/services';

/**
 * Detect SSH key type from private key content
 * @param {string} privateKey - Private key content
 * @returns {string} Key type (RSA, ED25519, ECDSA, DSA, PKCS8, OpenSSH, Unknown)
 */
function detectKeyType(privateKey) {
	if (!privateKey || typeof privateKey !== 'string') {
		return 'Unknown';
	}

	if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
		return 'RSA';
	} else if (privateKey.includes('BEGIN OPENSSH PRIVATE KEY')) {
		// OpenSSH format - need to check the content for actual type
		if (privateKey.includes('ssh-ed25519')) {
			return 'ED25519';
		} else if (privateKey.includes('ecdsa-sha2')) {
			return 'ECDSA';
		} else if (privateKey.includes('ssh-rsa')) {
			return 'RSA';
		}
		return 'OpenSSH';
	} else if (privateKey.includes('BEGIN EC PRIVATE KEY')) {
		return 'ECDSA';
	} else if (privateKey.includes('BEGIN DSA PRIVATE KEY')) {
		return 'DSA';
	} else if (privateKey.includes('BEGIN PRIVATE KEY')) {
		return 'PKCS8';
	}
	return 'Unknown';
}

/**
 * Preview key type from file (reads first few lines)
 * @param {string} filePath - Path to key file
 * @returns {Promise<string>} Detected key type
 */
async function previewKeyType(filePath) {
	try {
		// Read first 2KB to detect key type without reading entire file
		const content = await tauriFs.readFile(filePath);
		const firstLines = content.split('\n').slice(0, 5).join('\n');
		return detectKeyType(firstLines);
	} catch (error) {
		console.warn(`Failed to preview key type for ${filePath}:`, error);
		return 'Unknown';
	}
}

/**
 * Composable hook for key scanning operations
 * @returns {Object} State and methods for key scanning
 */
export function useKeyScan() {
	let files = $state([]);
	let selectedFiles = $state(new Set());
	let isScanning = $state(false);
	let isImporting = $state(false);
	let importProgress = $state({
		current: 0,
		total: 0,
		success: 0,
		errors: 0,
		duplicates: 0,
		errorDetails: []
	});
	let filePreviewCache = $state(new Map());

	/**
	 * Scan folder for SSH key files
	 * @param {string} folderPath - Folder path to scan
	 * @returns {Promise<void>}
	 */
	async function scanFolder(folderPath) {
		if (!folderPath) return;

		isScanning = true;
		files = [];
		selectedFiles = new Set();
		filePreviewCache = new Map();

		try {
			const scannedFiles = await tauriFs.scanDirectoryRecursive(folderPath);
			files = scannedFiles;

			// Optionally preview key types (can be slow for many files)
			// For now, we'll preview on-demand when displaying files
		} catch (error) {
			console.error('Failed to scan folder:', error);
			throw error;
		} finally {
			isScanning = false;
		}
	}

	/**
	 * Open folder dialog and scan
	 * @returns {Promise<void>}
	 */
	async function openAndScanFolder() {
		try {
			const folderPath = await tauriDialog.openDirectory({
				title: 'Select Folder to Scan for SSH Keys'
			});

			if (folderPath) {
				await scanFolder(folderPath);
			}
		} catch (error) {
			console.error('Failed to open folder dialog:', error);
			throw error;
		}
	}

	/**
	 * Toggle file selection
	 * @param {string} filePath - File path to toggle
	 */
	function toggleFile(filePath) {
		const newSet = new Set(selectedFiles);
		if (newSet.has(filePath)) {
			newSet.delete(filePath);
		} else {
			newSet.add(filePath);
		}
		selectedFiles = newSet;
	}

	/**
	 * Toggle all files selection
	 */
	function toggleAll() {
		if (selectedFiles.size === files.length) {
			selectedFiles = new Set();
		} else {
			selectedFiles = new Set(files.map(f => f.path));
		}
	}

	/**
	 * Get preview key type for file (with caching)
	 * @param {string} filePath - File path
	 * @returns {Promise<string>} Key type
	 */
	async function getPreviewType(filePath) {
		if (filePreviewCache.has(filePath)) {
			return filePreviewCache.get(filePath);
		}

		const keyType = await previewKeyType(filePath);
		filePreviewCache.set(filePath, keyType);
		return keyType;
	}

	/**
	 * Import selected files with progress tracking
	 * @returns {Promise<Object>} Import summary
	 */
	async function importSelected() {
		if (selectedFiles.size === 0) {
			return {
				imported: 0,
				duplicates: 0,
				errors: 0,
				errorDetails: []
			};
		}

		isImporting = true;
		importProgress = {
			current: 0,
			total: selectedFiles.size,
			success: 0,
			errors: 0,
			duplicates: 0,
			errorDetails: []
		};

		const selectedPaths = Array.from(selectedFiles);
		const summary = {
			imported: 0,
			duplicates: 0,
			errors: 0,
			errorDetails: []
		};

		for (const filePath of selectedPaths) {
			try {
				importProgress.current += 1;
				importProgress = { ...importProgress }; // Trigger reactivity

				// Use reusable import function
				const result = await importKeyFromFile(filePath, { skipDuplicate: true });

				if (result.status === 'imported') {
					summary.imported += 1;
					importProgress.success += 1;
					importProgress = { ...importProgress }; // Trigger reactivity
					console.log(`[useKeyScan] Successfully imported: ${filePath} as "${result.key.label}"`);
				} else if (result.status === 'duplicate') {
					summary.duplicates += 1;
					importProgress.duplicates += 1;
					importProgress = { ...importProgress }; // Trigger reactivity
					console.log(
						`[useKeyScan] Duplicate key skipped: ${filePath} (exists as "${result.duplicateKey.label}")`
					);
				} else if (result.status === 'error') {
					summary.errors += 1;
					importProgress.errors += 1;
					importProgress.errorDetails.push({
						path: filePath,
						error: result.error
					});
					importProgress = { ...importProgress }; // Trigger reactivity
					console.error(`Failed to import ${filePath}:`, result.error);
				}
			} catch (error) {
				summary.errors += 1;
				importProgress.errors += 1;
				importProgress.errorDetails.push({
					path: filePath,
					error: error.message || String(error)
				});
				importProgress = { ...importProgress }; // Trigger reactivity
				console.error(`Failed to import ${filePath}:`, error);
			}
		}

		isImporting = false;
		console.log('[useKeyScan] Import completed, summary:', summary);
		return summary;
	}

	/**
	 * Reset scan state
	 */
	function reset() {
		files = [];
		selectedFiles = new Set();
		isScanning = false;
		isImporting = false;
		importProgress = {
			current: 0,
			total: 0,
			success: 0,
			errors: 0,
			duplicates: 0,
			errorDetails: []
		};
		filePreviewCache = new Map();
	}

	return {
		get files() {
			return files;
		},
		get selectedFiles() {
			return selectedFiles;
		},
		get isScanning() {
			return isScanning;
		},
		get isImporting() {
			return isImporting;
		},
		get importProgress() {
			return importProgress;
		},
		scanFolder,
		openAndScanFolder,
		toggleFile,
		toggleAll,
		getPreviewType,
		importSelected,
		reset
	};
}
