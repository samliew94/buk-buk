<script lang="ts">
	import BucketImagePicker from '$lib/shared/BucketImagePicker.svelte';
	import Button from '$lib/shared/ui/Button.svelte';
	import TextArea from '$lib/shared/ui/TextArea.svelte';

	let {
		submitLabel = 'Create poses',
		loading = false,
		error = '',
		token,
		onunauthorized,
		onsave
	}: {
		submitLabel?: string;
		loading?: boolean;
		error?: string;
		token: string;
		onunauthorized?: () => void | Promise<void>;
		onsave: (input: { imageUrls: string[]; description: string | null }) => void;
	} = $props();

	let selectedUrls = $state<string[]>([]);
	let description = $state('');
	let pickerReady = $state(false);
	let validationError = $state('');

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		validationError = '';
		if (!pickerReady) {
			validationError = 'Image list is still loading.';
			return;
		}
		if (selectedUrls.length === 0) {
			validationError = 'Select at least one pose image.';
			return;
		}

		onsave({ imageUrls: selectedUrls, description: description.trim() || null });
	}
</script>

<form class="grid gap-6 pb-40" novalidate onsubmit={handleSubmit}>
	<div class="grid gap-5 rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm">
		<TextArea
			id="description"
			name="description"
			label="Shared description (optional)"
			placeholder="Applied to every selected pose"
			bind:value={description}
			rows={3}
		/>
	</div>
	<BucketImagePicker
		prefix="poses"
		{token}
		multiple
		bind:selectedUrls
		bind:ready={pickerReady}
		{onunauthorized}
	/>
	<div
		class="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-[var(--white)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(0_0_0_/_12%)]"
	>
		<div class="mx-auto grid w-full max-w-2xl gap-2">
			<p class="text-sm text-[var(--grey)]" aria-live="polite">
				{selectedUrls.length} image{selectedUrls.length === 1 ? '' : 's'} selected
			</p>
			<Button type="submit" {loading} loadingLabel="Saving...">{submitLabel}</Button>
			{#if validationError || error}
				<span class="text-sm text-[var(--danger)]" role="alert">{validationError || error}</span>
			{/if}
		</div>
	</div>
</form>
