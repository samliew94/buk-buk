<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import {
		createStationPreset,
		getPoses,
		getRiddles,
		InvalidApiResponseError,
		type Pose,
		type Riddle,
		type StationPresetItemInput
	} from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import Input from '$lib/shared/ui/Input.svelte';
	import Select, { type SelectOption } from '$lib/shared/ui/Select.svelte';
	import PoseImagePicker from '$lib/shared/PoseImagePicker.svelte';

	type PageState = 'loading' | 'ready' | 'error';
	let pageState = $state<PageState>('loading');
	let riddles = $state<Riddle[]>([]);
	let poses = $state<Pose[]>([]);
	let items = $state<StationPresetItemInput[]>([]);
	let description = $state('');
	let selectedRiddleId = $state('');
	let selectedPoseId = $state('');
	let error = $state('');
	let selectionError = $state('');
	let saving = $state(false);
	let draggedItemIndex = $state<number | null>(null);
	let dragOverItemIndex = $state<number | null>(null);

	function isUnauthorized(cause: unknown): boolean {
		return isAxiosError(cause) && cause.response?.status === 401;
	}

	function getErrorMessage(cause: unknown, fallback: string): string {
		if (cause instanceof InvalidApiResponseError) return cause.message;
		if (isAxiosError(cause)) {
			if (!cause.response) return 'Unable to reach the server. Please try again.';
			if (cause.response.status === 409) {
				return 'Each riddle and pose can only be used once. Review the station selections.';
			}
			const data: unknown = cause.response.data;
			if (
				typeof data === 'object' &&
				data !== null &&
				'error' in data &&
				typeof data.error === 'string'
			) {
				return data.error;
			}
			return fallback;
		}
		return cause instanceof Error && cause.message ? cause.message : fallback;
	}

	async function redirectToLogin() {
		localStorage.removeItem('gm_token');
		await goto('/auth/gm/login', { replaceState: true });
	}

	async function loadOptions() {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await redirectToLogin();
			return;
		}

		pageState = 'loading';
		error = '';
		try {
			[riddles, poses] = await Promise.all([getRiddles(token), getPoses(token)]);
			pageState = 'ready';
		} catch (cause) {
			if (isUnauthorized(cause)) {
				await redirectToLogin();
				return;
			}
			error = getErrorMessage(cause, 'Unable to load riddles and poses. Please try again.');
			pageState = 'error';
		}
	}

	function availableRiddleOptions(): SelectOption[] {
		const used = new Set(items.map((item) => item.riddleId));
		return [
			{ value: '', label: 'Select a riddle' },
			...riddles
				.filter((riddle) => !used.has(riddle.id))
				.map((riddle) => ({ value: String(riddle.id), label: riddle.answer }))
		];
	}

	function addItem() {
		selectionError = '';
		const riddleId = Number(selectedRiddleId);
		const poseId = Number(selectedPoseId);
		if (!Number.isSafeInteger(riddleId) || riddleId <= 0) {
			selectionError = 'Select a riddle.';
			return;
		}
		if (!Number.isSafeInteger(poseId) || poseId <= 0) {
			selectionError = 'Select a pose.';
			return;
		}
		if (items.some((item) => item.riddleId === riddleId)) {
			selectionError = 'That riddle is already in this preset. Choose another riddle.';
			return;
		}
		if (items.some((item) => item.poseId === poseId)) {
			selectionError = 'That pose is already in this preset. Choose another pose.';
			return;
		}

		items = [...items, { riddleId, poseId }];
		selectedRiddleId = '';
		selectedPoseId = '';
	}

	function removeItem(index: number) {
		items = items.filter((_, itemIndex) => itemIndex !== index);
		selectionError = '';
	}

	function moveItem(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= items.length) return;
		const reordered = [...items];
		[reordered[index], reordered[target]] = [reordered[target], reordered[index]];
		items = reordered;
	}

	function handleDragStart(event: DragEvent, index: number) {
		draggedItemIndex = index;
		dragOverItemIndex = null;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', String(index));
		}
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		if (draggedItemIndex !== null && draggedItemIndex !== index) dragOverItemIndex = index;
	}

	function handleDrop(event: DragEvent, index: number) {
		event.preventDefault();
		if (draggedItemIndex === null || draggedItemIndex === index) {
			handleDragEnd();
			return;
		}

		const reordered = [...items];
		const [draggedItem] = reordered.splice(draggedItemIndex, 1);
		if (draggedItem) reordered.splice(draggedItemIndex < index ? index - 1 : index, 0, draggedItem);
		items = reordered;
		handleDragEnd();
	}

	function handleDragEnd() {
		draggedItemIndex = null;
		dragOverItemIndex = null;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		error = '';
		if (!description.trim()) {
			error = 'Description is required.';
			return;
		}
		if (new Set(items.map((item) => item.riddleId)).size !== items.length) {
			error = 'Each riddle can only be used once.';
			return;
		}
		if (new Set(items.map((item) => item.poseId)).size !== items.length) {
			error = 'Each pose can only be used once.';
			return;
		}

		const token = localStorage.getItem('gm_token');
		if (!token) {
			await redirectToLogin();
			return;
		}
		saving = true;
		try {
			await createStationPreset({ description: description.trim(), items }, token);
			await goto('/gm/station-presets');
		} catch (cause) {
			if (isUnauthorized(cause)) {
				await redirectToLogin();
				return;
			}
			error = getErrorMessage(cause, 'Unable to create station preset. Please try again.');
		} finally {
			saving = false;
		}
	}

	onMount(() => void loadOptions());
