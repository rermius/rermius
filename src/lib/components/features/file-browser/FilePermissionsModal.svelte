<script>
	import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Spinner } from '$lib/components/ui';
	import { Checkbox } from '$lib/components/ui';
	import { Input } from '$lib/components/ui';
	import { Shield } from 'lucide-svelte';

	let { open = $bindable(false), file = null, type = 'local', sessionId = null } = $props();

	let loading = $state(false);
	let errorMessage = $state('');
	let octalPermissions = $state('0644');
	let permissions = $state({
		owner: { read: false, write: false, execute: false },
		group: { read: false, write: false, execute: false },
		others: { read: false, write: false, execute: false }
	});

	// Check if FTP (read-only) or SFTP (editable)
	const isReadOnly = $derived(type === 'ftp');

	// Initialize permissions from file
	$effect(() => {
		if (file && file.permissions) {
			const mode = parsePermissions(file.permissions);
			if (mode !== null) {
				updatePermissionsFromOctal(mode);
			}
		}
		// Clear error when file changes
		errorMessage = '';
	});

	function parsePermissions(permStr) {
		if (!permStr) return null;
		// Handle different formats:
		// - "100664" (octal with file type bit)
		// - "0664" (octal permissions only)
		// - "0o664" (octal with prefix)
		// - "rw-rw-r--" (permissions string)

		// Remove leading '0o' or '0' if present
		let cleaned = permStr.replace(/^0o?/i, '');

		// If it's a permissions string (contains letters), return null (handled elsewhere)
		if (/[a-zA-Z]/.test(cleaned)) {
			return null;
		}

		// Parse as octal
		const mode = parseInt(cleaned, 8);
		if (isNaN(mode)) return null;

		// Extract only permission bits (last 3 digits)
		// If mode is > 777, it includes file type bits, so mask to 0o777
		return mode & 0o777;
	}

	function updatePermissionsFromOctal(mode) {
		const newPermissions = {
			owner: {
				read: !!(mode & 0o400),
				write: !!(mode & 0o200),
				execute: !!(mode & 0o100)
			},
			group: {
				read: !!(mode & 0o040),
				write: !!(mode & 0o020),
				execute: !!(mode & 0o010)
			},
			others: {
				read: !!(mode & 0o004),
				write: !!(mode & 0o002),
				execute: !!(mode & 0o001)
			}
		};
		const newOctal = `0${(mode & 0o777).toString(8).padStart(3, '0')}`;
		permissions = newPermissions;
		octalPermissions = newOctal;
	}

	function updateOctal() {
		let mode = 0;
		if (permissions.owner.read) mode |= 0o400;
		if (permissions.owner.write) mode |= 0o200;
		if (permissions.owner.execute) mode |= 0o100;
		if (permissions.group.read) mode |= 0o040;
		if (permissions.group.write) mode |= 0o020;
		if (permissions.group.execute) mode |= 0o010;
		if (permissions.others.read) mode |= 0o004;
		if (permissions.others.write) mode |= 0o002;
		if (permissions.others.execute) mode |= 0o001;

		mode = mode & 0o777;
		octalPermissions = `0${mode.toString(8).padStart(3, '0')}`;
	}

	function handlePermissionChange(category, perm) {
		// Note: bind:checked already updates permissions[category][perm]
		// So we don't need to toggle it again, just update the octal
		updateOctal();
	}

	function handleOctalChange(value) {
		octalPermissions = value;
		const match = value.match(/^0?([0-7]{3,4})$/);
		if (match) {
			let octalValue = parseInt(match[1], 8);
			octalValue = octalValue & 0o777;
			updatePermissionsFromOctal(octalValue);
		}
	}

	function setPreset(mode) {
		mode = mode & 0o777;
		updatePermissionsFromOctal(mode);
	}

	async function handleSubmit() {
		if (!file || loading) return;

		// Clear previous error
		errorMessage = '';

		// Only SFTP supports chmod (not FTP or local)
		if (type === 'ftp') {
			errorMessage = 'FTP does not support changing file permissions. This is a read-only view.';
			return;
		}

		if (type === 'local') {
			errorMessage =
				'Local files do not support changing permissions via chmod. This feature is only available for remote SFTP connections.';
			return;
		}

		if (!sessionId) {
			errorMessage = 'No session ID available. Please reconnect.';
			return;
		}

		const match = octalPermissions.match(/^0?([0-7]{3,4})$/);
		if (!match) {
			errorMessage = 'Invalid permissions format. Use octal format (e.g., 0644)';
			return;
		}

		const mode = parseInt(match[1], 8) & 0o777;
		loading = true;
		errorMessage = '';

		// Log before chmod
		console.log('[FilePermissionsModal] Changing permissions:', {
			file: file.path,
			from: file.permissions,
			to: `0${mode.toString(8).padStart(3, '0')}`
		});

		try {
			const { chmodRemote, getRemoteFileStat } = await import('$lib/services/file-browser');
			await chmodRemote(sessionId, file.path, mode);

			// Verify permissions were actually changed by statting the file
			try {
				const statResult = await getRemoteFileStat(sessionId, file.path);

				// Use actual permissions from server
				const actualMode = statResult.mode !== undefined ? statResult.mode : mode;
				const actualPermissions =
					statResult.permissions || `0${actualMode.toString(8).padStart(3, '0')}`;

				// Trigger update in parent (pass file info for array update)
				// Reload file list to get actual permissions from server
				const eventDetail = {
					filePath: file.path,
					permissions: actualPermissions,
					mode: actualMode,
					sessionId: sessionId, // Include sessionId to identify which panel should reload
					type: type // Include type to identify which panel should reload
				};
				window.dispatchEvent(
					new CustomEvent('file-permissions-changed', {
						detail: eventDetail
					})
				);
			} catch (statError) {
				console.warn('[FilePermissionsModal] Failed to verify permissions after chmod:', statError);
				// Still dispatch event even if stat fails
				const eventDetail = {
					filePath: file.path,
					permissions: `0${mode.toString(8).padStart(3, '0')}`,
					mode: mode,
					sessionId: sessionId, // Include sessionId to identify which panel should reload
					type: type // Include type to identify which panel should reload
				};
				window.dispatchEvent(
					new CustomEvent('file-permissions-changed', {
						detail: eventDetail
					})
				);
			}

			open = false;
		} catch (e) {
			console.error('[FilePermissionsModal] Failed to change permissions:', e);
			console.error('[FilePermissionsModal] Error details:', {
				name: e?.name,
				message: e?.message,
				stack: e?.stack,
				toString: e?.toString(),
				fullError: e
			});
			// Handle different error types
			const errorMsg = e?.message || e?.toString() || String(e) || 'Unknown error';
			errorMessage = `Failed to change permissions: ${errorMsg}`;
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		open = false;
		errorMessage = '';
	}

	function formatPermissionString() {
		const rwx = cat => {
			return `${cat.read ? 'r' : '-'}${cat.write ? 'w' : '-'}${cat.execute ? 'x' : '-'}`;
		};
		return `${rwx(permissions.owner)}${rwx(permissions.group)}${rwx(permissions.others)}`;
	}
</script>

<Modal {open} size="md" onclose={handleClose}>
	<ModalHeader title={isReadOnly ? 'View Permissions' : 'Edit Permissions'} onclose={handleClose}>
		<div class="flex items-center gap-2">
			<Shield size={18} class="text-green-400" />
			<span>{file?.name || 'File'}</span>
			{#if isReadOnly}
				<span class="text-xs text-white/60">(Read-only - FTP doesn't support chmod)</span>
			{/if}
		</div>
	</ModalHeader>
	<ModalBody>
		{#if file}
			<div class="flex flex-col gap-6">
				<!-- Error Message -->
				{#if errorMessage}
					<div class="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
						<p class="text-sm text-red-400">{errorMessage}</p>
					</div>
				{/if}

				<!-- Octal Input -->
				<div>
					<label for="octal-input" class="block text-sm font-medium text-white/80 mb-2">
						Permissions (Octal)
					</label>
					<Input
						id="octal-input"
						type="text"
						bind:value={octalPermissions}
						oninput={e => handleOctalChange(e.target.value)}
						placeholder="0644"
						class="font-mono"
					/>
					<p class="text-xs text-white/60 mt-1">
						Enter permissions in octal format (e.g., 0644, 0755)
					</p>
				</div>

				<!-- Permission Breakdown -->
				<div>
					<div class="block text-sm font-medium text-white/80 mb-3">
						Permissions: <span class="font-mono text-white">{formatPermissionString()}</span>
					</div>
					<div class="space-y-4">
						<!-- Owner -->
						<div>
							<p class="text-sm font-medium text-white/70 mb-2">Owner</p>
							<div class="flex gap-4">
								<Checkbox
									bind:checked={permissions.owner.read}
									onchange={() => handlePermissionChange('owner', 'read')}
									label="Read"
									disabled={isReadOnly}
								/>
								<Checkbox
									bind:checked={permissions.owner.write}
									onchange={() => handlePermissionChange('owner', 'write')}
									label="Write"
									disabled={isReadOnly}
								/>
								<Checkbox
									bind:checked={permissions.owner.execute}
									onchange={() => handlePermissionChange('owner', 'execute')}
									label="Execute"
									disabled={isReadOnly}
								/>
							</div>
						</div>

						<!-- Group -->
						<div>
							<p class="text-sm font-medium text-white/70 mb-2">Group</p>
							<div class="flex gap-4">
								<Checkbox
									bind:checked={permissions.group.read}
									onchange={() => handlePermissionChange('group', 'read')}
									label="Read"
									disabled={isReadOnly}
								/>
								<Checkbox
									bind:checked={permissions.group.write}
									onchange={() => handlePermissionChange('group', 'write')}
									label="Write"
									disabled={isReadOnly}
								/>
								<Checkbox
									bind:checked={permissions.group.execute}
									onchange={() => handlePermissionChange('group', 'execute')}
									label="Execute"
									disabled={isReadOnly}
								/>
							</div>
						</div>

						<!-- Others -->
						<div>
							<p class="text-sm font-medium text-white/70 mb-2">Others</p>
							<div class="flex gap-4">
								<Checkbox
									bind:checked={permissions.others.read}
									onchange={() => handlePermissionChange('others', 'read')}
									label="Read"
									disabled={isReadOnly}
								/>
								<Checkbox
									bind:checked={permissions.others.write}
									onchange={() => handlePermissionChange('others', 'write')}
									label="Write"
									disabled={isReadOnly}
								/>
								<Checkbox
									bind:checked={permissions.others.execute}
									onchange={() => handlePermissionChange('others', 'execute')}
									label="Execute"
									disabled={isReadOnly}
								/>
							</div>
						</div>
					</div>
				</div>

				<!-- Quick Presets -->
				<div>
					<p class="text-sm font-medium text-white/80 mb-3">Quick Presets</p>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							onclick={() => setPreset(0o644)}
							disabled={isReadOnly}
							class="group relative px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10"
						>
							<div class="flex flex-col items-start gap-0.5">
								<span
									class="text-white font-mono font-semibold text-sm group-hover:text-green-400 transition-colors"
									>0644</span
								>
								<span class="text-white/60 text-xs group-hover:text-white/80 transition-colors"
									>rw-r--r--</span
								>
							</div>
						</button>
						<button
							type="button"
							onclick={() => setPreset(0o755)}
							disabled={isReadOnly}
							class="group relative px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10"
						>
							<div class="flex flex-col items-start gap-0.5">
								<span
									class="text-white font-mono font-semibold text-sm group-hover:text-green-400 transition-colors"
									>0755</span
								>
								<span class="text-white/60 text-xs group-hover:text-white/80 transition-colors"
									>rwxr-xr-x</span
								>
							</div>
						</button>
						<button
							type="button"
							onclick={() => setPreset(0o600)}
							disabled={isReadOnly}
							class="group relative px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10"
						>
							<div class="flex flex-col items-start gap-0.5">
								<span
									class="text-white font-mono font-semibold text-sm group-hover:text-green-400 transition-colors"
									>0600</span
								>
								<span class="text-white/60 text-xs group-hover:text-white/80 transition-colors"
									>rw-------</span
								>
							</div>
						</button>
						<button
							type="button"
							onclick={() => setPreset(0o777)}
							disabled={isReadOnly}
							class="group relative px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10"
						>
							<div class="flex flex-col items-start gap-0.5">
								<span
									class="text-white font-mono font-semibold text-sm group-hover:text-green-400 transition-colors"
									>0777</span
								>
								<span class="text-white/60 text-xs group-hover:text-white/80 transition-colors"
									>rwxrwxrwx</span
								>
							</div>
						</button>
					</div>
				</div>
			</div>
		{/if}
	</ModalBody>
	<ModalFooter>
		<Button variant="ghost" onclick={handleClose}>Close</Button>
		{#if !isReadOnly}
			<Button variant="primary" onclick={handleSubmit} disabled={loading}>
				{#if loading}
					<div class="flex items-center gap-2">
						<Spinner size="sm" color="white" />
						<span>Applying...</span>
					</div>
				{:else}
					Apply Permissions
				{/if}
			</Button>
		{/if}
	</ModalFooter>
</Modal>
