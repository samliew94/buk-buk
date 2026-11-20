<script lang="ts">
	import './layout.css';
	import FontHead from '@booking/ui/FontHead.svelte';
	import { dev } from '$app/environment';
	import { onMount } from 'svelte';
	let { children } = $props();

	onMount(() => {
		if (dev || !window.isSecureContext || !('serviceWorker' in navigator)) return;

		void navigator.serviceWorker
			.register('/service-worker.js', { scope: '/', updateViaCache: 'none' })
			.catch((error) => console.warn('Admin service worker registration failed:', error));
	});
</script>

<FontHead />
{@render children()}
