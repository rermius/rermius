<script>
	import SidebarNavItem from './SidebarNavItem.svelte';
	import { ScrollArea } from '$lib/components/ui';
	import { Server, Key, Zap, CloudCheck } from 'lucide-svelte';
	import { hasNewSyncVersion } from '$lib/stores';

	const navItems = [
		{
			label: 'Hosts',
			href: '/',
			iconComponent: Server
		},
		{
			label: 'Keychain',
			href: '/keychain',
			iconComponent: Key
		},
		{
			label: 'Snippets',
			href: '/snippets',
			iconComponent: Zap
		},
		{
			label: 'Sync',
			href: '/sync',
			iconComponent: CloudCheck
		}
	];
</script>

<ScrollArea class="flex-1">
	<nav class="p-4">
		<ul class="space-y-2">
			{#each navItems as item (item.href)}
				<li>
					<SidebarNavItem {...item} showBadge={item.href === '/sync' && $hasNewSyncVersion} />
				</li>
			{/each}
		</ul>
	</nav>
</ScrollArea>
