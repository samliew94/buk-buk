<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import {
		createGame,
		getStationPresets,
		InvalidApiResponseError,
		type StationPreset
	} from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import Input from '$lib/shared/ui/Input.svelte';
	import Radio from '$lib/shared/ui/Radio.svelte';

	type PageState = 'loading' | 'ready' | 'empty' | 'error';

	let pageState = $state<PageState>('loading');
	let stationPresets = $state<StationPreset[]>([]);
	let selectedStationPresetId = $state<number | null>(null);
	let playerName = $state('');
	let playerPax = $state(1);
	let enablePose = $state(false);
	let error = $state('');
	let submitting = $state(false);
	let searchQuery = $state('');
	const filteredStationPresets = $derived(
		stationPresets.filter((preset) =>
			preset.description.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
		)
	);

	function isUnauthorized(cause: unknown): boolean {
		return isAxiosError(cause) && cause.response?.status === 401;
	}

	function getErrorMessage(cause: unknown, fallback: string): string {
		if (cause instanceof InvalidApiResponseError) return cause.message;
		if (isAxiosError(cause)) {
			if (!cause.response) return 'Unable to reach the server. Please try again.';

			const responseData: unknown = cause.response.data;
			if (
				typeof responseData === 'object' &&
				responseData !== null &&
				'error' in responseData &&
				typeof responseData.error === 'string' &&
				responseData.error.trim().length > 0
			) {
				return responseData.error;
			}

			return fallback;
		}

		if (cause instanceof Error && cause.message.length > 0) return cause.message;
		return fallback;
	}

	async function redirectToLogin() {
		localStorage.removeItem('gm_token');
		await goto('/auth/gm/login', { replaceState: true });
	}

	async function loadPresets() {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}

		pageState = 'loading';
		error = '';
		selectedStationPresetId = null;

		try {
			stationPresets = await getStationPresets(token);
			selectedStationPresetId = stationPresets[0]?.id ?? null;
			pageState = stationPresets.length === 0 ? 'empty' : 'ready';
		} catch (cause) {
			if (isUnauthorized(cause)) {
				await redirectToLogin();
				return;
			}

			error = getErrorMessage(cause, 'Unable to load station presets. Please try again.');
			pageState = 'error';
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;

		error = '';
		if (playerName.trim().length === 0) {
			error = 'Player name is required.';
			return;
		}
		const normalizedPax = playerPax;
		if (!Number.isSafeInteger(normalizedPax) || normalizedPax <= 0) {
			error = 'Player pax must be a positive integer.';
			return;
		}

		if (selectedStationPresetId === null) {
			error = 'Select a station preset.';
			return;
		}

		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}

		submitting = true;
		try {
			const game = await createGame(
				{
					enablePose,
					player: { name: playerName.trim(), pax: normalizedPax },
					stationPresetId: selectedStationPresetId
				},
				token
			);
			await goto(`/gm/games/${game.id}`);
		} catch (cause) {
			if (isUnauthorized(cause)) {
				await redirectToLogin();
				return;
			}

			error = getErrorMessage(cause, 'Unable to create game. Please try again.');
		} finally {
			submitting = false;
		}
	}

	onMount(() => {
		void loadPresets();
	});
</script>

<svelte:head>
	<title>New GM Game</title>
</svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-2xl gap-6 p-4">
		<a
			href="/gm/games"
			class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
		>
			<Icon icon="lucide:arrow-left" aria-hidden="true" />
			Back to games
		</a>

		<header class="grid gap-2">
			<p class="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
				Game master
			</p>
			<h1 class="text-3xl font-semibold">New Game</h1>
			<p class="text-[var(--grey)]">Set up a player session and choose its station challenge.</p>
		</header>

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				<p class="text-[var(--grey)]">Loading station presets...</p>
			</div>
		{:else if pageState === 'error'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="mt-4 max-w-32">
					<Button onclick={() => void loadPresets()}>Retry</Button>
				</div>
			</div>
		{:else if pageState === 'empty'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
				<p class="text-[var(--grey)]">No station presets available.</p>
				<div class="mt-4 max-w-32">
					<Button onclick={() => void loadPresets()}>Retry</Button>
				</div>
			</div>
		{:else}
			<form class="grid gap-6" novalidate onsubmit={handleSubmit}>
				<div class="grid gap-5 rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm">
					<h2 class="text-xl font-semibold">Player details</h2>
					<Input
						id="player-name"
						name="playerName"
						label="Player name"
						autocomplete="off"
						required
						bind:value={playerName}
					/>
					<Input
						id="player-pax"
						name="playerPax"
						label="Player pax"
						type="number"
						required
						bind:value={playerPax}
					/>
					<fieldset class="grid gap-3">
						<legend class="mb-2 font-medium">Enable Pose?</legend>
						<div class="grid gap-2 sm:grid-cols-2">
							<Radio
								id="enable-pose-no"
								name="enablePose"
								value="false"
								label="No"
								checked={!enablePose}
								onchange={() => (enablePose = false)}
							/>
							<Radio
								id="enable-pose-yes"
								name="enablePose"
								value="true"
								label="Yes"
								checked={enablePose}
								onchange={() => (enablePose = true)}
							/>
						</div>
					</fieldset>
				</div>

				<fieldset
					class="grid gap-4 rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm"
				>
					<legend class="text-xl font-semibold">Station preset</legend>
					<Input
						id="station-preset-search"
						placeholder="Search by station preset name"
						bind:value={searchQuery}
					/>
					{#if filteredStationPresets.length === 0}
						<div class="rounded-lg border border-dashed border-black/15 p-6 text-[var(--grey)]">
							No station presets match this search.
						</div>
					{:else}
						<div class="grid gap-3">
							{#each filteredStationPresets as preset (preset.id)}
								<Radio
									id={`station-preset-${preset.id}`}
									name="stationPresetId"
									value={String(preset.id)}
									label={preset.description}
									description={`${preset.items.length} station${preset.items.length === 1 ? '' : 's'}`}
									checked={selectedStationPresetId === preset.id}
									onchange={() => (selectedStationPresetId = preset.id)}
								/>
							{/each}
						</div>
					{/if}
				</fieldset>

				<div class="grid gap-2">
					<Button
						type="submit"
						loading={submitting}
						disabled={stationPresets.length === 0}
						loadingLabel="Creating game..."
					>
						Create game
					</Button>
					{#if error}<span class="text-sm text-[var(--danger)]" role="alert">{error}</span>{/if}
				</div>
			</form>
		{/if}
	</section>
</main>
