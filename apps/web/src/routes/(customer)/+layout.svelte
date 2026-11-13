<script lang="ts">
	import FontHead from '@booking/ui/FontHead.svelte';
	let { children } = $props();
</script>

<FontHead />
<div class="customer-app">{@render children()}</div>