</script>

<svelte:head><title>New Station Preset · GM</title></svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-5xl gap-6 p-4">
		<a
			href="/gm/station-presets"
			class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
			><Icon icon="lucide:arrow-left" aria-hidden="true" /> Back to station presets</a
		>
		<header class="grid gap-2">
			<p class="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">Content</p>
			<h1 class="text-3xl font-semibold">New station preset</h1>
		</header>

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				Loading riddles and poses...
			</div>
		{:else if pageState === 'error'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="mt-4 max-w-32"><Button onclick={() => void loadOptions()}>Retry</Button></div>
			</div>
		{:else}
			<form class="grid gap-6" novalidate onsubmit={handleSubmit}>
				<div class="grid gap-5 rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm">
					<Input
						id="description"
						name="description"
						label="Description"
						required
						bind:value={description}
					/>
				</div>

				<section
					class="grid gap-4 rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm"
				>
					<div>
						<h2 class="text-xl font-semibold">Stations</h2>
						<p class="mt-1 text-sm text-[var(--grey)]">Each riddle and pose can be used once.</p>
					</div>
					<div class="grid gap-4">
						<Select
							id="riddle"
							label="Riddle"
							options={availableRiddleOptions()}
							bind:value={selectedRiddleId}
						/>
						<details open class="rounded-md border border-black/10 p-3">
							<summary
								class="flex cursor-pointer list-none items-center justify-between gap-2 font-medium"
							>
								<span>Poses</span>
								<Icon icon="lucide:chevron-down" class="text-lg" aria-hidden="true" />
							</summary>
							<div class="mt-3">
								<PoseImagePicker
									{poses}
									bind:selectedId={selectedPoseId}
									usedPoseIds={items.map((item) => item.poseId)}
								/>
							</div>
						</details>
						<Button type="button" onclick={addItem}>Add station</Button>
					</div>
					{#if selectionError}<p class="text-sm text-[var(--danger)]" role="alert">
							{selectionError}
						</p>{/if}

					{#if items.length === 0}
						<p
							class="rounded-md border border-dashed border-black/15 p-5 text-sm text-[var(--grey)]"
						>
							No stations added yet.
						</p>
					{:else}
						<ol class="grid gap-2">
							{#each items as item, index (item.riddleId)}
								{@const riddle = riddles.find((candidate) => candidate.id === item.riddleId)}
								{@const pose = poses.find((candidate) => candidate.id === item.poseId)}
								<li
									draggable="true"
									class={`flex items-center justify-between gap-3 rounded-md border border-black/10 p-3 ${draggedItemIndex === index ? 'opacity-50' : ''} ${dragOverItemIndex === index ? 'bg-[var(--primary)]/5' : ''} cursor-grab active:cursor-grabbing`}
									ondragstart={(event) => handleDragStart(event, index)}
									ondragover={(event) => handleDragOver(event, index)}
									ondrop={(event) => handleDrop(event, index)}
									ondragend={handleDragEnd}
								>
									<div class="flex min-w-0 items-center gap-3">
										{#if pose?.imageUrl}
											<img
												src={pose.imageUrl}
												alt={`Pose ${pose.id}`}
												class="h-16 w-12 rounded-md bg-black/5 object-contain"
											/>
										{:else}
											<div
												class="flex h-16 w-12 items-center justify-center rounded-md bg-black/5 text-[10px] text-[var(--grey)]"
											>
												No image
											</div>
										{/if}
										<div class="min-w-0 text-sm">
											<p class="text-xs text-[var(--grey)]">Station {index + 1}</p>
											<p class="truncate font-medium">
												{riddle?.answer ?? `Riddle #${item.riddleId}`}
											</p>
										</div>
									</div>
									<div class="flex shrink-0 gap-1">
										<button
											type="button"
											disabled={index === 0}
											class="rounded-md p-2 text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:opacity-30"
											aria-label={`Move station ${index + 1} up`}
											onclick={() => moveItem(index, -1)}
											><Icon icon="lucide:arrow-up" class="text-xl" aria-hidden="true" /></button
										>
										<button
											type="button"
											disabled={index === items.length - 1}
											class="rounded-md p-2 text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:opacity-30"
											aria-label={`Move station ${index + 1} down`}
											onclick={() => moveItem(index, 1)}
											><Icon icon="lucide:arrow-down" class="text-xl" aria-hidden="true" /></button
										>
										<button
											type="button"
											class="rounded-md p-2 text-[var(--danger)] hover:bg-[var(--danger)]/10"
											aria-label={`Remove station ${index + 1}`}
											onclick={() => removeItem(index)}
											><Icon icon="lucide:trash-2" class="text-xl" aria-hidden="true" /></button
										>
									</div>
								</li>
							{/each}
						</ol>
					{/if}
				</section>

				<div class="grid gap-2">
					<Button type="submit" loading={saving} loadingLabel="Applying...">Apply</Button>
					{#if error}<span class="text-sm text-[var(--danger)]" role="alert">{error}</span>{/if}
				</div>
			</form>
		{/if}
	</section>
</main>
