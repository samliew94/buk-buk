<script lang="ts">
	import { onMount } from 'svelte';
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import QRCode from 'qrcode';
	import {
		exchangeToken,
		getGame,
		updatePlayer,
		updateStationStatus,
		InvalidApiResponseError,
		type GameDetails,
		type StationStatus
	} from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import IconButton from '$lib/shared/ui/IconButton.svelte';
	import Input from '$lib/shared/ui/Input.svelte';
	import Select from '$lib/shared/ui/Select.svelte';
	import {
		countCompletedStations,
		formatBrowserLocalDate,
		formatGameDuration,
		getGameCompletedAt,
		getStationStatusLabel
	} from '$lib/gm-games';

	type PageState = 'loading' | 'ready' | 'error' | 'not-found';

	const routeId = $derived(page.params.id);
	let pageState = $state<PageState>('loading');
	let game = $state<GameDetails | null>(null);
	let error = $state('');
	let qrOpen = $state(false);
	let qrState = $state<'loading' | 'ready' | 'error'>('loading');
	let qrDataUrl = $state('');
	let qrUrl = $state('');
	let qrTarget = $state<'player' | 'device'>('player');
	let qrError = $state('');
	let qrCopied = $state(false);
	let qrDialog = $state<HTMLDialogElement | null>(null);
	let qrRequestId = 0;
	let playerEditOpen = $state(false);
	let stationEditId = $state<number | null>(null);
	let playerName = $state('');
	let playerPax = $state<number | string>('');
	let stationStatus = $state<StationStatus>('pending');
	let saveState = $state<'idle' | 'saving'>('idle');
	let editError = $state('');
	const qrTargetLabel = $derived(qrTarget === 'device' ? 'Device check' : 'Player login');
	const qrModalTitle = $derived(
		qrTarget === 'device' ? 'Scan for device check' : 'Scan to join this game'
	);
	const completedAt = $derived(game ? getGameCompletedAt(game) : null);
	const completionDuration = $derived(
		game && completedAt ? formatGameDuration(game.createdAt, completedAt) : null
	);
	const stationOptions = [
		{ value: 'pending', label: 'Pending' },
		{ value: 'completed', label: 'Completed' }
	];

	function openPlayerEditor() {
		if (!game) return;
		playerName = game.player.name;
		playerPax = game.player.pax;
		editError = '';
		playerEditOpen = true;
	}

	function openStationEditor(status: StationStatus, id: number) {
		stationStatus = status;
		stationEditId = id;
		editError = '';
	}

	function closeEditor() {
		if (saveState === 'idle') {
			playerEditOpen = false;
			stationEditId = null;
			editError = '';
		}
	}

	async function savePlayer() {
		if (!game) return;
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}
		const input: { name?: string; pax?: number } = {};
		if (playerName !== game.player.name) input.name = String(playerName);
		if (Number(playerPax) !== game.player.pax) input.pax = Number(playerPax);
		if (!Object.keys(input).length) {
			playerEditOpen = false;
			return;
		}
		saveState = 'saving';
		editError = '';
		try {
			const updated = await updatePlayer(game.player.id, input, token);
			game = { ...game, player: { ...game.player, ...updated } };
			playerEditOpen = false;
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('gm_token');
				await goto('/auth/gm/login', { replaceState: true });
				return;
			}
			editError = getErrorMessage(cause);
		} finally {
			saveState = 'idle';
		}
	}

	async function saveStation() {
		if (stationEditId === null) return;
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}
		saveState = 'saving';
		editError = '';
		try {
			const updated = await updateStationStatus(stationEditId, { status: stationStatus }, token);
			if (game)
				game = {
					...game,
					stations: game.stations.map((station) =>
						station.id === updated.id ? { ...station, status: updated.status } : station
					)
				};
			stationEditId = null;
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('gm_token');
				await goto('/auth/gm/login', { replaceState: true });
				return;
			}
			editError = getErrorMessage(cause);
		} finally {
			saveState = 'idle';
		}
	}

	function isUnauthorized(cause: unknown): boolean {
		return isAxiosError(cause) && cause.response?.status === 401;
	}

	function isNotFound(cause: unknown): boolean {
		return isAxiosError(cause) && cause.response?.status === 404;
	}

	function getErrorMessage(cause: unknown): string {
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

			return 'Unable to load game. Please try again.';
		}

		if (cause instanceof Error && cause.message.length > 0) return cause.message;
		return 'Unable to load game. Please try again.';
	}

	function parseGameId(value: string | undefined): number | null {
		if (!value) return null;
		if (!/^\d+$/.test(value)) return null;
		const id = Number(value);
		return Number.isSafeInteger(id) && id > 0 ? id : null;
	}

	function statusIcon(status: StationStatus): string {
		return status === 'completed' ? 'lucide:circle-check' : 'lucide:circle-dashed';
	}

	function uploadPassed(upload: GameDetails['stations'][number]['uploads'][number]): boolean {
		return upload.riddleCorrect && upload.poseCorrect && upload.playerCountCorrect;
	}

	function resultLabel(correct: boolean): string {
		return correct ? 'Pass' : 'Needs work';
	}

	function resultClass(correct: boolean): string {
		return correct ? 'text-[var(--success)]' : 'text-[var(--warning)]';
	}

	function overallLabel(upload: GameDetails['stations'][number]['uploads'][number]): string {
		return uploadPassed(upload) ? 'Pass' : 'Fail';
	}

	function overallClass(upload: GameDetails['stations'][number]['uploads'][number]): string {
		return uploadPassed(upload) ? 'text-[var(--success)]' : 'text-[var(--danger)]';
	}

	async function openQrModal(target: 'player' | 'device') {
		if (!game) return;

		const requestId = ++qrRequestId;
		qrTarget = target;
		qrOpen = true;
		qrState = 'loading';
		qrDataUrl = '';
		qrUrl = '';
		qrError = '';
		qrCopied = false;
		await tick();
		if (requestId !== qrRequestId) return;
		qrDialog?.focus();

		try {
			let targetUrl: string;
			if (target === 'device') {
				targetUrl = `${window.location.origin}/device`;
			} else {
				const gmToken = localStorage.getItem('gm_token');
				if (!gmToken) {
					await goto('/auth/gm/login', { replaceState: true });
					return;
				}
				const response = await exchangeToken(game.publicId, gmToken);
				targetUrl = `${window.location.origin}/auth/player/login?token=${encodeURIComponent(response.token)}`;
			}
			qrUrl = targetUrl;
			qrDataUrl = await QRCode.toDataURL(targetUrl, {
				errorCorrectionLevel: 'M',
				margin: 2,
				width: 320
			});
			if (requestId !== qrRequestId) return;
			qrState = 'ready';
		} catch (cause) {
			if (requestId !== qrRequestId) return;
			qrError = getErrorMessage(cause);
			qrState = 'error';
		}
	}

	function closeQrModal() {
		qrRequestId += 1;
		qrOpen = false;
	}

	async function copyQrUrl() {
		if (!qrUrl) return;

		try {
			await navigator.clipboard.writeText(qrUrl);
			qrCopied = true;
			window.setTimeout(() => (qrCopied = false), 2000);
		} catch {
			qrCopied = false;
		}
	}

	function handleQrDialogKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeQrModal();
	}

	async function loadGame() {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}

		pageState = 'loading';
		game = null;
		error = '';

		const id = parseGameId(routeId);
		if (id === null) {
			pageState = 'not-found';
			return;
		}

		try {
			game = await getGame(id, token);
			pageState = 'ready';
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('gm_token');
				await goto('/auth/gm/login', { replaceState: true });
				return;
			}

			if (isNotFound(cause)) {
				pageState = 'not-found';
				return;
			}

			error = getErrorMessage(cause);
			pageState = 'error';
		}
	}

	onMount(() => {
		void loadGame();
	});
