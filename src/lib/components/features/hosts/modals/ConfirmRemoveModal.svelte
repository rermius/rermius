<script>
	import { createEventDispatcher } from 'svelte';
	import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '$lib/components/ui';

	const {
		open = $bindable(false),
		// { type: 'group' | 'host', entity }
		target = null
	} = $props();

	const dispatch = createEventDispatcher();

	function handleCancel(event) {
		event?.stopPropagation();
		dispatch('cancel');
	}

	function handleConfirm(event) {
		event?.stopPropagation();
		dispatch('confirm');
	}
</script>

<Modal {open} size="sm" onclose={handleCancel}>
	<ModalHeader title="Remove" onclose={handleCancel} />
	<ModalBody>
		{#if target?.type === 'group'}
			<p class="text-white/80">
				Are you sure you want to remove the group
				<strong class="text-white">"{target?.entity?.name}"</strong>?
			</p>
			<p class="text-white/60 text-sm mt-2">
				All hosts in this group will be moved to another group. This action cannot be undone.
			</p>
		{:else if target?.type === 'host'}
			<p class="text-white/80">
				Are you sure you want to remove the host
				<strong class="text-white">"{target?.entity?.label}"</strong>?
			</p>
			<p class="text-white/60 text-sm mt-2">This action cannot be undone.</p>
		{/if}
	</ModalBody>
	<ModalFooter>
		<Button variant="ghost" onclick={handleCancel}>Cancel</Button>
		<Button variant="danger" onclick={handleConfirm}>Remove</Button>
	</ModalFooter>
</Modal>
