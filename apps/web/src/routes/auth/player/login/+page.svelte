<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { loginPlayer } from '$lib/api';

	let failed = $state(false);

	onMount(async () => {
		const token = page.url.searchParams.get('token')?.trim();
		if (!token) {
			failed = true;
			return;
		}

		try {
			const response = await loginPlayer(token);
			localStorage.setItem('player_token', response.token);
			await goto(`/play/${encodeURIComponent(response.gameId)}`, { replaceState: true });
		} catch {
			failed = true;
		}
	});
</script>

<svelte:head>
	<title>Player Login</title>
</svelte:head>

<main class="grid min-h-screen place-items-center bg-[var(--white)] p-8 text-[var(--black)]">
	{#if failed}
		<p class="text-center text-[var(--danger)]" role="alert">Failed to login please contact GM</p>
	{:else}
		<p role="status" aria-live="polite">Please Wait...</p>
	{/if}
</main>
