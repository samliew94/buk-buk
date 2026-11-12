<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import { getGame, InvalidApiResponseError, type GameDetails } from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';

	type PageState = 'loading' | 'ready' | 'error' | 'not-found';
	const BOX_COUNT = 25;

	const routeId = $derived(page.params.id);
	let pageState = $state<PageState>('loading');
	let game = $state<GameDetails | null>(null);
	let error = $state('');
	let winnerIndex = $state(-1);
	let revealed = $state<boolean[]>([]);
	let celebrating = $state(false);
	const allRevealed = $derived(revealed.length > 0 && revealed.every(Boolean));

	function parseGameId(value: string | undefined): number | null {
		if (!value || !/^\d+$/.test(value)) return null;
		const id = Number(value);
		return Number.isSafeInteger(id) && id > 0 ? id : null;
	}

	function randomIndex(length: number): number {
		if (length <= 0) return -1;
		const limit = Math.floor(0x1_0000_0000 / length) * length;
		const values = new Uint32Array(1);
		do crypto.getRandomValues(values);
		while (values[0] >= limit);
		return values[0] % length;
	}

	function roll() {
		winnerIndex = randomIndex(revealed.length);
		celebrating = false;
	}

	function toggleAll() {
		revealed = revealed.map(() => !allRevealed);
	}

	function reveal(index: number) {
		if (revealed[index]) return;
		revealed[index] = true;
		revealed = [...revealed];
		if (index === winnerIndex) celebrating = true;
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
				responseData.error.trim()
			)
				return responseData.error;
		}
		return 'Unable to load game. Please try again.';
	}

	async function loadGame() {
		const token = localStorage.getItem('gm_token');
		if (!token) {
			await goto('/auth/gm/login', { replaceState: true });
			return;
		}
		const id = parseGameId(routeId);
		if (id === null) {
			pageState = 'not-found';
			return;
		}
		pageState = 'loading';
		error = '';
		try {
			game = await getGame(id, token);
			revealed = Array.from({ length: BOX_COUNT }, () => false);
			roll();
			pageState = 'ready';
		} catch (cause) {
			if (isAxiosError(cause) && cause.response?.status === 401) {
				localStorage.removeItem('gm_token');
				await goto('/auth/gm/login', { replaceState: true });
				return;
			}
			if (isAxiosError(cause) && cause.response?.status === 404) {
				pageState = 'not-found';
				return;
			}
			error = getErrorMessage(cause);
			pageState = 'error';
		}
	}

	onMount(() => void loadGame());
</script>

<svelte:head>
	<title>Lucky Draw</title>
</svelte:head>

<main class="relative min-h-screen overflow-hidden bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="relative z-10 mx-auto grid w-full max-w-7xl gap-6 p-4">
		<header class="grid gap-4">
			<a
				href="/gm/games"
				class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
			>
				<Icon icon="lucide:arrow-left" aria-hidden="true" /> Back to games
			</a>
			<div class="flex flex-wrap items-end justify-between gap-4">
				<div class="grid gap-1">
					<h1 class="text-3xl font-semibold">Lucky Draw</h1>
					{#if game}<p class="text-[var(--grey)]">
							{game.player.name} · {game.player.pax} players
						</p>{/if}
				</div>
				{#if pageState === 'ready'}
					<div class="flex gap-1">
						<Button variant="grey" onclick={toggleAll}>Show/Hide</Button>
						<Button onclick={roll}>Roll</Button>
					</div>
				{/if}
			</div>
		</header>

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 p-6 shadow-sm" role="status">
				Loading game...
			</div>
		{:else if pageState === 'not-found'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				Game not found.
			</div>
		{:else if pageState === 'error'}
			<div
				class="grid gap-4 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="max-w-32"><Button onclick={() => void loadGame()}>Retry</Button></div>
			</div>
		{:else if revealed.length === 0}
			<div class="rounded-lg border border-black/10 p-6 text-[var(--grey)] shadow-sm">
				No players are available for this draw.
			</div>
		{:else}
			<div class="grid grid-cols-5 gap-2 sm:grid-cols-3 sm:gap-4" aria-label="Lucky draw boxes">
				{#each revealed as isRevealed, index}
					<button
						type="button"
						onclick={() => reveal(index)}
						aria-label={`Box ${index + 1}${isRevealed ? (index === winnerIndex ? ', winner' : ', bust') : ', hidden'}`}
						class={`relative aspect-square rounded-lg border p-1 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 sm:p-4 ${isRevealed ? (index === winnerIndex ? 'border-[var(--success)] bg-[var(--success)] text-[var(--white)]' : 'border-black/10 bg-[var(--grey)] text-[var(--white)]') : 'border-[var(--primary)]/20 bg-[var(--primary)] text-[var(--white)]'}`}
					>
						<span class="absolute top-1 left-1 text-xs font-semibold sm:top-3 sm:left-3 sm:text-lg"
							>{index + 1}</span
						>
						<Icon
							icon={isRevealed
								? index === winnerIndex
									? 'lucide:badge-dollar-sign'
									: 'lucide:wind'
								: 'lucide:gift'}
							class="absolute inset-0 m-auto text-xl sm:text-3xl"
							aria-hidden="true"
						/>
					</button>
				{/each}
			</div>
		{/if}
	</section>

	{#if celebrating}
		<div class="fireworks pointer-events-none absolute inset-0 z-20" aria-hidden="true">
			{#each Array(24) as _, index}<span style={`--i: ${index}`}></span>{/each}
		</div>
		<div
			class="pointer-events-none fixed inset-x-4 bottom-8 z-30 rounded-lg bg-[var(--success)] p-5 text-center text-2xl font-semibold text-[var(--white)] shadow-xl"
			role="status"
		>
			Congratulations! You Won!
		</div>
	{/if}
</main>

<style>
	.fireworks span {
		position: absolute;
		left: 50%;
		top: 45%;
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 9999px;
		background: hsl(calc(var(--i) * 47deg) 90% 55%);
		animation: burst 1.4s ease-out infinite;
		animation-delay: calc(var(--i) * -0.055s);
		transform: rotate(calc(var(--i) * 15deg)) translateY(-2rem);
	}

	@keyframes burst {
		0% {
			opacity: 1;
			transform: rotate(calc(var(--i) * 15deg)) translateY(-2rem) scale(1);
		}
		100% {
			opacity: 0;
			transform: rotate(calc(var(--i) * 15deg)) translateY(-45vmin) scale(0.2);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fireworks span {
			animation: none;
			opacity: 0;
		}
	}
</style>
