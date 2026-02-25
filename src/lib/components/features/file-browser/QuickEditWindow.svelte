<script>
	import { quickEditStore } from '$lib/stores/quick-edit.store';
	import { readFileContent, writeFileContent } from '$lib/services';
	import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '$lib/components/ui';
	import { Minus, Square, X, Loader2 } from 'lucide-svelte';

	const { instance } = $props();

	let editorContainer = $state(null);
	let editorInstance = $state(null);
	let originalContent = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let loadError = $state('');
	let showDiscardConfirm = $state(false);

	// Language detection from file extension
	function detectLanguage(name) {
		const ext = name.split('.').pop()?.toLowerCase() || '';
		const map = {
			js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
			ts: 'typescript', tsx: 'typescript',
			json: 'json', html: 'html', htm: 'html',
			css: 'css', scss: 'scss', less: 'less',
			md: 'markdown', markdown: 'markdown',
			py: 'python', rs: 'rust', go: 'go', java: 'java',
			c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
			rb: 'ruby', php: 'php',
			sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell',
			sql: 'sql', xml: 'xml',
			yaml: 'yaml', yml: 'yaml',
			toml: 'ini', ini: 'ini', conf: 'ini', env: 'ini',
			dockerfile: 'dockerfile',
			svelte: 'html', vue: 'html',
			swift: 'swift', lua: 'lua', r: 'r',
			txt: 'plaintext', log: 'plaintext', csv: 'plaintext'
		};
		return map[ext] || 'plaintext';
	}

	async function initEditor(content) {
		if (!editorContainer) return;
		try {
			// Setup Monaco workers for Vite (must be before first import)
			self.MonacoEnvironment = {
				getWorker: function (_moduleId, label) {
					if (label === 'json') {
						return new Worker(
							new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
							{ type: 'module' }
						);
					}
					if (label === 'css' || label === 'scss' || label === 'less') {
						return new Worker(
							new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
							{ type: 'module' }
						);
					}
					if (label === 'html' || label === 'handlebars' || label === 'razor') {
						return new Worker(
							new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
							{ type: 'module' }
						);
					}
					if (label === 'typescript' || label === 'javascript') {
						return new Worker(
							new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
							{ type: 'module' }
						);
					}
					return new Worker(
						new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
						{ type: 'module' }
					);
				}
			};

			const monaco = await import('monaco-editor');

			if (editorInstance) {
				editorInstance.dispose();
			}

			editorInstance = monaco.editor.create(editorContainer, {
				value: content,
				language: detectLanguage(instance.fileName),
				theme: 'vs-dark',
				automaticLayout: true,
				minimap: { enabled: true },
				fontSize: 14,
				fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
				lineNumbers: 'on',
				wordWrap: 'on',
				scrollBeyondLastLine: false,
				renderWhitespace: 'selection',
				bracketPairColorization: { enabled: true },
				smoothScrolling: true,
				cursorBlinking: 'smooth',
				cursorSmoothCaretAnimation: 'on',
				padding: { top: 8, bottom: 8 },
				roundedSelection: true,
				tabSize: 2
			});

			editorInstance.onDidChangeModelContent(() => {
				const dirty = editorInstance.getValue() !== originalContent;
				quickEditStore.setDirty(instance.id, dirty);
			});

			// Ctrl+S to save
			editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
				handleSave();
			});
		} catch (err) {
			console.error('[QuickEdit] Failed to init Monaco:', err);
			loadError = 'Failed to initialize editor: ' + err.message;
		}
	}

	// Track which file we've loaded to avoid re-loading on isDirty changes
	let loadedFileId = $state(null);
	let editorReady = $state(false);

	// Load file only when the file identity changes (not on isDirty updates)
	$effect(() => {
		const fileId = instance?.id;
		const state = instance?.state;
		if (fileId && state === 'maximized' && fileId !== loadedFileId) {
			loadedFileId = fileId;
			editorReady = false;
			loadFile();
		}
	});

	// Init editor once content is loaded
	$effect(() => {
		if (editorContainer && !isLoading && !loadError && !editorReady && loadedFileId) {
			editorReady = true;
			initEditor(originalContent);
		}
	});

	// Cleanup when unmounted
	$effect(() => {
		return () => {
			if (editorInstance) {
				editorInstance.dispose();
				editorInstance = null;
			}
		};
	});

	async function loadFile() {
		if (!instance) return;
		isLoading = true;
		loadError = '';
		try {
			const content = await readFileContent(
				instance.sessionId,
				instance.filePath,
				instance.isLocal
			);
			originalContent = content;
		} catch (err) {
			console.error('[QuickEdit] Failed to load file:', err);
			loadError = err.toString();
		} finally {
			isLoading = false;
		}
	}

	async function handleSave() {
		if (!editorInstance || isSaving) return;
		isSaving = true;
		try {
			const content = editorInstance.getValue();
			await writeFileContent(
				instance.sessionId,
				instance.filePath,
				content,
				instance.isLocal
			);
			originalContent = content;
			quickEditStore.setDirty(instance.id, false);
		} catch (err) {
			console.error('[QuickEdit] Failed to save:', err);
		} finally {
			isSaving = false;
		}
	}

	function handleMinimize() {
		quickEditStore.minimize(instance.id);
	}

	function handleMaximize() {
		quickEditStore.maximize(instance.id);
	}

	function handleClose() {
		if (instance.isDirty) {
			showDiscardConfirm = true;
		} else {
			doClose();
		}
	}

	function doClose() {
		if (editorInstance) {
			editorInstance.dispose();
			editorInstance = null;
		}
		showDiscardConfirm = false;
		quickEditStore.close(instance.id);
	}

	function handleCancelDiscard() {
		showDiscardConfirm = false;
	}
