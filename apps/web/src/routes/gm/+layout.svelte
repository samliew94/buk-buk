<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { children } = $props();
	let authenticated = $state(false);

	onMount(() => {
		if (!localStorage.getItem('gm_token')) {
			void goto('/auth/gm/login', { replaceState: true });
			return;
		}
		authenticated = true;
	});
</script>

{#if authenticated}{@render children()}{/if}
