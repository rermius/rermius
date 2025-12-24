<script>
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	const {
		children,
		class: className = '',
		options = {
			scrollbars: {
				autoHide: 'scroll'
			}
		}
	} = $props();
</script>

<OverlayScrollbarsComponent {options} class={className}>
	{@render children()}
</OverlayScrollbarsComponent>
