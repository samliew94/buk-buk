<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import { deletePose, getPoses, InvalidApiResponseError, type Pose } from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import IconButton from '$lib/shared/ui/IconButton.svelte';
	import Input from '$lib/shared/ui/Input.svelte';

	type PageState = 'loading' | 'ready' | 'error';
	let pageState = $state<PageState>('loading');
	let poses = $state<Pose[]>([]);
	let error = $state('');
	let deletingId = $state<number | null>(null);
	let searchQuery = $state('');
	let deleteDialog = $state<HTMLDialogElement | null>(null);
	let deleteCandidate = $state<Pose | null>(null);
	const filteredPoses = $derived(
		poses.filter((pose) =>
			(pose.description ?? '').toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
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
			)
				return data.error;
			if (cause.response.status === 409)
				return 'Cannot delete this pose because it is referenced by a station or preset.';
			return 'Unable to load poses. Please try again.';
		}
		return cause instanceof Error && cause.message
			? cause.message
			: 'Unable to load poses. Please try again.';
	}
	async function requireToken(): Promise<string | null> {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return null;
		}
		return token;
	}
	async function loadPoses() {
		const token = await requireToken();
		if (!token) return;
		pageState = 'loading';
		error = '';
		try {
			poses = await getPoses(token);
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
	function requestDelete(pose: Pose) {
		if (deletingId !== null) return;
		deleteCandidate = pose;
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
		if (!deleteCandidate || deletingId !== null) return;
		const id = deleteCandidate.id;
		const token = await requireToken();
		if (!token) return;
		deleteDialog?.close();
		deletingId = id;
		error = '';
		try {
			await deletePose(id, token);
			poses = poses.filter((pose) => pose.id !== id);
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
	onMount(() => void loadPoses());
</script>

<svelte:head><title>GM Poses</title></svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-7xl gap-6 p-4">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="grid gap-2">
				<a
					href="/gm"
					class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
					><Icon icon="lucide:arrow-left" aria-hidden="true" /> Management</a
				>
				<h1 class="text-3xl font-semibold">Poses</h1>
			</div>
			<a
				href="/gm/poses/new"
				class="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--white)] hover:opacity-90"
				><Icon icon="lucide:plus" aria-hidden="true" /> New pose</a
			>
		</div>
		{#if error}<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-4 text-[var(--danger)]"
				role="alert"
			>
				{error}{#if pageState === 'error'}<div class="mt-4 max-w-32">
						<Button onclick={() => void loadPoses()}>Retry</Button>
					</div>{/if}
			</div>{/if}
		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				Loading poses...
			</div>
		{:else if pageState === 'ready' && poses.length === 0}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
				<p class="text-[var(--grey)]">No poses yet.</p>
			</div>
		{:else if pageState === 'ready'}
			<div class="grid gap-4">
				<Input id="pose-search" placeholder="Search poses" bind:value={searchQuery} />
				{#if filteredPoses.length === 0}
					<div class="rounded-lg border border-dashed border-black/15 p-6 text-[var(--grey)]">
						No poses match this description search.
					</div>
				{:else}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						{#each filteredPoses as pose (pose.id)}
							<article
								class="grid min-w-0 gap-4 rounded-lg border border-black/10 bg-[var(--white)] p-4 shadow-sm"
							>
								<div class="flex items-start justify-between gap-4">
									<div
										class="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/5"
									>
										{#if pose.imageUrl.trim()}
											<img
												src={pose.imageUrl}
												alt={`Pose ${pose.id}`}
												loading="lazy"
												class="h-full w-full rounded-md object-contain"
											/>
										{:else}
											<p class="text-sm text-[var(--grey)]">No pose image.</p>
										{/if}
									</div>
									<div class="flex shrink-0 gap-1">
										<IconButton
											href={`/gm/poses/${pose.id}`}
											icon="lucide:pencil"
											label={`Edit pose ${pose.id}`}
										/>
										<IconButton
											icon={deletingId === pose.id ? 'lucide:loader-circle' : 'lucide:trash-2'}
											iconClass={deletingId === pose.id ? 'animate-spin text-xl' : 'text-xl'}
											label={`Delete pose ${pose.id}`}
											variant="danger"
											disabled={deletingId !== null}
											onclick={() => requestDelete(pose)}
										/>
									</div>
								</div>
								<div class="min-h-12 text-sm text-[var(--grey)]">
									{pose.description ?? 'No description'}
								</div>
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
	aria-labelledby="delete-pose-title"
>
	<div class="grid gap-5 p-6">
		<div class="grid gap-2">
			<h2 id="delete-pose-title" class="text-xl font-semibold">Delete pose?</h2>
			<p class="text-sm text-[var(--grey)]">
				This action cannot be undone. Delete {deleteCandidate
					? 'pose ' + deleteCandidate.id
					: 'this pose'}?
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
