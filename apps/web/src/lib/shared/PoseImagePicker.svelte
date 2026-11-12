<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { Pose } from '$lib/api';
	import Input from '$lib/shared/ui/Input.svelte';

	let {
		poses,
		selectedId = $bindable(''),
		usedPoseIds = []
	}: {
		poses: Pose[];
		selectedId?: string;
		usedPoseIds?: number[];
	} = $props();
	let searchQuery = $state('');

	const availablePoses = $derived(
		poses.filter((pose) => !usedPoseIds.includes(pose.id) || String(pose.id) === selectedId)
	);
	const filteredPoses = $derived(
		availablePoses.filter((pose) =>
			(pose.description ?? '').toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
		)
	);
</script>

<div class="grid gap-2">
	<span class="text-sm font-medium text-[var(--black)]">Pose</span>
	{#if availablePoses.length === 0}
		<p class="rounded-md border border-dashed border-black/15 p-4 text-sm text-[var(--grey)]">
			No poses available.
		</p>
	{:else}
		<Input
			id="pose-search"
			placeholder="Search poses"
			bind:value={searchQuery}
		/>
		{#if filteredPoses.length === 0}
			<p class="rounded-md border border-dashed border-black/15 p-4 text-sm text-[var(--grey)]">
				No poses match this description search.
			</p>
		{:else}
			<div
				class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
				role="listbox"
				aria-label="Pose"
			>
				{#each filteredPoses as pose (pose.id)}
					<button
						type="button"
						role="option"
						class={`grid gap-2 rounded-md border p-2 text-left transition hover:border-[var(--primary)] ${selectedId === String(pose.id) ? 'border-2 border-[var(--primary)] bg-[var(--primary)]/5' : 'border-black/15'}`}
						aria-label={`Select pose ${pose.id}`}
						aria-selected={selectedId === String(pose.id)}
						onclick={() => (selectedId = String(pose.id))}
					>
						<div
							class="relative mx-auto flex aspect-square w-full max-w-28 items-center justify-center overflow-hidden rounded bg-black/5"
						>
							{#if pose.imageUrl.trim()}
								<img
									src={pose.imageUrl}
									alt={`Pose ${pose.id}`}
									loading="lazy"
									class="h-full w-full object-contain"
								/>
							{:else}
								<span class="text-xs text-[var(--grey)]">No image</span>
							{/if}
							{#if selectedId === String(pose.id)}
								<span
									class="absolute top-1 right-1 rounded-full bg-[var(--primary)] p-1 text-[var(--white)]"
								>
									<Icon icon="lucide:check" aria-hidden="true" />
								</span>
							{/if}
						</div>
						<span class="text-sm font-medium">{pose.description}</span>
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>
