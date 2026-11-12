<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { env } from '$env/dynamic/public';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import { getStationList, InvalidApiResponseError, type GameStation } from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';

	type PageState = 'loading' | 'ready' | 'empty' | 'error' | 'invalid';

	const gameId = $derived(page.params.gameId ?? '');
	const feedbackUrl = $derived((env.PUBLIC_GOOGLE_FORM_FEEDBACK_URL ?? '').trim());
	let pageState = $state<PageState>('loading');
	let stations = $state<GameStation[]>([]);
	let error = $state('');
	let showWinModal = $state(false);
	let showMapModal = $state(false);
	let showLuckyDrawModal = $state(false);
	const completedCount = $derived(
		stations.filter((station) => station.status === 'completed').length
	);
	const isGameComplete = $derived(
		pageState === 'ready' && stations.length > 0 && completedCount === stations.length
	);

	function isUnauthorized(cause: unknown): boolean {
		return isAxiosError(cause) && cause.response?.status === 401;
	}

	function getErrorMessage(cause: unknown): string {
		if (cause instanceof InvalidApiResponseError) return cause.message;
		if (isAxiosError(cause)) {
			if (!cause.response) return 'Unable to reach the server. Please try again.';
			if (cause.response.status === 404)
				return 'Game not found. Check the game link and try again.';

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

			return 'Unable to load Moon Rabbits. Please try again.';
		}

		if (cause instanceof Error && cause.message.length > 0) return cause.message;
		return 'Unable to load Moon Rabbits. Please try again.';
	}

	function closeMapModal() {
		showMapModal = false;
	}

	function handleMapModalClick(event: MouseEvent) {
		if (event.target === event.currentTarget) closeMapModal();
	}

	function handleMapModalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeMapModal();
	}

	function closeLuckyDrawModal() {
		showLuckyDrawModal = false;
	}

	function handleLuckyDrawModalClick(event: MouseEvent) {
		if (event.target === event.currentTarget) closeLuckyDrawModal();
	}

	function handleLuckyDrawModalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeLuckyDrawModal();
	}

	async function loadStations() {
		const token = localStorage.getItem('player_token');
		if (!token) {
			await goto('/auth/player/login', { replaceState: true });
			return;
		}

		const currentGameId = gameId.trim();
		if (!currentGameId) {
			pageState = 'invalid';
			return;
		}

		pageState = 'loading';
		error = '';
		showWinModal = false;
		try {
			stations = (await getStationList(currentGameId, token)).stations;
			pageState = stations.length === 0 ? 'empty' : 'ready';
			showWinModal =
				stations.length > 0 && stations.every((station) => station.status === 'completed');
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('player_token');
				await goto('/auth/player/login', { replaceState: true });
				return;
			}

			error = getErrorMessage(cause);
			pageState = 'error';
		}
	}

	onMount(() => {
		void loadStations();
	});
</script>

<svelte:head>
	<title>Moon Rabbits</title>
</svelte:head>

<main
	class="relative isolate min-h-screen bg-[var(--white)] bg-cover bg-center p-8 text-[var(--white)]"
	style="background-image: url('https://cdn.astra-cloud-solutions.com/xunbao/shared/bg-image-5.webp');"
