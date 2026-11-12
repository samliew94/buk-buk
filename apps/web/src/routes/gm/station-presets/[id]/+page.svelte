<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import {
		getPoses,
		getRiddles,
		getStationPreset,
		InvalidApiResponseError,
		updateStationPreset,
		type Pose,
		type Riddle,
		type StationPreset,
		type StationPresetItem
	} from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import Input from '$lib/shared/ui/Input.svelte';
	import Select, { type SelectOption } from '$lib/shared/ui/Select.svelte';
	import PoseImagePicker from '$lib/shared/PoseImagePicker.svelte';

	type PageState = 'loading' | 'ready' | 'error' | 'not-found';
	const routeId = $derived(page.params.id);
	let pageState = $state<PageState>('loading');
	let preset = $state<StationPreset | null>(null);
	let riddles = $state<Riddle[]>([]);
	let poses = $state<Pose[]>([]);
	let items = $state<StationPresetItem[]>([]);
	let description = $state('');
	let selectedRiddleId = $state('');
	let selectedPoseId = $state('');
	let error = $state('');
	let selectionError = $state('');
	let saving = $state(false);
	let draggedItemIndex = $state<number | null>(null);
	let dragOverItemIndex = $state<number | null>(null);
	let nextTemporaryItemId = 0;

	function parseId(value: string | undefined): number | null {
		if (!value || !/^\d+$/.test(value)) return null;
		const id = Number(value);
		return Number.isSafeInteger(id) && id > 0 ? id : null;
	}

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

	async function loadPreset() {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await redirectToLogin();
			return;
		}

		const id = parseId(routeId);
		if (id === null) {
			pageState = 'not-found';
			return;
		}

		pageState = 'loading';
		error = '';
		try {
			const [loadedPreset, loadedRiddles, loadedPoses] = await Promise.all([
				getStationPreset(id, token),
				getRiddles(token),
				getPoses(token)
			]);
			preset = loadedPreset;
			riddles = loadedRiddles;
			poses = loadedPoses;
			description = loadedPreset.description;
			items = loadedPreset.items;
			nextTemporaryItemId = Math.min(0, ...items.map((item) => item.id));
			pageState = 'ready';
		} catch (cause) {
			if (isUnauthorized(cause)) {
				await redirectToLogin();
				return;
			}
			if (isAxiosError(cause) && cause.response?.status === 404) {
				pageState = 'not-found';
				return;
			}
			error = getErrorMessage(cause, 'Unable to load station preset. Please try again.');
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

	function duplicateError(): string {
		const riddlesSeen = new Set<number>();
		const posesSeen = new Set<number>();
		for (const item of items) {
			if (riddlesSeen.has(item.riddleId)) return 'Each riddle can only be used once.';
			if (posesSeen.has(item.poseId)) return 'Each pose can only be used once.';
			riddlesSeen.add(item.riddleId);
			posesSeen.add(item.poseId);
		}
		return '';
	}

	function addItem() {
		selectionError = '';
		const riddleId = Number(selectedRiddleId);
		const poseId = Number(selectedPoseId);
		const riddle = riddles.find((candidate) => candidate.id === riddleId);
		const pose = poses.find((candidate) => candidate.id === poseId);
		if (!riddle) {
			selectionError = 'Select a riddle.';
			return;
		}
		if (!pose) {
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

		items = [
			...items,
			{
				id: --nextTemporaryItemId,
				riddleId,
				poseId,
				sortOrder: items.length,
				riddle,
				pose
			}
		];
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
		const normalizedDescription = description.trim();
		if (!normalizedDescription) {
			error = 'Description is required.';
			return;
		}
		const duplicate = duplicateError();
		if (duplicate) {
			error = duplicate;
			return;
		}

		const id = parseId(routeId);
		const token = localStorage.getItem('gm_token');
		if (id === null) {
			pageState = 'not-found';
			return;
		}
		if (!token) {
			await redirectToLogin();
			return;
		}

		saving = true;
		try {
			await updateStationPreset(
				id,
				{
					description: normalizedDescription,
					items: items.map((item) => ({ riddleId: item.riddleId, poseId: item.poseId }))
				},
				token
			);
			await goto('/gm/station-presets');
		} catch (cause) {
			if (isUnauthorized(cause)) {
				await redirectToLogin();
				return;
			}
			if (isAxiosError(cause) && cause.response?.status === 404) {
				pageState = 'not-found';
				return;
			}
			error = getErrorMessage(cause, 'Unable to save station preset. Please try again.');
		} finally {
			saving = false;
		}
	}

	onMount(() => void loadPreset());
</script>

<svelte:head><title>Edit Station Preset · GM</title></svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-7xl gap-6 p-4">
		<a
			href="/gm/station-presets"
			class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
			><Icon icon="lucide:arrow-left" aria-hidden="true" /> Back to station presets</a
		>

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				Loading station preset...
			</div>
		{:else if pageState === 'not-found'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
				<h1 class="text-2xl font-semibold">Station preset not found</h1>
				<p class="mt-2 text-[var(--grey)]">This station preset does not exist.</p>
			</div>
		{:else if pageState === 'error'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="mt-4 max-w-32"><Button onclick={() => void loadPreset()}>Retry</Button></div>
			</div>
		{:else if preset}
			<header class="grid gap-2">
				<p class="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">Content</p>
				<h1 class="text-3xl font-semibold">Edit station preset</h1>
			</header>

			<form class="grid gap-6" novalidate onsubmit={handleSubmit}>
				<div class="rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm">
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
					<div class="grid gap-1">
						<h2 class="text-xl font-semibold">Stations</h2>
						<p class="text-sm text-[var(--grey)]">Changes stay local until you save.</p>
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

					<div class="overflow-x-auto rounded-md border border-black/10">
						<table class="w-full min-w-[900px] text-left text-sm">
							<thead class="border-b border-black/10 bg-black/[0.03] text-xs uppercase">
								<tr>
									<th class="w-12 p-3 text-center">#</th>
									<th class="p-3">Question</th>
									<th class="p-3">Question (ZH)</th>
									<th class="p-3">Answer</th>
									<th class="p-3">Pose preview</th>
									<th class="p-3">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each items as item, index (item.id)}
									<tr
										draggable="true"
										class={`border-b border-black/10 last:border-0 ${draggedItemIndex === index ? 'opacity-50' : ''} ${dragOverItemIndex === index ? 'bg-[var(--primary)]/5' : ''} cursor-grab active:cursor-grabbing`}
										ondragstart={(event) => handleDragStart(event, index)}
										ondragover={(event) => handleDragOver(event, index)}
										ondrop={(event) => handleDrop(event, index)}
										ondragend={handleDragEnd}
									>
										<td class="p-3 text-center align-top font-semibold text-[var(--grey)]"
											>{index + 1}</td
										>
										<td class="max-w-64 p-3 align-top">{item.riddle.question}</td>
										<td class="max-w-64 p-3 align-top">{item.riddle.questionZh || '—'}</td>
										<td class="max-w-48 p-3 align-top">{item.riddle.answer}</td>
										<td class="p-3 align-top">
											{#if item.pose.imageUrl}
												<img
													src={item.pose.imageUrl}
													alt={`Pose ${item.pose.id}`}
													class="h-16 w-12 rounded-md object-contain"
												/>
											{:else}<span class="text-[var(--grey)]">—</span>{/if}
										</td>
										<td class="p-3 align-top">
											<div class="flex gap-1">
												<button
													type="button"
													disabled={index === 0}
													class="rounded-md p-2 text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:opacity-30"
													aria-label={`Move station ${index + 1} up`}
													onclick={() => moveItem(index, -1)}
													><Icon
														icon="lucide:arrow-up"
														class="text-xl"
														aria-hidden="true"
													/></button
												>
												<button
													type="button"
													disabled={index === items.length - 1}
													class="rounded-md p-2 text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:opacity-30"
													aria-label={`Move station ${index + 1} down`}
													onclick={() => moveItem(index, 1)}
													><Icon
														icon="lucide:arrow-down"
														class="text-xl"
														aria-hidden="true"
													/></button
												>
												<button
													type="button"
													class="rounded-md p-2 text-[var(--danger)] hover:bg-[var(--danger)]/10"
													aria-label={`Delete station ${index + 1}`}
													onclick={() => removeItem(index)}
													><Icon icon="lucide:trash-2" class="text-xl" aria-hidden="true" /></button
												>
											</div>
										</td>
									</tr>
								{:else}
									<tr
										><td colspan="6" class="p-6 text-center text-[var(--grey)]"
											>No stations in this preset.</td
										></tr
									>
								{/each}
							</tbody>
						</table>
					</div>
				</section>

				<div class="grid gap-2">
					<Button type="submit" loading={saving} loadingLabel="Saving..."
						>Save station preset</Button
					>
					{#if error}<span class="text-sm text-[var(--danger)]" role="alert">{error}</span>{/if}
				</div>
			</form>
		{/if}
	</section>
</main>
