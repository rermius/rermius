import { writable, get } from 'svelte/store';
import { panelStore } from '$lib/stores';

/**
 * Shared host/group panel state + handlers for home and group pages.
 * Consumers use the returned stores with Svelte's $ syntax.
 * @param {Object} options - Options
 * @param {Function} options.deleteGroupFn - Function to delete group
 * @param {Function} options.deleteHostFn - Function to delete host
 * @param {string} [options.featureKey='hosts'] - Feature key for panel store ('hosts' | 'group')
 */
export function useHostManagement({ deleteGroupFn, deleteHostFn, featureKey = 'hosts' }) {
	// Get initial state from panelStore
	const initialPanelState = panelStore.getPanelState(featureKey);

	const showPanel = writable(initialPanelState.showPanel);
	const panelType = writable(initialPanelState.panelType || 'host');
	const editingHost = writable(null);
	const editingGroup = writable(null);
	const showRemoveModal = writable(false);
	const removeTarget = writable(null); // { type: 'group' | 'host', entity }

	// Sync showPanel with panelStore changes
	const unsubscribePanelStore = panelStore.subscribe(state => {
		const panelState = state[featureKey];
		if (panelState) {
			showPanel.set(panelState.showPanel);
			panelType.set(panelState.panelType || 'host');
		}
	});

	const openAddHost = () => {
		editingGroup.set(null);
		editingHost.set(null);
		panelType.set('host');
		showPanel.set(true);
		panelStore.openPanel(featureKey, 'host', null);
	};

	const openEditHost = host => {
		editingGroup.set(null);
		editingHost.set(host);
		panelType.set('host');
		showPanel.set(true);
		panelStore.openPanel(featureKey, 'host', host?.id || null);
	};

	const openAddGroup = () => {
		editingHost.set(null);
		editingGroup.set(null);
		panelType.set('group');
		showPanel.set(true);
		panelStore.openPanel(featureKey, 'group', null);
	};

	const openEditGroup = group => {
		editingHost.set(null);
		editingGroup.set(group);
		panelType.set('group');
		showPanel.set(true);
		panelStore.openPanel(featureKey, 'group', group?.id || null);
	};

	const closePanel = () => {
		showPanel.set(false);
		editingHost.set(null);
		editingGroup.set(null);
		panelStore.closePanel(featureKey);
	};

	const requestRemoveGroup = group => {
		if (!group) return;
		removeTarget.set({ type: 'group', entity: group });
		showRemoveModal.set(true);
	};

	const requestRemoveHost = host => {
		if (!host) return;
		removeTarget.set({ type: 'host', entity: host });
		showRemoveModal.set(true);
	};

	const cancelRemove = () => {
		showRemoveModal.set(false);
		removeTarget.set(null);
	};

	const confirmRemove = async ({ onAfterDelete } = {}) => {
		const target = get(removeTarget);
		if (!target) return;

		try {
			if (target.type === 'group') {
				await deleteGroupFn(target.entity.id);
			} else if (target.type === 'host') {
				await deleteHostFn?.(target.entity.id);
			}

			cancelRemove();
			closePanel();
			onAfterDelete?.();
		} catch (error) {
			console.error('Failed to remove group:', error);
			cancelRemove();
		}
	};

	return {
		showPanel,
		panelType,
		editingHost,
		editingGroup,
		showRemoveModal,
		removeTarget,
		openAddHost,
		openEditHost,
		openAddGroup,
		openEditGroup,
		closePanel,
		requestRemoveGroup,
		requestRemoveHost,
		cancelRemove,
		confirmRemove,
		// Cleanup function (caller should handle cleanup if needed)
		cleanup: () => {
			unsubscribePanelStore();
		}
	};
}
