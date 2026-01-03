import { listen, listen as listenGlobal } from '@tauri-apps/api/event';
import { statusBarStore } from '$lib/stores/status-bar';

let initialized = false;

export async function initFileTransferProgressListener() {
	if (initialized) {
		return;
	}

	try {
		await listen('file-transfer-progress', event => {
			const payload = event?.payload || {};
			const {
				direction,
				localPath,
				remotePath,
				fileName,
				bytesTransferred,
				totalBytes,
				done,
				transferId,
				sessionId
			} = payload;

			if (!direction || !fileName || !transferId) {
				console.error('[FileTransfer] Invalid event payload:', { direction, fileName, transferId });
				return;
			}

			const total = typeof totalBytes === 'number' && totalBytes > 0 ? totalBytes : 0;
			const transferred = typeof bytesTransferred === 'number' ? bytesTransferred : 0;
			const progress =
				total > 0 ? Math.max(0, Math.min(100, Math.floor((transferred / total) * 100))) : 0;
			const fromPath = direction === 'upload' ? localPath : remotePath;
			const toPath = direction === 'upload' ? remotePath : localPath;
			const status = done ? 'success' : direction === 'upload' ? 'uploading' : 'downloading';

			statusBarStore.showTransfer(direction, {
				id: transferId, // Use transferId from backend (echoed from frontend)
				fileName,
				fromPath,
				toPath,
				progress,
				status,
				error: null
			});
		});

		initialized = true;
	} catch (e) {
		console.error('[FileTransfer] Failed to init progress listener:', e);
	}
}
