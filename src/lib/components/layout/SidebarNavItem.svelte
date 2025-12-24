<script>
	import { page } from '$app/stores';
	const { label, href, iconComponent, showBadge = false } = $props();

	const isActive = $derived($page.url.pathname === href);
</script>

<a
	{href}
	class="sidebar-nav-item relative flex items-center gap-2 px-2 py-2 rounded-lg transition-colors {isActive
		? 'bg-(--color-bg-active) text-text-primary'
		: 'text-text-secondary hover:bg-(--color-bg-elevated) hover:text-text-primary'}"
	data-label={label}
	title={label}
>
	{#if iconComponent}
		{@const Icon = iconComponent}
		<span class="relative">
			<Icon size={16} />
			{#if showBadge}
				<span
					class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"
					aria-label="New update available"
				></span>
			{/if}
		</span>
	{/if}
	<span class="sidebar-label text-xs font-normal">{label}</span>
</a>

<style>
	.sidebar-nav-item {
		position: relative;
	}

	.sidebar-label {
		white-space: nowrap;
	}

	/* Responsive behavior: hide label under 900px and show tooltip on hover */
	@media (max-width: 900px) {
		.sidebar-label {
			display: none;
		}

		.sidebar-nav-item::after {
			content: attr(data-label);
			position: absolute;
			left: 100%;
			top: 50%;
			transform: translateY(-50%);
			margin-left: 8px;
			background: var(--color-bg-secondary);
			color: var(--color-text-primary, #fff);
			padding: 4px 8px;
			border-radius: 4px;
			font-size: 11px;
			white-space: nowrap;
			opacity: 0;
			pointer-events: none;
			transition: opacity 0.15s ease;
			z-index: 20;
		}

		.sidebar-nav-item:hover::after {
			opacity: 1;
		}
	}
</style>
