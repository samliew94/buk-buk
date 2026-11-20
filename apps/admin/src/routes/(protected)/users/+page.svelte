<script lang="ts">
	import AdminNav from '$lib/auth/AdminNav.svelte';
	import { requestMessage, staffFetch } from '$lib/auth/staff';
	import type { User } from '$lib/users/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let users = $state<User[]>([]);
	let loading = $state(true);
	let message = $state('');
	let attempt = $state(0);

	$effect(() => {
		const { apiUrl } = data;
		void attempt;
		const controller = new AbortController();
		loading = true;
		message = '';
		void (async () => {
			try {
				const response = await staffFetch(apiUrl, '/v1/users', {
					method: 'QUERY',
					headers: { 'Content-Type': 'application/json' },
					body: '{}',
					signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])
				});
				if (!response.ok) throw new Error();
				const result: User[] = await response.json();
				if (!controller.signal.aborted) users = result;
			} catch (error) {
				if (!controller.signal.aborted) message = requestMessage(error, 'Unable to load users.');
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<svelte:head>
	<title>Admin users</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="customer-app">
	<AdminNav links={data.navigation} name={data.name} />
	<main class="mx-auto max-w-3xl px-5 py-8">
		<div class="mb-5 flex flex-wrap items-center justify-between gap-4">
			<h1 class="!text-2xl">Users</h1>
			<a href="/users/new" class="booking-button" data-variant="primary">New manager</a>
		</div>
		<section
			class="overflow-hidden rounded-2xl bg-booking-container"
			aria-label="User accounts"
			aria-busy={loading}
		>
			{#if loading}
				<p class="p-5" role="status">Loading users…</p>
			{:else if message}
				<div class="grid justify-items-start gap-3 p-5">
					<p role="alert">{message}</p>
					<button
						type="button"
						class="booking-button"
						data-variant="secondary"
						onclick={() => attempt++}>Retry</button
					>
				</div>
			{:else if users.length === 0}
				<p class="p-5">No users found.</p>
			{:else}
				<ul class="divide-y divide-booking-white/20">
					{#each users as user (user.id)}
						<li class="flex items-center justify-between gap-4 p-5">
							<div class="min-w-0">
								<strong class="block wrap-anywhere">{user.username}</strong>
								<span class="capitalize">{user.role}</span>
								<span aria-hidden="true"> · </span>
								<span class={user.is_banned ? 'text-booking-danger' : 'text-booking-success'}>
									{user.is_banned ? 'Banned' : 'Active'}
								</span>
							</div>
							<a
								class="shrink-0 underline hover:text-booking-primary"
								href={`/users/${encodeURIComponent(user.id)}/edit`}
								aria-label={`${data.principal.role === 'manager' && user.role === 'developer' ? 'View' : 'Edit'} ${user.username}`}
							>
								{data.principal.role === 'manager' && user.role === 'developer' ? 'View' : 'Edit'}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
</div>
