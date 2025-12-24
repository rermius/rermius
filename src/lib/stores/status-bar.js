import { writable } from 'svelte/store';

// Transfer item structure
function createTransferId(fileName, fromPath, toPath) {
	return `${fileName}:${fromPath}:${toPath}`;
}

const initialState = {
	fileName: '',
	progress: 0,
	status: 'idle', // 'idle' | 'uploading' | 'downloading' | 'success' | 'error'
	errorMessage: '',
	action: 'upload', // 'upload' | 'download'
	fromPath: '',
	toPath: '',
	cancellable: false,
	onCancel: null,
	// Multiple transfers support
	transfers: [], // Array of { id, fileName, progress, status, fromPath, toPath, onCancel }
	currentIndex: 0,
	totalCount: 0,
	// Collapse/expand support
	isExpanded: false
};

function createStatusBarStore() {
	const { subscribe, set, update } = writable(initialState);

	let hideTimeout = null;
	let progressInterval = null;

	function clearTimers() {
		if (hideTimeout) {
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}
		if (progressInterval) {
			clearInterval(progressInterval);
			progressInterval = null;
		}
	}

	function startFakeProgress() {
		// Deprecated: real progress is now provided by backend events.
		// Kept for potential fallback but disabled by default.
	}

	return {
		subscribe,

		addTransfer(fileName, fromPath, toPath, action, onCancel = null, id = null) {
			update(state => {
				const transferId = id || createTransferId(fileName, fromPath, toPath);
				const existingIndex = state.transfers.findIndex(t => t.id === transferId);

				if (existingIndex >= 0) {
					return state;
				}

				const newTransfer = {
					id: transferId,
					fileName,
					fromPath,
					toPath,
					progress: 0,
					status: action === 'upload' ? 'uploading' : 'downloading',
					onCancel,
					action
				};

				const transfers = [...state.transfers, newTransfer];
				const activeIndex = transfers.findIndex(
					t => t.status === 'uploading' || t.status === 'downloading'
				);
				const displayIndex = activeIndex >= 0 ? activeIndex : transfers.length - 1;
				const displayTransfer = transfers[displayIndex] || transfers[0];
				const shouldExpand = !state.isExpanded && (action === 'upload' || action === 'download');

				return {
					...state,
					transfers,
					totalCount: transfers.length,
					currentIndex: displayIndex,
					fileName: displayTransfer?.fileName || '',
					progress: displayTransfer?.progress || 0,
					status: displayTransfer?.status || 'idle',
					action: action === 'upload' ? 'upload' : 'download',
					fromPath: displayTransfer?.fromPath || '',
					toPath: displayTransfer?.toPath || '',
					cancellable: !!displayTransfer?.onCancel,
					onCancel: displayTransfer?.onCancel || null,
					isExpanded: shouldExpand || state.isExpanded
				};
			});
		},

		updateTransfer(
			id,
			progress,
			status,
			error = null,
			fileName = null,
			fromPath = null,
			toPath = null
		) {
			update(state => {
				// Match by id directly (transferId from backend events)
				const transferIndex = state.transfers.findIndex(t => t.id === id);

				if (transferIndex < 0) {
					return state;
				}

				const transfers = [...state.transfers];
				transfers[transferIndex] = {
					...transfers[transferIndex],
					progress: progress ?? transfers[transferIndex].progress,
					status: status || transfers[transferIndex].status,
					errorMessage: error || transfers[transferIndex].errorMessage,
					fileName: fileName || transfers[transferIndex].fileName,
					fromPath: fromPath || transfers[transferIndex].fromPath,
					toPath: toPath !== null ? toPath : transfers[transferIndex].toPath
				};

				const activeIndex = transfers.findIndex(
					t => t.status === 'uploading' || t.status === 'downloading'
				);
				const displayIndex = activeIndex >= 0 ? activeIndex : 0;
				const displayTransfer = transfers[displayIndex] || transfers[0];
				const hasUpload = transfers.some(t => t.action === 'upload');
				const actionType = hasUpload ? 'upload' : 'download';

				if (transfers.every(t => t.status === 'success' || t.status === 'error')) {
					clearTimers();
					hideTimeout = setTimeout(() => {
						set(initialState);
					}, 3000);
					return {
						...state,
						transfers,
						currentIndex: displayIndex,
						fileName: displayTransfer?.fileName || '',
						progress: displayTransfer?.progress || 0,
						status: displayTransfer?.status || 'idle',
						action: actionType,
						fromPath: displayTransfer?.fromPath || '',
						toPath: displayTransfer?.toPath || '',
						errorMessage: displayTransfer?.errorMessage || '',
						cancellable: false,
						onCancel: null,
						isExpanded: false
					};
				}

				return {
					...state,
					transfers,
					currentIndex: displayIndex,
					fileName: displayTransfer?.fileName || '',
					progress: displayTransfer?.progress || 0,
					status: displayTransfer?.status || 'idle',
					action: actionType,
					fromPath: displayTransfer?.fromPath || '',
					toPath: displayTransfer?.toPath || '',
					errorMessage: displayTransfer?.errorMessage || '',
					cancellable:
						!!displayTransfer?.onCancel &&
						(displayTransfer.status === 'uploading' || displayTransfer.status === 'downloading'),
					onCancel: displayTransfer?.onCancel || null,
					isExpanded: state.isExpanded
				};
			});
		},

		showTransfer(action, arg1, progress = null, status = null, error = null, onCancel = null) {
			clearTimers();

			const defaultStatus = action === 'upload' ? 'uploading' : 'downloading';
			const opts =
				typeof arg1 === 'string'
					? {
							fileName: arg1,
							progress: progress ?? 0,
							status: status || defaultStatus,
							error,
							onCancel
						}
					: arg1 || {};

			const transferId = opts.id || createTransferId(opts.fileName, opts.fromPath, opts.toPath);
			const isNewTransfer = opts.status === defaultStatus && opts.progress === 0;

			update(state => {
				// Find existing transfer
				const transferIndex = state.transfers.findIndex(t => t.id === transferId);

				// If new transfer and not found, add it
				if (isNewTransfer && transferIndex < 0) {
					const newTransfer = {
						id: transferId,
						fileName: opts.fileName,
						fromPath: opts.fromPath,
						toPath: opts.toPath,
						progress: opts.progress ?? 0,
						status: opts.status || defaultStatus,
						onCancel: opts.onCancel,
						action,
						errorMessage: opts.error || null
					};

					const transfers = [...state.transfers, newTransfer];
					const activeIndex = transfers.findIndex(
						t => t.status === 'uploading' || t.status === 'downloading'
					);
					const displayIndex = activeIndex >= 0 ? activeIndex : transfers.length - 1;
					const displayTransfer = transfers[displayIndex] || transfers[0];
					const shouldExpand = !state.isExpanded && (action === 'upload' || action === 'download');

					return {
						...state,
						transfers,
						totalCount: transfers.length,
						currentIndex: displayIndex,
						fileName: displayTransfer?.fileName || '',
						progress: displayTransfer?.progress || 0,
						status: displayTransfer?.status || 'idle',
						action: action === 'upload' ? 'upload' : 'download',
						fromPath: displayTransfer?.fromPath || '',
						toPath: displayTransfer?.toPath || '',
						cancellable:
							!!displayTransfer?.onCancel &&
							(displayTransfer.status === 'uploading' || displayTransfer.status === 'downloading'),
						onCancel: displayTransfer?.onCancel || null,
						isExpanded: shouldExpand || state.isExpanded
					};
				}

				// Update existing transfer
				if (transferIndex >= 0) {
					const transfers = [...state.transfers];
					transfers[transferIndex] = {
						...transfers[transferIndex],
						progress: opts.progress ?? transfers[transferIndex].progress,
						status: opts.status || transfers[transferIndex].status,
						errorMessage: opts.error || transfers[transferIndex].errorMessage
					};

					const activeIndex = transfers.findIndex(
						t => t.status === 'uploading' || t.status === 'downloading'
					);
					const displayIndex = activeIndex >= 0 ? activeIndex : 0;
					const displayTransfer = transfers[displayIndex] || transfers[0];
					const hasUpload = transfers.some(t => t.action === 'upload');
					const actionType = hasUpload ? 'upload' : 'download';

					if (transfers.every(t => t.status === 'success' || t.status === 'error')) {
						clearTimers();
						hideTimeout = setTimeout(() => {
							set(initialState);
						}, 3000);
						return {
							...state,
							transfers,
							currentIndex: displayIndex,
							fileName: displayTransfer?.fileName || '',
							progress: displayTransfer?.progress || 0,
							status: displayTransfer?.status || 'idle',
							action: actionType,
							fromPath: displayTransfer?.fromPath || '',
							toPath: displayTransfer?.toPath || '',
							errorMessage: displayTransfer?.errorMessage || '',
							cancellable: false,
							onCancel: null,
							isExpanded: false
						};
					}

					return {
						...state,
						transfers,
						currentIndex: displayIndex,
						fileName: displayTransfer?.fileName || '',
						progress: displayTransfer?.progress || 0,
						status: displayTransfer?.status || 'idle',
						action: actionType,
						fromPath: displayTransfer?.fromPath || '',
						toPath: displayTransfer?.toPath || '',
						errorMessage: displayTransfer?.errorMessage || '',
						cancellable:
							!!displayTransfer?.onCancel &&
							(displayTransfer.status === 'uploading' || displayTransfer.status === 'downloading'),
						onCancel: displayTransfer?.onCancel || null,
						isExpanded: state.isExpanded
					};
				}

				// Transfer not found and not new - do nothing
				return state;
			});
		},

		showUpload(arg1, progress = 0, status = 'uploading', error = null, onCancel = null) {
			this.showTransfer('upload', arg1, progress, status, error, onCancel);
		},

		showDownload(arg1, progress = 0, status = 'downloading', error = null, onCancel = null) {
			this.showTransfer('download', arg1, progress, status, error, onCancel);
		},

		toggleExpand() {
			update(state => ({
				...state,
				isExpanded: !state.isExpanded
			}));
		},

		cancelTransfer(id) {
			update(state => {
				const transferIndex = state.transfers.findIndex(t => t.id === id);

				if (transferIndex < 0) {
					return state;
				}

				const transfer = state.transfers[transferIndex];
				if (transfer?.onCancel) {
					transfer.onCancel();
				}

				const transfers = state.transfers.filter(t => t.id !== id);

				if (transfers.length === 0) {
					return initialState;
				}

				const activeIndex = transfers.findIndex(
					t => t.status === 'uploading' || t.status === 'downloading'
				);
				const displayIndex = activeIndex >= 0 ? activeIndex : 0;
				const displayTransfer = transfers[displayIndex] || transfers[0];
				const hasUpload = transfers.some(t => t.action === 'upload');
				const actionType = hasUpload ? 'upload' : 'download';

				return {
					...state,
					transfers,
					totalCount: transfers.length,
					currentIndex: displayIndex,
					fileName: displayTransfer?.fileName || '',
					progress: displayTransfer?.progress || 0,
					status: displayTransfer?.status || 'idle',
					action: actionType,
					fromPath: displayTransfer?.fromPath || '',
					toPath: displayTransfer?.toPath || '',
					errorMessage: displayTransfer?.errorMessage || '',
					cancellable:
						!!displayTransfer?.onCancel &&
						(displayTransfer.status === 'uploading' || displayTransfer.status === 'downloading'),
					onCancel: displayTransfer?.onCancel || null,
					isExpanded: state.isExpanded
				};
			});
			clearTimers();
		},

		cancel() {
			update(state => {
				const currentTransfer = state.transfers[state.currentIndex];
				if (currentTransfer?.onCancel) {
					currentTransfer.onCancel();
				}
				// Remove cancelled transfer from list
				const transfers = state.transfers.filter((t, idx) => idx !== state.currentIndex);
				if (transfers.length === 0) {
					return initialState;
				}
				// Show next transfer
				const nextIndex = Math.min(state.currentIndex, transfers.length - 1);
				const nextTransfer = transfers[nextIndex] || transfers[0];
				return {
					...state,
					transfers,
					totalCount: transfers.length,
					currentIndex: nextIndex,
					fileName: nextTransfer?.fileName || '',
					progress: nextTransfer?.progress || 0,
					status: nextTransfer?.status || 'idle',
					fromPath: nextTransfer?.fromPath || '',
					toPath: nextTransfer?.toPath || '',
					cancellable: !!nextTransfer?.onCancel,
					onCancel: nextTransfer?.onCancel || null
				};
			});
			clearTimers();
		},

		hide() {
			clearTimers();
			set(initialState);
		}
	};
}

export const statusBarStore = createStatusBarStore();
