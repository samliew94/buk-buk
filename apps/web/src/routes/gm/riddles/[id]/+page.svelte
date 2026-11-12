<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { isAxiosError } from 'axios';
	import Icon from '@iconify/svelte';
	import {
		getRiddle,
		InvalidApiResponseError,
		updateRiddle,
		type Riddle,
		type RiddleInput
	} from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import SaveRiddleForm from '$lib/shared/SaveRiddleForm.svelte';

	type PageState = 'loading' | 'ready' | 'error' | 'not-found';
	const routeId = $derived(page.params.id);
	let pageState = $state<PageState>('loading');
	let riddle = $state<Riddle | null>(null);
	let error = $state('');
	let saving = $state(false);
	let gmToken = $state('');

	function parseId(value: string | undefined): number | null {
		if (!value || !/^\d+$/.test(value)) return null;
		const id = Number(value);
		return Number.isSafeInteger(id) && id > 0 ? id : null;
	}

	function isUnauthorized(cause: unknown) {
		return isAxiosError(cause) && cause.response?.status === 401;
	}
	function getErrorMessage(cause: unknown, fallback: string): string {
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
			return fallback;
		}
		return cause instanceof Error && cause.message ? cause.message : fallback;
	}

	async function loadRiddle() {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}
		gmToken = token;
		const id = parseId(routeId);
		if (id === null) {
			pageState = 'not-found';
			return;
		}
		pageState = 'loading';
		error = '';
		try {
			riddle = await getRiddle(id, token);
			pageState = 'ready';
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('gm_token');
				await goto('/auth/gm/login', { replaceState: true });
				return;
			}
			if (isAxiosError(cause) && cause.response?.status === 404) {
				pageState = 'not-found';
				return;
			}
			error = getErrorMessage(cause, 'Unable to load riddle. Please try again.');
			pageState = 'error';
		}
	}

	async function handleSave(input: RiddleInput) {
		const token = gmToken || localStorage.getItem('gm_token');
		const id = parseId(routeId);
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}
		if (id === null) {
			pageState = 'not-found';
			return;
		}
		saving = true;
		error = '';
		try {
			await updateRiddle(id, input, token);
			await goto('/gm/riddles');
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('gm_token');
				await goto('/auth/gm/login', { replaceState: true });
				return;
			}
			error = getErrorMessage(cause, 'Unable to save riddle. Please try again.');
		} finally {
			saving = false;
		}
	}

	onMount(() => void loadRiddle());
</script>

<svelte:head><title>{riddle ? `Edit Riddle · GM` : 'Edit Riddle · GM'}</title></svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-2xl gap-6 p-4">
		<a
			href="/gm/riddles"
			class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
			><Icon icon="lucide:arrow-left" aria-hidden="true" /> Back to riddles</a
		>
		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				Loading riddle...
			</div>
		{:else if pageState === 'not-found'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
				<h1 class="text-2xl font-semibold">Riddle not found</h1>
				<p class="mt-2 text-[var(--grey)]">This riddle does not exist.</p>
			</div>
		{:else if pageState === 'error'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="mt-4 max-w-32"><Button onclick={() => void loadRiddle()}>Retry</Button></div>
			</div>
		{:else if riddle}
			<header class="grid gap-2">
				<p class="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">Content</p>
				<h1 class="text-3xl font-semibold">Edit riddle</h1>
			</header>
			<SaveRiddleForm
				initialValue={riddle}
				submitLabel="Save riddle"
				loading={saving}
				{error}
				onsave={handleSave}
			/>
		{/if}
	</section>
</main>
