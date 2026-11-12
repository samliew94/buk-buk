<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import {
		getGameUploads,
		InvalidApiResponseError,
		type GameUploadPhoto,
		type GalleryPhoto
	} from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';

	type PageState = 'loading' | 'ready' | 'empty' | 'error' | 'invalid';
	type DisplayPhoto = {
		key: string;
		imageUrl: string;
		fileName: string;
		label: string;
	};
	const MAX_FILES_PER_SHARE = 10;

	const gameId = $derived(page.params.gameId?.trim() ?? '');
	let pageState = $state<PageState>('loading');
	let photos = $state<DisplayPhoto[]>([]);
	let selectedKeys = $state<Set<string>>(new Set());
	let preparedFiles = $state<Map<string, File>>(new Map());
	let preparingKeys = $state<Set<string>>(new Set());
	let error = $state('');
	let shareError = $state('');
	let sharing = $state(false);
	let fileSharingAvailable = $state<boolean | null>(null);
	let activePreviewIndex = $state<number | null>(null);
	let previewCloseButton = $state<HTMLButtonElement | null>(null);
	let previewTrigger = $state<HTMLButtonElement | null>(null);
	const selectedCount = $derived(selectedKeys.size);
	const selectedFilesReady = $derived(
		selectedCount > 0 && [...selectedKeys].every((key) => preparedFiles.has(key))
	);
	const previewPhoto = $derived(
		activePreviewIndex === null ? null : (photos[activePreviewIndex] ?? null)
	);

	function isUnauthorized(cause: unknown): boolean {
		return isAxiosError(cause) && cause.response?.status === 401;
	}

	function getErrorMessage(cause: unknown): string {
		if (cause instanceof InvalidApiResponseError) return cause.message;
		if (isAxiosError(cause)) {
			if (!cause.response) return 'Unable to reach the server. Please try again.';
			if (cause.response.status === 404)
				return 'Game not found. Check the game link and try again.';
			const responseData: unknown = cause.response.data;
			if (
				typeof responseData === 'object' &&
				responseData !== null &&
				'error' in responseData &&
				typeof responseData.error === 'string' &&
				responseData.error.trim().length > 0
			)
				return responseData.error;
			return 'Unable to load uploads. Please try again.';
		}
		if (cause instanceof Error && cause.message.length > 0) return cause.message;
		return 'Unable to load uploads. Please try again.';
	}

	function getShareErrorMessage(cause: unknown): string {
		if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
			return 'Your browser blocked this share. Select fewer photos and try again.';
		}
		return cause instanceof Error ? cause.message : 'Unable to share selected photos.';
	}

	function detectFileSharing() {
		fileSharingAvailable =
			typeof navigator !== 'undefined' &&
			typeof navigator.share === 'function' &&
			typeof navigator.canShare === 'function';
	}

	function togglePhoto(photoKey: string) {
		const next = new Set(selectedKeys);
		if (next.has(photoKey)) {
			next.delete(photoKey);
		} else {
			if (next.size >= MAX_FILES_PER_SHARE) {
				shareError = `You can share up to ${MAX_FILES_PER_SHARE} photos at a time.`;
				return;
			}
			next.add(photoKey);
			const photo = photos.find((candidate) => candidate.key === photoKey);
			if (photo) void preparePhoto(photo);
		}
		selectedKeys = next;
		shareError = '';
	}

	function openPreview(index: number, trigger: HTMLButtonElement) {
		activePreviewIndex = index;
		previewTrigger = trigger;
		void tick().then(() => previewCloseButton?.focus());
	}

	function closePreview() {
		activePreviewIndex = null;
		void tick().then(() => previewTrigger?.focus());
	}

	function showPreviousPhoto() {
		if (activePreviewIndex === null || activePreviewIndex === 0) return;
		activePreviewIndex -= 1;
	}

	function showNextPhoto() {
		if (activePreviewIndex === null || activePreviewIndex >= photos.length - 1) return;
		activePreviewIndex += 1;
	}

	function handlePreviewKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closePreview();
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			showPreviousPhoto();
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			showNextPhoto();
		}
	}

	function handlePreviewBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) closePreview();
	}

	async function loadUploads() {
		const token = localStorage.getItem('player_token');
		if (!token) {
			await goto('/auth/player/login', { replaceState: true });
			return;
		}
		if (!gameId) {
			pageState = 'invalid';
			return;
		}

		pageState = 'loading';
		error = '';
		try {
			const uploads = await getGameUploads(gameId, token);
			photos = [
				...uploads.galleryPhotos.map((photo: GalleryPhoto): DisplayPhoto => ({
					key: `gallery:${photo.id}`,
					imageUrl: photo.imageUrl,
					fileName: `gallery-${photo.id}.jpg`,
					label: 'Generated gallery photo'
				})),
				...uploads.photos.map((photo: GameUploadPhoto): DisplayPhoto => ({
					key: `upload:${photo.id}`,
					imageUrl: photo.imageUrl,
					fileName: `station-${photo.stationNumber}-upload-${photo.id}.jpg`,
					label: `Uploaded station ${photo.stationNumber} photo`
				}))
			];
			selectedKeys = new Set();
			preparedFiles = new Map();
			preparingKeys = new Set();
			pageState = photos.length === 0 ? 'empty' : 'ready';
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('player_token');
				await goto('/auth/player/login', { replaceState: true });
				return;
			}
			error = getErrorMessage(cause);
			pageState = 'error';
		}
	}

	async function downloadPhoto(photo: DisplayPhoto): Promise<File> {
		const downloadUrl = photo.imageUrl;

		try {
			const response = await fetch(downloadUrl, { cache: 'no-store' });
			if (!response.ok) {
				throw new Error(`HTTP ${response.status} ${response.statusText}`);
			}
			const blob = await response.blob();
			return new File([blob], photo.fileName, { type: blob.type || 'image/jpeg' });
		} catch (cause) {
			console.error('Gallery share download failed', {
				photoKey: photo.key,
				sourceUrl: photo.imageUrl,
				downloadUrl,
				cause
			});

			if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
			const reason = cause instanceof Error ? cause.message : String(cause);
			throw new Error(`Photo ${photo.key} download failed: ${reason}. URL: ${downloadUrl}`);
		}
	}

	async function preparePhoto(photo: DisplayPhoto) {
		if (preparedFiles.has(photo.key) || preparingKeys.has(photo.key)) return;

		preparingKeys = new Set(preparingKeys).add(photo.key);
		try {
			const file = await downloadPhoto(photo);
			preparedFiles = new Map(preparedFiles).set(photo.key, file);
		} catch (cause) {
			if (selectedKeys.has(photo.key)) {
				const next = new Set(selectedKeys);
				next.delete(photo.key);
				selectedKeys = next;
				shareError = cause instanceof Error ? cause.message : 'Unable to prepare selected photo.';
			}
		} finally {
			const next = new Set(preparingKeys);
			next.delete(photo.key);
			preparingKeys = next;
		}
	}

	function shareSelected() {
		shareError = '';
		if (!selectedFilesReady) return;
		if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
			shareError = 'Photo sharing is not supported in this browser.';
			return;
		}

		const files = photos
			.filter((photo) => selectedKeys.has(photo.key))
			.map((photo) => preparedFiles.get(photo.key))
			.filter((file): file is File => file !== undefined);
		if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files })) {
			shareError = 'File sharing is not supported on this device or browser.';
			return;
		}

		sharing = true;
		try {
			void navigator
				.share({ files })
				.catch((cause: unknown) => {
					if (cause instanceof DOMException && cause.name === 'AbortError') return;
					shareError = getShareErrorMessage(cause);
				})
				.finally(() => {
					sharing = false;
				});
		} catch (cause) {
			sharing = false;
			shareError = getShareErrorMessage(cause);
		}
	}

	onMount(() => {
		detectFileSharing();
		void loadUploads();
	});
