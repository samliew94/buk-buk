<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import {
		cloneStationPreset,
		deleteStationPreset,
		getStationPresets,
		InvalidApiResponseError,
		type StationPreset
	} from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import IconButton from '$lib/shared/ui/IconButton.svelte';
	import Input from '$lib/shared/ui/Input.svelte';

	type PageState = 'loading' | 'ready' | 'empty' | 'error';
	let pageState = $state<PageState>('loading');
	let presets = $state<StationPreset[]>([]);
	let error = $state('');
	let cloningId = $state<number | null>(null);
	let deletingId = $state<number | null>(null);
	let deleteDialog = $state<HTMLDialogElement | null>(null);
	let deleteCandidate = $state<StationPreset | null>(null);
	let searchQuery = $state('');
	const filteredPresets = $derived(
		presets.filter((preset) =>
			preset.description.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
		)
	);

	function isUnauthorized(cause: unknown): boolean {
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
			return 'Unable to load station presets. Please try again.';
		}
		return cause instanceof Error && cause.message
			? cause.message
			: 'Unable to load station presets. Please try again.';
	}

	async function handleClone(preset: StationPreset) {
		if (cloningId !== null || deletingId !== null) return;
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}

		cloningId = preset.id;
		error = '';
		try {
			const cloned = await cloneStationPreset(preset.id, preset.description, token);
			await goto(`/gm/station-presets/${cloned.id}`);
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('gm_token');
				await goto('/auth/gm/login', { replaceState: true });
				return;
			}
			error = getErrorMessage(cause);
		} finally {
			cloningId = null;
		}
	}

	function requestDelete(preset: StationPreset) {
		if (cloningId !== null || deletingId !== null) return;
		deleteCandidate = preset;
		deleteDialog?.showModal();
	}

	function closeDeleteDialog() {
		deleteDialog?.close();
		deleteCandidate = null;
	}

	function handleDeleteDialogClose() {
		deleteCandidate = null;
	}

	async function confirmDelete() {
		if (!deleteCandidate || cloningId !== null || deletingId !== null) return;
		const id = deleteCandidate.id;
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}

		deleteDialog?.close();
		deletingId = id;
		error = '';
		try {
			await deleteStationPreset(id, token);
			presets = presets.filter((preset) => preset.id !== id);
			if (presets.length === 0) pageState = 'empty';
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

	async function loadPresets() {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}

		pageState = 'loading';
		error = '';
		try {
			presets = await getStationPresets(token);
			pageState = presets.length === 0 ? 'empty' : 'ready';
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

	onMount(() => void loadPresets());
</script>

<svelte:head><title>GM Station Presets</title></svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-7xl gap-6 p-4">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="grid gap-2">
				<a
					href="/gm"
					class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
					><Icon icon="lucide:arrow-left" aria-hidden="true" /> Management</a
				>
				<p class="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">Content</p>
				<h1 class="text-3xl font-semibold">Station presets</h1>
			</div>
			<a
				href="/gm/station-presets/new"
				class="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--white)] hover:opacity-90"
				><Icon icon="lucide:plus" aria-hidden="true" /> New station preset</a
			>
		</div>

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				Loading station presets...
			</div>
		{:else if pageState === 'error'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="mt-4 max-w-32"><Button onclick={() => void loadPresets()}>Retry</Button></div>
			</div>
		{:else if pageState === 'empty'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
				<p class="text-[var(--grey)]">No station presets yet.</p>
				<div class="mt-4">
					<a
						href="/gm/station-presets/new"
						class="inline-flex rounded-md border border-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/5"
						>Create your first preset</a
					>
				</div>
			</div>
		{:else}
			<div class="grid gap-4">
				{#if error}
					<div
						class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-4 text-[var(--danger)]"
						role="alert"
					>
						{error}
					</div>
				{/if}
				<Input
					id="station-preset-search"
					placeholder="Search by station preset name"
					bind:value={searchQuery}
				/>
				{#if filteredPresets.length === 0}
					<div class="rounded-lg border border-dashed border-black/15 p-6 text-[var(--grey)]">
						No station presets match this search.
					</div>
				{:else}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						{#each filteredPresets as preset (preset.id)}
							<article
								class="grid gap-4 rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm"
							>
								<div class="flex items-start justify-between gap-3">
									<h2 class="line-clamp-3 min-w-0 flex-1 font-semibold">{preset.description}</h2>
									<div class="flex shrink-0 gap-1">
										<IconButton
											href={`/gm/station-presets/${preset.id}`}
											icon="lucide:pencil"
											label={`Edit station preset ${preset.id}`}
										/>
										<IconButton
											icon={cloningId === preset.id ? 'lucide:loader-circle' : 'lucide:copy'}
											iconClass={cloningId === preset.id ? 'animate-spin text-xl' : 'text-xl'}
											label={`Clone station preset ${preset.id}`}
											disabled={cloningId !== null || deletingId !== null}
											onclick={() => void handleClone(preset)}
										/>
										<IconButton
											icon={deletingId === preset.id ? 'lucide:loader-circle' : 'lucide:trash-2'}
											iconClass={deletingId === preset.id ? 'animate-spin text-xl' : 'text-xl'}
											label={`Delete station preset ${preset.id}`}
											variant="danger"
											disabled={cloningId !== null || deletingId !== null}
											onclick={() => requestDelete(preset)}
										/>
									</div>
								</div>
								<p class="text-sm text-[var(--grey)]">{preset.items.length} items</p>
							</article>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</section>
</main>

<dialog
	bind:this={deleteDialog}
	onclose={handleDeleteDialogClose}
	class="m-auto w-[min(100%-2rem,28rem)] rounded-lg border border-black/10 bg-[var(--white)] p-0 text-[var(--black)] shadow-xl backdrop:bg-black/40"
	aria-labelledby="delete-station-preset-title"
>
	<div class="grid gap-5 p-6">
		<div class="grid gap-2">
			<h2 id="delete-station-preset-title" class="text-xl font-semibold">Delete station preset?</h2>
			<p class="text-sm text-[var(--grey)]">
				This action cannot be undone. Delete {deleteCandidate?.description ??
					'this station preset'}?
			</p>
		</div>
		<div class="flex justify-end gap-1">
			<Button variant="grey" onclick={closeDeleteDialog}>Cancel</Button>
			<Button
				loading={deletingId !== null}
				loadingLabel="Deleting..."
				onclick={() => void confirmDelete()}
			>
				Delete
			</Button>
		</div>
	</div>
</dialog>
