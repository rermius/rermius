import { writable, get } from 'svelte/store';

/**
 * Quick Edit Store
 * Manages multiple editor instances scoped by panelId (sessionId || 'local')
 */
function createQuickEditStore() {
	const { subscribe, set, update } = writable([]);

	return {
		subscribe,

		/**
		 * Open a file for editing in a panel
		 * If already open in the same panel, maximize it
		 * Otherwise, add new instance and maximize it (minimize others in same panel)
		 */
		open(panelId, { filePath, fileName, sessionId, isLocal }) {
			update(instances => {
				// Check if already open in this panel
				const existing = instances.find(i => i.panelId === panelId && i.filePath === filePath);

				if (existing) {
					// Already open - maximize it, minimize others in same panel
					return instances.map(i => {
						if (i.panelId !== panelId) return i;
						return { ...i, state: i.id === existing.id ? 'maximized' : 'minimized' };
					});
				}

				// New instance - add and maximize, minimize others in same panel
				const newInstance = {
					id: crypto.randomUUID(),
					panelId,
					filePath,
					fileName,
					sessionId,
					isLocal,
					state: 'maximized',
					isDirty: false
				};

				const updated = instances.map(i => {
					if (i.panelId !== panelId) return i;
					return { ...i, state: 'minimized' };
				});

				return [...updated, newInstance];
			});
		},

		/**
		 * Minimize an editor
		 */
		minimize(id) {
			update(instances =>
				instances.map(i => (i.id === id ? { ...i, state: 'minimized' } : i))
			);
		},

		/**
		 * Maximize an editor (minimizes others in the same panel)
		 */
		maximize(id) {
			const instances = get({ subscribe });
			const target = instances.find(i => i.id === id);
			if (!target) return;

			update(all =>
				all.map(i => {
					if (i.panelId !== target.panelId) return i;
					return { ...i, state: i.id === id ? 'maximized' : 'minimized' };
				})
			);
		},

		/**
		 * Close an editor instance (caller should check dirty first)
		 */
		close(id) {
			update(instances => instances.filter(i => i.id !== id));
		},

		/**
		 * Update dirty state
		 */
		setDirty(id, dirty) {
			update(instances =>
				instances.map(i => (i.id === id ? { ...i, isDirty: dirty } : i))
			);
		},

		/**
		 * Get instances for a specific panel
		 */
		getByPanel(panelId) {
			return get({ subscribe }).filter(i => i.panelId === panelId);
		}
	};
}

export const quickEditStore = createQuickEditStore();
