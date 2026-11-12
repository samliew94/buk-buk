<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&subset=latin&display=swap"
	/>
</svelte:head>

<div class="customer-app">
	{@render children()}
</div>
