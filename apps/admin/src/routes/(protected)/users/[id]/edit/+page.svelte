<script lang="ts">
	import AdminNav from '$lib/auth/AdminNav.svelte';
	import { requestMessage, staffFetch } from '$lib/auth/staff';
	import UserForm from '$lib/users/UserForm.svelte';
	import type { User } from '$lib/users/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let user = $state<User | null>(null);
	let loading = $state(true);
	let attempt = $state(0);
	let message = $state('');

	$effect(() => {
		const { apiUrl, userId } = data;
		void attempt;
		const controller = new AbortController();
		user = null;
		loading = true;
		message = '';
		void (async () => {
			try {
				const response = await staffFetch(apiUrl, `/v1/users/${encodeURIComponent(userId)}`, {
					signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])
				});
				if (!response.ok) throw new Error();
				const result: User | null = await response.json();
				if (!controller.signal.aborted) user = result;
			} catch (error) {
				if (!controller.signal.aborted)
					message = requestMessage(error, 'Unable to load this user.');
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<svelte:head>
	<title>Edit user</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="customer-app">
	<AdminNav links={data.navigation} name={data.name} />
	<main class="mx-auto max-w-lg px-5 py-8">
		{#if loading}
			<p role="status">Loading user…</p>
		{:else if message}
			<div class="admin-form">
				<p role="alert">{message}</p>
				<button
					type="button"
					class="booking-button"
					data-variant="secondary"
					onclick={() => attempt++}>Retry</button
				>
			</div>
		{:else if user}
			<UserForm apiUrl={data.apiUrl} principal={data.principal} {user} />
		{:else}
			<p>User not found.</p>
			<a href="/users" class="booking-button" data-variant="ghost">Back to users</a>
		{/if}
	</main>
</div>
