<script>
	import SidebarNav from './SidebarNav.svelte';
	import { ProfileSwitcher } from '$lib/components/features/workspace';
	import { ScrollArea } from '$lib/components/ui';
</script>

<aside class="sidebar-root w-50 bg-bg-secondary border-r border-border flex flex-col">
	<!-- Navigation -->
	<ScrollArea class="flex-1">
		<SidebarNav />
	</ScrollArea>

	<!-- Profile Switcher at bottom -->
	<div class="border-t border-border">
		<ProfileSwitcher />
	</div>
</aside>

<style>
	/* Responsive: collapse sidebar width on smaller screens */
	@media (max-width: 900px) {
		:global(.sidebar-root) {
			width: 64px;
		}

		/* Center icons when labels are hidden */
		:global(.sidebar-root .sidebar-nav-item) {
			justify-content: center;
		}
	}
</style>
