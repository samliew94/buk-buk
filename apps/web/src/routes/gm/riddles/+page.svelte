<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import { deleteRiddle, getRiddles, InvalidApiResponseError, type Riddle } from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import IconButton from '$lib/shared/ui/IconButton.svelte';
	import Input from '$lib/shared/ui/Input.svelte';

	type PageState = 'loading' | 'ready' | 'error';
	let pageState = $state<PageState>('loading');
	let riddles = $state<Riddle[]>([]);
	let error = $state('');
	let deletingId = $state<number | null>(null);
	let searchQuery = $state('');
	const filteredRiddles = $derived(
		riddles.filter((riddle) =>
			riddle.answer.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
		)
	);

	function isUnauthorized(cause: unknown) {
		return isAxiosError(cause) && cause.response?.status === 401;
	}

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
			) {
				return data.error;
			}
			if (cause.response.status === 409)
				return 'Cannot delete this riddle because it is referenced by a station or preset.';
			return 'Unable to load riddles. Please try again.';
		}
		if (cause instanceof Error && cause.message) return cause.message;
		return 'Unable to load riddles. Please try again.';
	}

	async function requireToken(): Promise<string | null> {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return null;
		}
		return token;
	}

	async function loadRiddles() {
		const token = await requireToken();
		if (!token) return;
		pageState = 'loading';
		error = '';
		try {
			riddles = await getRiddles(token);
			pageState = 'ready';
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('gm_token');
				await goto('/auth/gm/login', { replaceState: true });
				return;
			}
			error = getErrorMessage(cause);
			pageState = 'error';
		}
	}

	async function handleDelete(id: number) {
		if (deletingId !== null) return;
		const token = await requireToken();
		if (!token) return;
		deletingId = id;
		error = '';
		try {
			await deleteRiddle(id, token);
			riddles = riddles.filter((riddle) => riddle.id !== id);
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('gm_token');
				await goto('/auth/gm/login', { replaceState: true });
				return;
			}
			error = getErrorMessage(cause);
		} finally {
			deletingId = null;
		}
	}

	onMount(() => void loadRiddles());
</script>

<svelte:head><title>GM Riddles</title></svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-7xl gap-6 p-4">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="grid gap-2">
				<a
					href="/gm"
					class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
				>
					<Icon icon="lucide:arrow-left" aria-hidden="true" /> Management
				</a>
				<h1 class="text-3xl font-semibold">Riddles</h1>
			</div>
			<a
				href="/gm/riddles/new"
				class="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--white)] hover:opacity-90"
			>
				<Icon icon="lucide:plus" aria-hidden="true" /> New riddle
			</a>
		</div>

		{#if error}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-4 text-[var(--danger)]"
				role="alert"
			>
				{error}
				{#if pageState === 'error'}<div class="mt-4 max-w-32">
						<Button onclick={() => void loadRiddles()}>Retry</Button>
					</div>{/if}
			</div>
		{/if}

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				Loading riddles...
			</div>
		{:else if pageState === 'ready' && riddles.length === 0}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
				<p class="text-[var(--grey)]">No riddles yet.</p>
			</div>
		{:else if pageState === 'ready'}
			<div class="grid gap-4">
				<Input id="riddle-search" placeholder="Search riddle answers" bind:value={searchQuery} />
				{#if filteredRiddles.length === 0}
					<div class="rounded-lg border border-dashed border-black/15 p-6 text-[var(--grey)]">
						No riddles match this answer search.
					</div>
				{:else}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						{#each filteredRiddles as riddle (riddle.id)}
							<article
								class="flex items-center justify-between gap-4 rounded-lg border border-black/10 bg-[var(--white)] p-4 shadow-sm"
							>
								<h2 class="min-w-0 flex-1 line-clamp-3 font-semibold">{riddle.answer}</h2>
								<div class="flex shrink-0 gap-1">
									<IconButton
										href={`/gm/riddles/${riddle.id}`}
										icon="lucide:pencil"
										label={`Edit riddle ${riddle.id}`}
									/>
									<IconButton
										icon={deletingId === riddle.id ? 'lucide:loader-circle' : 'lucide:trash-2'}
										iconClass={deletingId === riddle.id ? 'animate-spin text-xl' : 'text-xl'}
										label={`Delete riddle ${riddle.id}`}
										variant="danger"
										disabled={deletingId !== null}
										onclick={() => void handleDelete(riddle.id)}
									/>
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</section>
</main>