</script>

<svelte:head>
	<title>Uploads · Moon Rabbits</title>
</svelte:head>

<main
	class="relative min-h-screen overflow-y-auto bg-[#002e4d] bg-cover bg-center p-8 text-[var(--black)]"
	style="background-image: linear-gradient(rgb(0 0 0 / 90%), rgb(0 0 0 / 90%)), url('https://cdn.astra-cloud-solutions.com/xunbao/shared/bg-image-6.webp');"
>
	<section class="relative z-10 mx-auto grid w-full max-w-4xl gap-6 p-4 pb-40">
		<a
			href={`/play/${encodeURIComponent(gameId)}`}
			class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:outline-none"
		>
			<Icon icon="lucide:arrow-left" aria-hidden="true" />
			Back
		</a>

		<header class="grid gap-3 text-center text-[var(--white)]">
			<h1 class="text-3xl font-semibold">Gallery</h1>
			<div class="mx-auto h-px w-16 bg-[var(--accent)]" aria-hidden="true"></div>
			<p class="text-sm text-[var(--grey)]">
				Share the moment you found the moon rabbits on Instagram!
			</p>
		</header>

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				<p class="text-[var(--grey)]">Loading uploads...</p>
			</div>
		{:else if pageState === 'invalid'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>Invalid game link. Please use the game link provided by your game master.</p>
			</div>
		{:else if pageState === 'error'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="mt-4 max-w-32"><Button onclick={() => void loadUploads()}>Retry</Button></div>
			</div>
		{:else if pageState === 'empty'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
				<p class="text-[var(--grey)]">No uploads yet.</p>
			</div>
		{:else}
			<div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5" aria-label="Gallery photos">
				{#each photos as photo, index (photo.key)}
					<div
						class={`relative aspect-[3/4] overflow-hidden rounded-md border-2 bg-black/20 ${selectedKeys.has(photo.key) ? 'border-[var(--primary)]' : 'border-transparent'}`}
					>
						<button
							type="button"
							aria-label={`Preview ${photo.label}`}
							onclick={(event) => openPreview(index, event.currentTarget)}
							class="group absolute inset-0 block w-full text-left focus:ring-2 focus:ring-[var(--primary)] focus:outline-none"
						>
							<img
								src={photo.imageUrl}
								alt={photo.label}
								class="size-full object-cover transition group-hover:opacity-90"
								loading="lazy"
							/>
							{#if selectedKeys.has(photo.key)}
								<span class="absolute inset-0 bg-black/10" aria-hidden="true"></span>
							{/if}
						</button>
						<button
							type="button"
							aria-pressed={selectedKeys.has(photo.key)}
							aria-label={`${selectedKeys.has(photo.key) ? 'Deselect' : 'Select'} ${photo.label} for sharing`}
							title={selectedKeys.has(photo.key) ? 'Deselect photo' : 'Select photo'}
							onclick={() => togglePhoto(photo.key)}
							class="absolute top-1 right-1 z-10 grid size-11 place-items-center rounded-full bg-black/55 text-[var(--white)] transition hover:bg-black/75 focus:ring-2 focus:ring-[var(--white)] focus:outline-none"
						>
							<span
								class={`grid size-6 place-items-center rounded-full border ${selectedKeys.has(photo.key) ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-white/80'}`}
								aria-hidden="true"
							>
								{#if selectedKeys.has(photo.key)}
									<Icon icon="lucide:check" class="text-sm" />
								{/if}
							</span>
						</button>
					</div>
				{/each}
			</div>

			<section
				class="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(0_0_0_/_20%)] backdrop-blur"
				aria-live="polite"
			>
				<div class="mx-auto grid w-full max-w-4xl gap-3">
					<p class="text-center text-sm text-[var(--white)]">
						{selectedCount} selected · {MAX_FILES_PER_SHARE} max
					</p>
					<Button
						onclick={shareSelected}
						disabled={selectedCount === 0 || !selectedFilesReady}
						loading={sharing || (selectedCount > 0 && !selectedFilesReady)}
						loadingLabel={sharing ? 'Sharing...' : 'Preparing photos...'}
					>
						<Icon icon="lucide:share-2" class="mr-2 inline-block" aria-hidden="true" />
						Share
					</Button>
					{#if fileSharingAvailable === false}
						<p class="text-center text-sm text-[var(--warning)]" role="status">
							File sharing is unavailable in this browser or device.
						</p>
					{/if}
					{#if shareError}<p
							class="text-center text-sm break-all text-[var(--danger)]"
							role="alert"
						>
							{shareError}
						</p>{/if}
				</div>
			</section>
		{/if}
	</section>
</main>

{#if previewPhoto && activePreviewIndex !== null}
	<dialog
		open
		tabindex="-1"
		aria-modal="true"
		aria-label="Photo preview"
		onkeydown={handlePreviewKeydown}
		onclick={handlePreviewBackdropClick}
		class="fixed inset-0 z-50 m-0 h-full w-full max-w-none border-0 bg-black/90 p-0 text-[var(--white)] backdrop:bg-black/90"
	>
		<div
			class="pointer-events-none flex min-h-full w-full items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]"
		>
			<div
				class="pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col gap-3"
			>
				<div class="flex items-center justify-between gap-2">
					<p class="min-w-0 truncate text-sm text-white/75">
						Photo {activePreviewIndex + 1} of {photos.length}
					</p>
					<button
						type="button"
						bind:this={previewCloseButton}
						aria-label="Close photo preview"
						title="Close"
						onclick={closePreview}
						class="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 focus:ring-2 focus:ring-[var(--white)] focus:outline-none"
					>
						<Icon icon="lucide:x" class="text-xl" aria-hidden="true" />
					</button>
				</div>

				<div class="relative flex min-h-0 flex-1 items-center justify-center">
					<img
						src={previewPhoto.imageUrl}
						alt={previewPhoto.label}
						class="max-h-[calc(100dvh-10rem)] max-w-full rounded-md object-contain"
					/>
					<button
						type="button"
						disabled={activePreviewIndex === 0}
						aria-label="Previous photo"
						title="Previous photo"
						onclick={showPreviousPhoto}
						class="absolute top-1/2 left-0 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 transition hover:bg-black/75 focus:ring-2 focus:ring-[var(--white)] focus:outline-none disabled:invisible"
					>
						<Icon icon="lucide:chevron-left" class="text-2xl" aria-hidden="true" />
					</button>
					<button
						type="button"
						disabled={activePreviewIndex === photos.length - 1}
						aria-label="Next photo"
						title="Next photo"
						onclick={showNextPhoto}
						class="absolute top-1/2 right-0 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 transition hover:bg-black/75 focus:ring-2 focus:ring-[var(--white)] focus:outline-none disabled:invisible"
					>
						<Icon icon="lucide:chevron-right" class="text-2xl" aria-hidden="true" />
					</button>
				</div>
			</div>
		</div>
	</dialog>
{/if}
