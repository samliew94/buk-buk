<script lang="ts">
	import { onMount } from 'svelte';
	import { isAxiosError } from 'axios';
	import Icon from '@iconify/svelte';
	import {
		getAssetUrl,
		getBuckets,
		InvalidApiResponseError,
		uploadBuckets,
		type Bucket
	} from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';

	type LoadState = 'loading' | 'ready' | 'error';

	let {
		prefix,
		token,
		selectedUrl = $bindable(''),
		selectedUrls = $bindable<string[]>([]),
		multiple = false,
		ready = $bindable(false),
		onunauthorized
	}: {
		prefix: string;
		token: string;
		selectedUrl?: string;
		selectedUrls?: string[];
		multiple?: boolean;
		ready?: boolean;
		onunauthorized?: () => void | Promise<void>;
	} = $props();

	let images = $state<Bucket[]>([]);
	let loadState = $state<LoadState>('loading');
	let error = $state('');
	let uploading = $state(false);
	let uploadInput: HTMLInputElement;

	function errorMessage(cause: unknown): string {
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
			return 'Unable to load bucket images. Please try again.';
		}
		return cause instanceof Error && cause.message
			? cause.message
			: 'Unable to load bucket images. Please try again.';
	}

	function isUnauthorized(cause: unknown): boolean {
		return isAxiosError(cause) && cause.response?.status === 401;
	}

	function normalizedObjectPath(value: string): string {
		try {
			const pathname = new URL(value, 'http://bucket.local').pathname;
			const decoded = pathname
				.split('/')
				.map((part) => decodeURIComponent(part))
				.join('/');
			return decoded.replace(/^\/+/, '').replace(/^assets\//, '');
		} catch {
			return value
				.trim()
				.replace(/^\/+/, '')
				.replace(/^assets\//, '');
		}
	}

	function imageUrl(image: Bucket): string {
		return getAssetUrl(image.objectKey);
	}

	function isSelected(image: Bucket): boolean {
		const key = normalizedObjectPath(image.objectKey);
		return multiple
			? selectedUrls.some((url) => normalizedObjectPath(url) === key)
			: normalizedObjectPath(selectedUrl) === key;
	}

	function selectImage(image: Bucket) {
		const url = imageUrl(image);
		if (!multiple) {
			selectedUrl = url;
			return;
		}

		selectedUrls = isSelected(image)
			? selectedUrls.filter(
					(selected) => normalizedObjectPath(selected) !== normalizedObjectPath(image.objectKey)
				)
			: [...selectedUrls, url];
	}

	async function loadImages() {
		ready = false;
		loadState = 'loading';
		error = '';
		try {
			images = await getBuckets(prefix, token);
			if (!multiple && selectedUrl) {
				const selectedImage = images.find(
					(image) => normalizedObjectPath(selectedUrl) === normalizedObjectPath(image.objectKey)
				);
				selectedUrl = selectedImage ? imageUrl(selectedImage) : '';
			}
			if (multiple) {
				selectedUrls = selectedUrls.flatMap((url) => {
					const selectedImage = images.find(
						(image) => normalizedObjectPath(url) === normalizedObjectPath(image.objectKey)
					);
					return selectedImage ? [imageUrl(selectedImage)] : [];
				});
			}
			loadState = 'ready';
			ready = true;
		} catch (cause) {
			if (isUnauthorized(cause)) {
				await onunauthorized?.();
				return;
			}
			error = errorMessage(cause);
			loadState = 'error';
		}
	}

	async function handleUpload(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = input.files ? Array.from(input.files) : [];
		input.value = '';
		if (files.length === 0) return;

		uploading = true;
		error = '';
		try {
			await uploadBuckets(prefix, files, token);
			await loadImages();
		} catch (cause) {
			if (isUnauthorized(cause)) {
				await onunauthorized?.();
				return;
			}
			error = errorMessage(cause);
		} finally {
			uploading = false;
		}
	}

	onMount(() => void loadImages());
</script>

<section class="grid gap-4 rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="grid gap-1">
			<h2 class="font-semibold">{multiple ? 'Select images' : 'Select image'}</h2>
			<p class="text-sm text-[var(--grey)]">
				{multiple
					? 'Choose existing images or upload new images.'
					: 'Choose one existing image or upload new images.'}
			</p>
		</div>
		<div>
			<input
				bind:this={uploadInput}
				class="hidden"
				type="file"
				accept="image/*"
				multiple
				onchange={handleUpload}
			/>
			<Button
				type="button"
				loading={uploading}
				loadingLabel="Uploading..."
				onclick={() => uploadInput?.click()}
			>
				<Icon icon="lucide:upload" class="mr-2 inline-block" aria-hidden="true" /> Upload images
			</Button>
		</div>
	</div>

	{#if loadState === 'loading'}
		<div class="rounded-md border border-black/10 p-6 text-sm text-[var(--grey)]" role="status">
			Loading images...
		</div>
	{:else if loadState === 'error'}
		<div
			class="rounded-md border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-4 text-sm text-[var(--danger)]"
			role="alert"
		>
			{error}
			<button class="ml-2 font-semibold underline" type="button" onclick={() => void loadImages()}>
				Retry
			</button>
		</div>
	{:else if images.length === 0}
		<div class="rounded-md border border-dashed border-black/15 p-6 text-sm text-[var(--grey)]">
			No images uploaded for this section yet.
		</div>
	{:else}
		<div class="grid grid-cols-3 gap-3 sm:grid-cols-3 lg:grid-cols-5">
			{#each images as image (image.id)}
				{@const url = imageUrl(image)}
				<button
					type="button"
					class="relative min-w-0 overflow-hidden rounded-md border bg-[var(--white)] p-1 text-left transition hover:border-[var(--primary)] {isSelected(
						image
					)
						? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30'
						: 'border-black/10'}"
					aria-pressed={isSelected(image)}
					onclick={() => selectImage(image)}
				>
					<img
						src={url}
						alt="Uploaded file"
						class="aspect-square h-auto w-full max-w-full object-contain"
					/>
					{#if normalizedObjectPath(selectedUrl) === normalizedObjectPath(image.objectKey)}
						<span
							class="absolute top-2 right-2 rounded-full bg-[var(--primary)] p-1 text-[var(--white)]"
						>
							<Icon icon="lucide:check" width="16" height="16" aria-hidden="true" />
						</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	{#if error && loadState !== 'error'}
		<p class="text-sm text-[var(--danger)]" role="alert">{error}</p>
	{/if}
</section>