</script>

{#if instance.state === 'maximized'}
	<!-- Backdrop -->
	<div class="fixed inset-0 bg-black/40 backdrop-blur-sm" style="z-index: var(--z-modal-backdrop, 90);"></div>

	<!-- Editor Window (fixed fullscreen overlay with margin) -->
	<div class="quick-edit-window fixed flex flex-col bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden"
		style="z-index: var(--z-modal, 100); inset: 32px 48px;"
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-3 py-2 bg-bg-tertiary border-b border-border select-none">
			<div class="flex items-center gap-2 min-w-0 flex-1">
				{#if instance.isDirty}
					<span class="text-amber-400 text-xs shrink-0">●</span>
				{/if}
				<span class="text-sm text-text-primary truncate" title={instance.filePath}>
					{instance.filePath}
				</span>
			</div>
			<div class="flex items-center gap-0.5 shrink-0 ml-2">
				<button
					type="button"
					class="p-1.5 rounded hover:bg-white/10 transition-colors text-text-secondary hover:text-text-primary"
					onclick={handleMinimize}
					title="Minimize"
				>
					<Minus size={14} />
				</button>
				<button
					type="button"
					class="p-1.5 rounded hover:bg-white/10 transition-colors text-text-secondary hover:text-text-primary"
					onclick={handleMaximize}
					title="Maximize"
				>
					<Square size={12} />
				</button>
				<button
					type="button"
					class="p-1.5 rounded hover:bg-red-500/20 transition-colors text-text-secondary hover:text-red-400"
					onclick={handleClose}
					title="Close"
				>
					<X size={14} />
				</button>
			</div>
		</div>

		<!-- Editor Body -->
		<div class="flex-1 min-h-0">
			{#if isLoading}
				<div class="flex items-center justify-center h-full gap-3">
					<Loader2 size={24} class="animate-spin text-primary" />
					<span class="text-text-secondary text-sm">Loading...</span>
				</div>
			{:else if loadError}
				<div class="flex items-center justify-center h-full">
					<div class="text-center px-4">
						<p class="text-red-400 text-sm mb-2">Failed to load file</p>
						<p class="text-text-tertiary text-xs">{loadError}</p>
					</div>
				</div>
			{:else}
				<div bind:this={editorContainer} class="w-full h-full"></div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex items-center justify-between px-3 py-2 bg-bg-tertiary border-t border-border">
			<div class="flex items-center gap-2">
				{#if instance.isDirty}
					<span class="text-xs text-amber-400">● Unsaved changes</span>
				{:else if !isLoading && !loadError}
					<span class="text-xs text-text-tertiary">No changes</span>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" onclick={handleClose} disabled={isSaving}>
					Cancel
				</Button>
				<Button
					variant="primary"
					size="sm"
					onclick={handleSave}
					disabled={!instance.isDirty || isSaving || isLoading || !!loadError}
				>
					{#if isSaving}
						<Loader2 size={14} class="animate-spin" />
						Saving...
					{:else}
						Save
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- Discard Confirmation -->
<Modal bind:open={showDiscardConfirm} size="sm">
	<ModalHeader title="Unsaved Changes" onclose={handleCancelDiscard} />
	<ModalBody>
		<p class="text-white/80">
			You have unsaved changes. Are you sure you want to discard them?
		</p>
		<p class="text-white/60 text-sm mt-2">This action cannot be undone.</p>
	</ModalBody>
	<ModalFooter>
		<Button variant="ghost" onclick={handleCancelDiscard}>Keep Editing</Button>
		<Button variant="danger" onclick={doClose}>Discard Changes</Button>
	</ModalFooter>
</Modal>
