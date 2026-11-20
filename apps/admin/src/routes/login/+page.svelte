<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Button from '@booking/ui/Button.svelte';
	import TopNav from '@booking/ui/TopNav.svelte';
	import { signIn } from '$lib/auth/session';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let username = $state('');
	let password = $state('');
	let busy = $state(false);
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let message = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !ready) return;
		busy = true;
		message = '';
		try {
			await signIn(data.apiUrl, username, password);
			await goto('/calendar', { replaceState: true });
		} catch (error) {
			message = error instanceof Error ? error.message : 'Unable to sign in. Please try again.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Admin sign-in</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="customer-app">
	<TopNav name="BUK BUK" links={[]} />
	<main class="mx-auto max-w-md px-5 py-10">
		<form method="post" class="admin-form" onsubmit={submit} aria-busy={busy}>
			<h1 class="!text-2xl">Admin sign-in</h1>
			<label
				>Username <input
					bind:value={username}
					name="username"
					autocomplete="username"
					disabled={!ready}
					required
				/></label
			>
			<label>
				Password
				<input
					bind:value={password}
					name="password"
					type="password"
					autocomplete="current-password"
					disabled={!ready}
					required
				/>
			</label>
			{#if message}<p role="alert">{message}</p>{/if}
			<Button type="submit" disabled={busy || !ready}>{busy ? 'Signing in…' : 'Sign in'}</Button>
		</form>
	</main>
</div>
