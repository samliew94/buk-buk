<script lang="ts">
	import './layout.css';
	import FontHead from '@booking/ui/FontHead.svelte';
	let { children } = $props();
</script>

<FontHead />
{@render children()}
