<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import { getGames, InvalidApiResponseError, type Game, type StationStatus } from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import Input from '$lib/shared/ui/Input.svelte';
	import {
		countCompletedStations,
		formatBrowserLocalDate,
		getStationStatusLabel
	} from '$lib/gm-games';

	type PageState = 'loading' | 'ready' | 'error';

	let pageState = $state<PageState>('loading');
	let games = $state<Game[]>([]);
	let error = $state('');
	let searchQuery = $state('');
	const filteredGames = $derived(
		games.filter((game) =>
			game.player.name.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
		)
	);

	function isUnauthorized(cause: unknown): boolean {
		return isAxiosError(cause) && cause.response?.status === 401;
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

			return 'Unable to load games. Please try again.';
		}

		if (cause instanceof Error && cause.message.length > 0) return cause.message;
		return 'Unable to load games. Please try again.';
	}

	async function loadGames() {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}

		pageState = 'loading';
		error = '';
		try {
			games = (await getGames(token)).games;
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

	function statusIcon(status: StationStatus): string {
		return status === 'completed' ? 'lucide:circle-check' : 'lucide:circle-dashed';
	}

	function openGame(id: number) {
		void goto(`/gm/games/${id}`);
	}

	function handleViewClick(event: MouseEvent, id: number) {
		event.preventDefault();
		event.stopPropagation();
		openGame(id);
	}

	function completionBadgeClass(completed: number, total: number): string {
		if (completed === 0)
			return 'border-[var(--danger)]/25 bg-[var(--danger)]/10 text-[var(--danger)]';
		if (total > 0 && completed === total) {
			return 'border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]';
		}
		return 'border-[var(--warning)]/25 bg-[var(--warning)]/10 text-[var(--warning)]';
	}

	onMount(() => {
		void loadGames();
	});
</script>

<svelte:head>
	<title>GM Games</title>
</svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-7xl gap-6 p-4">
		<div class="grid gap-2">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="grid gap-2">
					<a
						href="/gm"
						class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
					>
						<Icon icon="lucide:arrow-left" aria-hidden="true" /> Back to management
					</a>
					<h1 class="text-3xl font-semibold">Games</h1>
				</div>
				<a
					href="/gm/games/new"
					class="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--white)] transition hover:opacity-90 focus:ring-2 focus:ring-[var(--primary)]/30 focus:outline-none"
				>
					<Icon icon="lucide:plus" aria-hidden="true" />
					New Game
				</a>
			</div>
		</div>

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				<p class="text-[var(--grey)]">Loading games...</p>
			</div>
		{:else if pageState === 'error'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="mt-4 max-w-32">
					<Button onclick={() => void loadGames()}>Retry</Button>
				</div>
			</div>
		{:else if games.length === 0}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
				<p class="text-[var(--grey)]">No games yet.</p>
			</div>
		{:else}
			<div class="grid gap-4">
				<Input id="game-search" placeholder="Search by player name" bind:value={searchQuery} />
				{#if filteredGames.length === 0}
					<div class="rounded-lg border border-dashed border-black/15 p-6 text-[var(--grey)]">
						No games match this player search.
					</div>
				{:else}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						{#each filteredGames as game (game.id)}
							{@const completedStations = countCompletedStations(game.stations)}
							<details class="group rounded-lg border border-black/10 bg-[var(--white)] shadow-sm">
								<summary
									class="grid cursor-pointer gap-3 p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 [&::-webkit-details-marker]:hidden"
								>
									<span class="min-w-0 truncate text-xl font-semibold" title={game.player.name}>
										{game.player.name}
									</span>
									<div class="flex items-center justify-end gap-3">
										<span
											class={`rounded-full border px-2.5 py-1 text-xs font-semibold ${completionBadgeClass(completedStations, game.stations.length)}`}
										>
											{completedStations}/{game.stations.length} completed
										</span>
										<button
											type="button"
											aria-label={`View game for ${game.player.name}`}
											title="View game"
											onclick={(event) => handleViewClick(event, game.id)}
											class="rounded-md p-1 text-[var(--primary)] transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
										>
											<Icon icon="lucide:eye" class="text-xl" aria-hidden="true" />
										</button>
										<Icon
											icon="lucide:chevron-down"
											class="text-xl transition-transform group-open:rotate-180"
											aria-hidden="true"
										/>
									</div>
								</summary>

								<div class="grid content-start gap-5 border-t border-black/10 p-5">
									<div class="grid gap-1">
										<p class="font-mono text-xs text-[var(--grey)]">{game.publicId}</p>
									</div>

									<dl class="grid gap-3 text-sm">
										<div class="flex items-baseline justify-between gap-4">
											<dt class="text-[var(--grey)]">Created</dt>
											<dd class="text-right font-medium">
												{formatBrowserLocalDate(game.createdAt)}
											</dd>
										</div>
									</dl>

									<div
										class="flex items-center justify-between gap-4 border-t border-black/10 pt-4"
									>
										<span class="text-sm text-[var(--grey)]">Stations</span>
										<strong class="text-sm"
											>{completedStations}/{game.stations.length} completed</strong
										>
									</div>

									<div class="border-t border-black/10 pt-4">
										<p class="text-sm font-semibold">Stations</p>
										<ul class="mt-3 grid gap-2" aria-label="Stations">
											{#each game.stations as station, index}
												<li class="flex items-center gap-2 text-sm">
													<Icon
														icon={statusIcon(station.status)}
														class={station.status === 'completed'
															? 'text-[var(--success)]'
															: 'text-[var(--warning)]'}
														aria-hidden="true"
													/>
													<span>Station {index + 1}. {getStationStatusLabel(station.status)}</span>
												</li>
											{/each}
										</ul>
									</div>
								</div>
							</details>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</section>
</main>
