<script lang="ts">
	import type { PoseInput } from '$lib/api';
	import BucketImagePicker from '$lib/shared/BucketImagePicker.svelte';
	import Button from '$lib/shared/ui/Button.svelte';
	import TextArea from '$lib/shared/ui/TextArea.svelte';

	let {
		initialValue = { imageUrl: '', description: null },
		submitLabel = 'Save pose',
		loading = false,
		error = '',
		token,
		onunauthorized,
		onsave
	}: {
		initialValue?: PoseInput;
		submitLabel?: string;
		loading?: boolean;
		error?: string;
		token: string;
		onunauthorized?: () => void | Promise<void>;
		onsave: (input: PoseInput) => void;
	} = $props();

	const startingValue = {
		imageUrl: initialValue.imageUrl,
		description: initialValue.description ?? ''
	};
	let imageUrl = $state(startingValue.imageUrl);
	let description = $state(startingValue.description);
	let pickerReady = $state(false);
	let validationError = $state('');

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		validationError = '';
		const normalizedImageUrl = imageUrl.trim();
		if (!pickerReady) {
			validationError = 'Image list is still loading.';
			return;
		}
		if (!normalizedImageUrl) {
			validationError = 'Select a pose image.';
			return;
		}

		onsave({ imageUrl: normalizedImageUrl, description: description.trim() || null });
	}
</script>

<form class="grid gap-6 pb-40" novalidate onsubmit={handleSubmit}>
	<div class="grid gap-5 rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm">
		<TextArea
			id="description"
			name="description"
			label="Description (optional)"
			placeholder="Describe this pose"
			bind:value={description}
			rows={3}
		/>
	</div>
	<BucketImagePicker
		prefix="poses"
		{token}
		bind:selectedUrl={imageUrl}
		bind:ready={pickerReady}
		{onunauthorized}
	/>
	<div
		class="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-[var(--white)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(0_0_0_/_12%)]"
	>
		<div class="mx-auto grid w-full max-w-2xl gap-2">
			<Button type="submit" {loading} loadingLabel="Saving...">{submitLabel}</Button>
			{#if validationError || error}
				<span class="text-sm text-[var(--danger)]" role="alert">{validationError || error}</span>
			{/if}
		</div>
	</div>
</form>