>
	<div class="absolute inset-0 z-0 bg-black/90" aria-hidden="true"></div>
	<section class="relative z-10 mx-auto grid w-full max-w-4xl gap-6 p-4">
		<header class="grid gap-4">
			<h1 class="text-center text-3xl font-semibold text-[var(--white)]">Find the Moon Rabbits!</h1>
			<div class="h-px w-full bg-[var(--accent)]" aria-hidden="true"></div>
			{#if pageState === 'ready' || pageState === 'empty'}
				<div
					class="flex items-center justify-center gap-1"
					aria-label={`${completedCount} of ${stations.length} Moon Rabbits found`}
				>
					<span class="sr-only">{completedCount} of {stations.length} Moon Rabbits found</span>
					{#each stations as station, index (station.id)}
						<Icon
							icon="mdi:rabbit"
							class="text-2xl"
							style={`color: var(${station.status === 'completed' ? '--success' : '--grey'})`}
							aria-hidden="true"
						/>
					{/each}
				</div>
			{/if}
			<div class="grid gap-2 text-center text-[var(--white)]">
				<p>Help Chang'e find all her Moon Rabbits scattered across the park!</p>
				<div class="mx-auto h-px w-16 bg-[var(--accent)]" aria-hidden="true"></div>
				<button
					type="button"
					onclick={() => (showMapModal = true)}
					class="mx-auto inline-flex items-center gap-2 hover:opacity-80 focus:ring-2 focus:ring-[var(--white)] focus:outline-none"
				>
					<Icon icon="lucide:map" class="text-base" aria-hidden="true" />
					<span class="underline underline-offset-4">View Map</span>
				</button>
			</div>
		</header>

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				<p class="text-[var(--grey)]">Loading Moon Rabbits...</p>
			</div>
		{:else if pageState === 'invalid'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>Invalid game link. Please use the game link provided by your game master.</p>
			</div>
		{:else if pageState === 'error'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="mt-4 max-w-32">
					<Button onclick={() => void loadStations()}>Retry</Button>
				</div>
			</div>
		{:else if pageState === 'empty'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm">
				<p class="text-[var(--grey)]">No Moon Rabbits are available for this game.</p>
			</div>
		{:else}
			<div class="grid grid-cols-3 justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-5">
				{#each stations as station, index (station.id)}
					<a
						href={`/play/${encodeURIComponent(gameId)}/${encodeURIComponent(String(station.id))}`}
						aria-label={`Moon Rabbit ${index + 1}${station.status === 'completed' ? ', found' : ', not found'}`}
						class={`relative aspect-[5/7] w-full rounded-lg border border-[var(--white)]/20 p-4 text-[var(--white)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 ${station.status === 'completed' ? 'bg-[var(--success)]' : 'bg-[var(--grey)]'}`}
					>
						<span class="absolute top-3 left-3 text-lg leading-none font-semibold">{index + 1}</span
						>
						<div class="absolute inset-0 flex items-center justify-center">
							<Icon icon="mdi:rabbit" class="text-4xl text-[var(--white)]" aria-hidden="true" />
						</div>
						<span class="absolute right-3 bottom-3 rotate-180 text-lg leading-none font-semibold"
							>{index + 1}</span
						>
					</a>
				{/each}
			</div>
			<Button disabled={!isGameComplete} onclick={() => (showLuckyDrawModal = true)}>
				<span class="inline-flex items-center justify-center gap-2">
					<Icon icon="lucide:gift" aria-hidden="true" />
					Lucky Draw
				</span>
			</Button>
			<a
				href={`/play/${encodeURIComponent(gameId)}/gallery`}
				class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--white)] transition hover:opacity-90 focus:ring-2 focus:ring-[var(--primary)]/30 focus:outline-none"
			>
				<Icon icon="lucide:images" aria-hidden="true" />
				Gallery
			</a>
		{/if}
	</section>
</main>

{#if showMapModal}
	<dialog
		open
		tabindex="-1"
		aria-modal="true"
		aria-label="Park map"
		onclick={handleMapModalClick}
		onkeydown={handleMapModalKeydown}
		class="fixed inset-0 z-50 m-0 grid h-full w-full max-w-none place-items-center border-0 bg-black/80 p-4"
	>
		<section
			class="relative max-h-full w-full max-w-4xl rounded-lg bg-[var(--white)] p-4 shadow-xl"
		>
			<button
				type="button"
				onclick={closeMapModal}
				aria-label="Close map"
				title="Close"
				class="absolute top-2 right-2 z-10 grid size-11 place-items-center rounded-full bg-black/60 text-[var(--white)] transition hover:bg-black/80 focus:ring-2 focus:ring-[var(--primary)] focus:outline-none"
			>
				<Icon icon="lucide:x" class="text-xl" aria-hidden="true" />
			</button>
			<img
				src="https://cdn.astra-cloud-solutions.com/xunbao/shared/map.webp"
				alt="Park map"
				class="mx-auto max-h-[calc(100dvh-4rem)] max-w-full rounded-md object-contain"
			/>
		</section>
	</dialog>
{/if}

{#if showLuckyDrawModal}
	<dialog
		open
		aria-modal="true"
		aria-labelledby="lucky-draw-modal-title"
		aria-describedby="lucky-draw-modal-message"
		onclick={handleLuckyDrawModalClick}
		onkeydown={handleLuckyDrawModalKeydown}
		class="fixed inset-0 z-50 m-0 grid h-full w-full max-w-none place-items-center border-0 bg-black/60 p-4"
	>
		<section
			class="grid w-full max-w-md gap-5 rounded-lg bg-[var(--white)] p-6 text-center text-[var(--black)] shadow-xl"
		>
			<Icon icon="lucide:gift" class="mx-auto text-5xl text-[var(--primary)]" aria-hidden="true" />
			<div class="grid gap-2">
				<h2 id="lucky-draw-modal-title" class="text-2xl font-semibold">Congratulations!</h2>
				<p id="lucky-draw-modal-message" class="text-[var(--grey)]">
					Please visit the booth for lucky draw
				</p>
			</div>
			<Button onclick={closeLuckyDrawModal}>Done</Button>
		</section>
	</dialog>
{/if}

{#if isGameComplete && showWinModal}
	<dialog
		open
		class="fixed inset-0 z-10 m-0 grid h-full w-full max-w-none place-items-center border-0 bg-black/60 p-4"
		aria-modal="true"
		aria-labelledby="win-modal-title"
		aria-describedby="win-modal-message"
	>
		<section
			class="grid max-h-full w-full max-w-lg gap-5 overflow-y-auto rounded-lg bg-white p-6 text-[var(--black)] shadow-xl"
		>
			<div class="grid gap-3 text-center">
				<h2 id="win-modal-title" class="text-2xl font-semibold text-[var(--black)]">
					Found all Moon Rabbits!
				</h2>
				<div class="mx-auto h-px w-16 bg-[var(--accent)]" aria-hidden="true"></div>
				<div id="win-modal-message" class="grid gap-3 text-sm leading-relaxed">
					<p class="text-base font-semibold text-[var(--grey)]">Thank you for playing!</p>
					<img
						src="https://cdn.astra-cloud-solutions.com/xunbao/shared/rabbit-thank-you.png"
						alt="Thank you"
						width="128"
						height="128"
						class="mx-auto size-32 object-contain"
					/>
					<p>Hope you had a good time & some good laughs!</p>
					<p>
						You can access your photos in the
						<a
							href={`/play/${encodeURIComponent(gameId)}/gallery`}
							class="font-semibold text-[var(--primary)] underline underline-offset-2">Gallery</a
						>.
					</p>
					<p>
						Suggestions / Feedbacks:
						{#if feedbackUrl}
							<a
								href={feedbackUrl}
								target="_blank"
								rel="noreferrer"
								class="font-semibold text-[var(--primary)] underline underline-offset-2"
								>Google Form</a
							>
						{:else}here{/if}
					</p>
					<div
						class="flex items-center justify-center gap-2 text-[var(--accent)]"
						aria-hidden="true"
					>
						<div class="h-px w-8 bg-current"></div>
						<div class="size-2 rotate-45 bg-current"></div>
						<div class="h-px w-8 bg-current"></div>
					</div>
					<p class="font-dm-sans text-xl leading-tight">Happy Mid-Autumn Festival!</p>
					<p class="font-ma-shan-zheng text-xl leading-tight">中秋节快乐！</p>
				</div>
			</div>
			<div>
				<Button onclick={() => (showWinModal = false)}>Done</Button>
			</div>
		</section>
	</dialog>
{/if}
