<script lang="ts">
	import { page } from '$app/state';
	import Button from './Button.svelte';
	let { name = '' }: { name?: string | null } = $props();
	let links = $derived([
		...(page.url.pathname.startsWith('/admin/') || page.url.pathname === '/admin'
			? [
					{ href: '/admin/bookings', label: 'Bookings' },
					{ href: '/admin/payments', label: 'Payments' }
				]
			: []),
		{ href: '/customer/bookings/new', label: 'New Reservation' }
	]);
	let navigation: HTMLElement;
	let drawerTop = $state(48);
	let menuOpen = $state(false);
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') menuOpen = false;
	}}
/>

<nav
	bind:this={navigation}
	class="relative z-10 flex h-12 items-center justify-between gap-3 bg-booking-container px-5 shadow-[0_4px_8px_rgb(0_0_0/60%)] sm:px-7"
	aria-label="Main navigation"
>
	<span class="font-semibold text-booking-white">{name ?? ''}</span>
	<div class="ml-auto hidden items-center gap-6 md:flex">
		{#each links as link (link.href)}
			<a
				href={link.href}
				class="py-3 text-[16px] font-normal text-booking-white transition-[color,translate] duration-200 hover:text-booking-primary focus-visible:outline-2 focus-visible:outline-booking-primary active:text-booking-primary motion-safe:hover:-translate-y-0.5"
				>{link.label}</a
			>
		{/each}
	</div>
	<div class="ml-auto md:hidden">
		<Button
			variant="ghost"
			icon="mdi:menu"
			aria-label={menuOpen ? 'Close menu' : 'Open menu'}
			aria-expanded={menuOpen}
			class="min-h-8! px-2!"
			onclick={() => {
				drawerTop = navigation.getBoundingClientRect().bottom;
				menuOpen = !menuOpen;
			}}
		/>
	</div>
</nav>

{#if menuOpen}
	<button
		type="button"
		aria-label="Close navigation menu"
		tabindex="-1"
		class="fixed inset-x-0 bottom-0 z-20 bg-[#626262]/14 backdrop-blur-[4px] md:hidden"
		style:top={`${drawerTop}px`}
		onclick={() => (menuOpen = false)}
	></button>
	<div
		style:top={`${drawerTop}px`}
		style:max-height={`calc(100dvh - ${drawerTop}px)`}
		class="fixed inset-x-0 z-30 h-auto w-full overflow-y-auto bg-booking-black p-5 text-booking-white sm:p-7 md:hidden"
	>
		<nav aria-label="Page navigation">
			{#each links as link (link.href)}
				<a
					href={link.href}
					onclick={() => (menuOpen = false)}
					class="block py-3 text-center text-[14px] font-normal text-booking-white focus-visible:outline-2 focus-visible:outline-booking-primary active:text-booking-primary"
					>{link.label}</a
				>
			{/each}
		</nav>
	</div>
{/if}
