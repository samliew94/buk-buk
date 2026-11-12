<script lang="ts">
	import Icon from '@iconify/svelte';

	const links = [
		{ href: '/gm/games', label: 'Games', icon: 'lucide:gamepad-2' },
		{ href: '/gm/riddles', label: 'Riddles', icon: 'lucide:circle-help' },
		{ href: '/gm/poses', label: 'Poses', icon: 'lucide:person-standing' },
		{ href: '/gm/station-presets', label: 'Station presets', icon: 'lucide:layers-3' }
	];
</script>

<svelte:head><title>GM Management</title></svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-4xl gap-6 p-4">
		<header class="grid gap-2">
			<p class="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
				Game master
			</p>
			<h1 class="text-3xl font-semibold">Management</h1>
			<p class="text-[var(--grey)]">Choose what to manage.</p>
		</header>

		<nav class="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="GM management">
			{#each links as link}
				<a
					href={link.href}
					class="flex items-center gap-4 rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm transition hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
				>
					<Icon icon={link.icon} class="text-2xl text-[var(--primary)]" aria-hidden="true" />
					<span class="font-semibold">{link.label}</span>
					<Icon icon="lucide:arrow-right" class="ml-auto text-[var(--grey)]" aria-hidden="true" />
				</a>
			{/each}
		</nav>
	</section>
</main>
