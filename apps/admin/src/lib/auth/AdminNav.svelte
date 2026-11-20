<script lang="ts">
	import { goto } from '$app/navigation';
	import TopNav from '@booking/ui/TopNav.svelte';
	import { clearSession } from './session';

	let { links, name }: { links: { href: string; label: string }[]; name?: string } = $props();

	function logout() {
		clearSession();
		void goto('/login', { replaceState: true });
	}
</script>

<TopNav {links} {name} action={{ label: 'Logout', run: logout }} />