</script>

<svelte:head>
	<title>{game ? `${game.player.name} · GM Game` : 'GM Game'}</title>
</svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-7xl gap-6 p-4">
		<a
			href="/gm/games"
			class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
		>
			<Icon icon="lucide:arrow-left" aria-hidden="true" />
			Back to games
		</a>

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				<p class="text-[var(--grey)]">Loading game...</p>
			</div>
		{:else if pageState === 'error'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="mt-4 max-w-32">
					<Button onclick={() => void loadGame()}>Retry</Button>
				</div>
			</div>
		{:else if pageState === 'not-found'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
				<h1 class="text-2xl font-semibold">Game not found</h1>
				<p class="mt-2 text-[var(--grey)]">This game does not exist or is no longer available.</p>
			</div>
		{:else if game}
			<header class="flex flex-wrap items-start justify-between gap-4">
				<div class="grid gap-2">
					<h1 class="text-3xl font-semibold">{game.player.name}</h1>
					<p class="font-mono text-sm text-[var(--grey)]">{game.publicId}</p>
				</div>
				<div class="grid gap-1 whitespace-nowrap">
					<button
						type="button"
						aria-label="Show device check QR code"
						title="Show device check QR code"
						onclick={() => void openQrModal('device')}
						class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-[var(--primary)] transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
					>
						<Icon icon="lucide:qr-code" class="text-xl" aria-hidden="true" />
						<span>Device check</span>
					</button>
					<button
						type="button"
						aria-label="Show player login QR code"
						title="Show player login QR code"
						onclick={() => void openQrModal('player')}
						class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-[var(--primary)] transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
					>
						<Icon icon="lucide:qr-code" class="text-xl" aria-hidden="true" />
						<span>Player login</span>
					</button>
					<a
						href={`/gm/games/${game.id}/lucky-draw`}
						aria-label="Open lucky draw"
						title="Open lucky draw"
						class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-[var(--primary)] transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
					>
						<Icon icon="lucide:gift" class="text-xl" aria-hidden="true" />
						<span>Lucky draw</span>
					</a>
				</div>
			</header>

			<details class="group grid gap-4" aria-labelledby="game-details-heading">
				<summary
					class="flex cursor-pointer list-none items-center justify-between gap-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 [&::-webkit-details-marker]:hidden"
				>
					<div class="flex items-center gap-2">
						<IconButton
							icon="lucide:pencil"
							label="Edit player"
							onclick={(event) => {
								event.preventDefault();
								openPlayerEditor();
							}}
						/>
						<h2 id="game-details-heading" class="text-xl font-semibold">Details</h2>
					</div>
					<Icon
						icon="lucide:chevron-down"
						class="text-xl transition-transform group-open:rotate-180"
						aria-hidden="true"
					/>
				</summary>
				<div class="rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm">
					<dl class="grid gap-4 text-sm sm:grid-cols-2">
						<div>
							<dt class="text-[var(--grey)]">Player</dt>
							<dd class="mt-1 font-medium">{game.player.name}</dd>
						</div>
						<div>
							<dt class="text-[var(--grey)]">Player pax</dt>
							<dd class="mt-1 font-medium">{game.player.pax}</dd>
						</div>
						<div>
							<dt class="text-[var(--grey)]">Enable pose</dt>
							<dd class="mt-1 font-medium">{game.enablePose ? 'Yes' : 'No'}</dd>
						</div>
						<div>
							<dt class="text-[var(--grey)]">Internal ID</dt>
							<dd class="mt-1 font-mono font-medium">{game.id}</dd>
						</div>
						<div>
							<dt class="text-[var(--grey)]">Created</dt>
							<dd class="mt-1 font-medium">{formatBrowserLocalDate(game.createdAt)}</dd>
						</div>
						<div>
							<dt class="text-[var(--grey)]">Updated</dt>
							<dd class="mt-1 font-medium">{formatBrowserLocalDate(game.updatedAt)}</dd>
						</div>
						<div>
							<dt class="text-[var(--grey)]">Completed</dt>
							<dd class="mt-1 font-medium">
								{#if completedAt}
									{formatBrowserLocalDate(completedAt)}{#if completionDuration}
										<span class="text-[var(--grey)]">({completionDuration})</span>
									{/if}
								{:else}—{/if}
							</dd>
						</div>
						<div>
							<dt class="text-[var(--grey)]">Stations</dt>
							<dd class="mt-1 font-medium">{game.stations.length}</dd>
						</div>
					</dl>
				</div>
			</details>

			<section class="grid gap-4" aria-labelledby="stations-heading">
				<div class="flex items-baseline justify-between gap-4">
					<h2 id="stations-heading" class="text-xl font-semibold">Stations</h2>
					<span class="text-sm text-[var(--grey)]"
						>{countCompletedStations(game.stations)}/{game.stations.length} completed</span
					>
				</div>

				{#if game.stations.length === 0}
					<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
						<p class="text-[var(--grey)]">No stations yet.</p>
					</div>
				{:else}
					<div class="grid gap-6">
						{#each game.stations as station, index (station.id)}
							<details
								class="group rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm"
							>
								<summary
									class="flex cursor-pointer list-none items-center justify-between gap-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 [&::-webkit-details-marker]:hidden"
								>
									<div class="flex items-center gap-3">
										<Icon
											icon={statusIcon(station.status)}
											class={station.status === 'completed'
												? 'text-[var(--success)]'
												: 'text-[var(--warning)]'}
											aria-hidden="true"
										/>
										<h3 class="text-lg font-semibold">Station {index + 1}</h3>
									</div>
									<strong
										class={`text-sm ${station.status === 'completed' ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}
									>
										{getStationStatusLabel(station.status)}
									</strong>
								</summary>
								<div class="mt-3">
									<IconButton
										icon="lucide:pencil"
										label={`Edit status for station ${index + 1}`}
										onclick={(event) => {
											event.preventDefault();
											openStationEditor(station.status, station.id);
										}}
									/>
								</div>

								<div class="mt-5 grid gap-5 border-t border-black/10 pt-5">
									<div class="grid gap-4 md:grid-cols-2">
										<details class="group/riddle rounded-md border border-black/10 p-4">
											<summary
												class="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 [&::-webkit-details-marker]:hidden"
											>
												Riddle
												<Icon
													icon="lucide:chevron-down"
													class="transition-transform group-open/riddle:rotate-180"
													aria-hidden="true"
												/>
											</summary>
											<div class="mt-3 grid content-start gap-3">
												<p class="text-sm">{station.riddle.question}</p>
												<div class="grid gap-1 text-sm">
													<span class="text-[var(--grey)]">Answer</span>
													<strong>{station.riddle.answer}</strong>
												</div>
											</div>
										</details>

										<details class="group/pose rounded-md border border-black/10 p-4">
											<summary
												class="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 [&::-webkit-details-marker]:hidden"
											>
												Pose
												<Icon
													icon="lucide:chevron-down"
													class="transition-transform group-open/pose:rotate-180"
													aria-hidden="true"
												/>
											</summary>
											<div class="mt-3 grid content-start gap-3">
												{#if station.pose.description}
													<p class="text-sm text-[var(--grey)]">{station.pose.description}</p>
												{/if}
												{#if station.pose.imageUrl}
													<img
														src={station.pose.imageUrl}
														alt="Pose"
														class="h-64 w-full rounded-md bg-black/5 object-contain"
														loading="lazy"
													/>
												{:else}
													<p class="text-sm text-[var(--grey)]">No pose image.</p>
												{/if}
											</div>
										</details>
									</div>
								</div>

								<details class="group/uploads border-t border-black/10 pt-4">
									<summary
										class="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 [&::-webkit-details-marker]:hidden"
									>
										Uploads
										<Icon
											icon="lucide:chevron-down"
											class="transition-transform group-open/uploads:rotate-180"
											aria-hidden="true"
										/>
									</summary>
									<div class="mt-3 grid gap-3">
										{#if station.uploads.length === 0}
											<p class="text-sm text-[var(--grey)]">No uploads yet.</p>
										{:else}
											<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
												{#each station.uploads as upload, uploadIndex (upload.id)}
													<details
														class={`group/upload rounded-md border p-4 ${uploadPassed(upload) ? 'border-[var(--success)]/40' : 'border-[var(--danger)]/40'}`}
													>
														<summary
															class="flex cursor-pointer list-none items-start justify-between gap-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 [&::-webkit-details-marker]:hidden"
														>
															<div class="grid min-w-0 gap-1 text-sm">
																<strong>Upload {station.uploads.length - uploadIndex}</strong>
																<span class={overallClass(upload)}>
																	{overallLabel(upload)}
																</span>
															</div>
															<Icon
																icon="lucide:chevron-down"
																class="mt-0.5 shrink-0 transition-transform group-open/upload:rotate-180"
																aria-hidden="true"
															/>
														</summary>
														<div
															class="mt-4 grid content-start gap-3 border-t border-black/10 pt-4"
														>
															<img
																src={upload.imageUrl}
																alt="Station upload"
																class="h-64 w-full rounded-md bg-black/5 object-contain"
																loading="lazy"
															/>
															<div class="grid gap-2 text-sm">
																{#if upload.comment}
																	<p>{upload.comment.text}</p>
																	{#if upload.comment.textZh}<p>{upload.comment.textZh}</p>{/if}
																{:else}
																	<p>No comment.</p>
																{/if}
																<span class="text-xs text-[var(--grey)]">
																	{upload.comment
																		? formatBrowserLocalDate(upload.comment.createdAt)
																		: ''}
																</span>
																<dl class="grid gap-1 text-xs">
																	<div class="flex justify-between gap-4">
																		<dt>Riddle</dt>
																		<dd class={resultClass(upload.riddleCorrect)}>
																			{resultLabel(upload.riddleCorrect)}
																		</dd>
																	</div>
																	<div class="flex justify-between gap-4">
																		<dt>Pose</dt>
																		<dd class={resultClass(upload.poseCorrect)}>
																			{resultLabel(upload.poseCorrect)}
																		</dd>
																	</div>
																	<div class="flex justify-between gap-4">
																		<dt>Player count</dt>
																		<dd class={resultClass(upload.playerCountCorrect)}>
																			{resultLabel(upload.playerCountCorrect)}
																		</dd>
																	</div>
																</dl>
															</div>
														</div>
													</details>
												{/each}
											</div>
										{/if}
									</div>
								</details>
							</details>
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</section>
</main>

{#if playerEditOpen || stationEditId !== null}
	<dialog
		open
		aria-modal="true"
		class="fixed inset-0 z-50 m-0 h-full w-full max-w-none border-0 bg-transparent p-4 text-[var(--black)] backdrop:bg-black/50"
	>
		<div class="flex min-h-full items-center justify-center">
			<div
				class="w-full max-w-md rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-xl"
			>
				<div class="flex items-start justify-between gap-4">
					<h2 class="text-xl font-semibold">
						{playerEditOpen ? 'Edit player' : 'Edit station status'}
					</h2>
					<button
						type="button"
						aria-label="Close editor"
						class="rounded-md p-1 text-[var(--grey)] hover:bg-black/5"
						disabled={saveState === 'saving'}
						onclick={closeEditor}
						><Icon icon="lucide:x" class="text-xl" aria-hidden="true" /></button
					>
				</div>
				{#if playerEditOpen}
					<form
						class="mt-5 grid gap-4"
						onsubmit={(event) => {
							event.preventDefault();
							void savePlayer();
						}}
					>
						<Input
							id="player-name"
							label="Name"
							bind:value={playerName}
							disabled={saveState === 'saving'}
						/>
						<Input
							id="player-pax"
							label="Pax"
							type="number"
							bind:value={playerPax}
							disabled={saveState === 'saving'}
						/>
						{#if editError}<p class="text-sm text-[var(--danger)]" role="alert">{editError}</p>{/if}
						<Button type="submit" loading={saveState === 'saving'} loadingLabel="Saving..."
							>Save player</Button
						>
					</form>
				{:else}
					<form
						class="mt-5 grid gap-4"
						onsubmit={(event) => {
							event.preventDefault();
							void saveStation();
						}}
					>
						<Select
							id="station-status"
							label="Status"
							options={stationOptions}
							bind:value={stationStatus}
							disabled={saveState === 'saving'}
						/>
						{#if editError}<p class="text-sm text-[var(--danger)]" role="alert">{editError}</p>{/if}
						<Button type="submit" loading={saveState === 'saving'} loadingLabel="Saving..."
							>Save status</Button
						>
					</form>
				{/if}
			</div>
		</div>
	</dialog>
{/if}

{#if qrOpen}
	<dialog
		open
		aria-modal="true"
		aria-labelledby="player-qr-title"
		bind:this={qrDialog}
		onkeydown={handleQrDialogKeydown}
		tabindex="-1"
		class="fixed inset-0 z-50 m-0 h-full w-full max-w-none border-0 bg-transparent p-4 text-[var(--black)] backdrop:bg-black/50"
	>
		<div class="flex min-h-full items-center justify-center">
			<div
				class="w-full max-w-md rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-xl"
			>
				<div class="flex items-start justify-between gap-4">
					<div class="grid gap-1">
						<p class="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
							{qrTargetLabel}
						</p>
						<h2 id="player-qr-title" class="text-xl font-semibold">{qrModalTitle}</h2>
					</div>
					<button
						type="button"
						aria-label="Close QR code"
						title="Close"
						onclick={closeQrModal}
						class="rounded-md p-1 text-[var(--grey)] transition hover:bg-black/5 hover:text-[var(--black)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
					>
						<Icon icon="lucide:x" class="text-xl" aria-hidden="true" />
					</button>
				</div>

				{#if qrState === 'loading'}
					<div class="grid min-h-64 place-items-center py-8" role="status">
						<p class="text-[var(--grey)]">Generating QR code...</p>
					</div>
				{:else if qrState === 'error'}
					<div class="grid gap-4 py-8" role="alert">
						<p class="text-sm text-[var(--danger)]">{qrError}</p>
						<Button onclick={() => void openQrModal(qrTarget)}>Try again</Button>
					</div>
				{:else}
					<div class="mt-5 grid gap-3">
						<img
							src={qrDataUrl}
							alt={`${qrTargetLabel} QR code`}
							class="mx-auto aspect-square w-full max-w-xs rounded-md bg-white p-2"
						/>
						<div class="flex items-start gap-2">
							<a
								href={qrUrl}
								target="_blank"
								rel="noreferrer"
								class="min-w-0 flex-1 text-center text-sm break-all text-[var(--primary)] underline underline-offset-2 hover:text-[var(--black)]"
							>
								{qrUrl}
							</a>
							<button
								type="button"
								aria-label={qrCopied
									? 'Link copied'
									: `Copy ${qrTargetLabel.toLocaleLowerCase()} link`}
								title={qrCopied ? 'Link copied' : `Copy ${qrTargetLabel.toLocaleLowerCase()} link`}
								onclick={() => void copyQrUrl()}
								class="shrink-0 rounded-md p-2 text-[var(--primary)] transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
							>
								<Icon
									icon={qrCopied ? 'lucide:check' : 'lucide:copy'}
									class="text-xl"
									aria-hidden="true"
								/>
							</button>
						</div>
						{#if qrCopied}
							<p class="text-center text-sm text-[var(--success)]" role="status">Link copied.</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</dialog>
{/if}
