<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAxiosError } from 'axios';
	import { createRiddle, InvalidApiResponseError, type RiddleInput } from '$lib/api';
	import Icon from '@iconify/svelte';
	import SaveRiddleForm from '$lib/shared/SaveRiddleForm.svelte';

	let error = $state('');
	let saving = $state(false);
	let gmToken = $state('');

	onMount(() => {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			void goto('/auth/gm/login', { replaceState: true });
			return;
		}
		gmToken = token;
	});

	function getErrorMessage(cause: unknown): string {
		if (cause instanceof InvalidApiResponseError) return cause.message;
		if (isAxiosError(cause)) {
			if (!cause.response) return 'Unable to reach the server. Please try again.';
			const data: unknown = cause.response.data;
			if (
				typeof data === 'object' &&
				data !== null &&
				'error' in data &&
				typeof data.error === 'string'
			)
				return data.error;
			return 'Unable to create riddle. Please try again.';
		}
		return cause instanceof Error && cause.message
			? cause.message
			: 'Unable to create riddle. Please try again.';
	}

	async function handleSave(input: RiddleInput) {
		const token = gmToken || localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}
		saving = true;
		error = '';
		try {
			await createRiddle(input, token);
			await goto('/gm/riddles');
		} catch (cause) {
			if (isAxiosError(cause) && cause.response?.status === 401) {
				localStorage.removeItem('gm_token');
				await goto('/auth/gm/login', { replaceState: true });
				return;
			}
			error = getErrorMessage(cause);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>New Riddle · GM</title></svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-2xl gap-6 p-4">
		<a
			href="/gm/riddles"
			class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
		>
			<Icon icon="lucide:arrow-left" aria-hidden="true" /> Back to riddles
		</a>
		<header class="grid gap-2">
			<p class="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">Content</p>
			<h1 class="text-3xl font-semibold">New riddle</h1>
		</header>
		{#if gmToken}
			<SaveRiddleForm submitLabel="Create riddle" loading={saving} {error} onsave={handleSave} />
		{/if}
	</section>
</main>
