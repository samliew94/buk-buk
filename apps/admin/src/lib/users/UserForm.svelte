<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '@booking/ui/Button.svelte';
	import type { Principal } from '$lib/auth/session';
	import { staffFetch, requestMessage } from '$lib/auth/staff';
	import type { User } from './types';

	let { apiUrl, principal, user }: { apiUrl: string; principal: Principal; user?: User } = $props();
	let username = $state('');
	let password = $state('');
	let banned = $state(false);
	let saving = $state(false);
	let message = $state('');

	$effect(() => {
		username = user?.username ?? '';
		password = '';
		banned = user?.is_banned ?? false;
		message = '';
	});

	let readOnly = $derived(principal.role === 'manager' && user?.role === 'developer');
	let mayBan = $derived(!!user && (principal.role === 'developer' || principal.id !== user.id));
	let normalized = $derived(username.trim().toLowerCase());
	let changed = $derived(
		!user ||
			normalized !== user.username ||
			password !== '' ||
			(mayBan && banned !== user.is_banned)
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (saving || readOnly || !changed) return;
		message = '';
		if (!normalized) {
			message = 'Enter a username.';
			return;
		}
		const passwordLength = [...password].length;
		if ((!user || password !== '') && (passwordLength < 8 || passwordLength > 128)) {
			message = 'Enter a password with 8–128 characters.';
			return;
		}
		const changes = {
			...(!user || normalized !== user.username ? { username: normalized } : {}),
			...(!user || password !== '' ? { password } : {}),
			...(user && mayBan && banned !== user.is_banned ? { is_banned: banned } : {})
		};
		saving = true;
		try {
			const response = await staffFetch(
				apiUrl,
				user ? `/v1/users/${encodeURIComponent(user.id)}` : '/v1/users',
				{
					method: user ? 'PUT' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(changes),
					signal: AbortSignal.timeout(12000)
				}
			);
			if (response.status === 409) message = 'That username is already in use.';
			else if (response.status === 400) message = 'Check the username and password and try again.';
			else if (response.status === 404) message = 'This user no longer exists.';
			else if (!response.ok) throw new Error();
			else await goto('/users');
		} catch (error) {
			message = requestMessage(error, 'Unable to save this user. Please try again.');
		} finally {
			saving = false;
		}
	}
</script>

<form method="post" class="admin-form" onsubmit={submit} aria-busy={saving} novalidate>
	<h1 class="!text-2xl">{user ? (readOnly ? 'View user' : 'Edit user') : 'New manager'}</h1>
	{#if readOnly && user}
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
			<dt>Username</dt>
			<dd class="wrap-anywhere">{user.username}</dd>
			<dt>Role</dt>
			<dd class="capitalize">{user.role}</dd>
			<dt>Status</dt>
			<dd>{user.is_banned ? 'Banned' : 'Active'}</dd>
		</dl>
	{:else}
		{#if user}<p class="capitalize">{user.role} · {user.is_banned ? 'Banned' : 'Active'}</p>{/if}
		<label>
			Username
			<input
				name="username"
				bind:value={username}
				autocomplete="off"
				autocapitalize="none"
				required
				disabled={saving}
			/>
		</label>
		<label>
			{user ? 'New password (optional)' : 'Password'}
			<input
				name="password"
				bind:value={password}
				type="password"
				autocomplete="new-password"
				required={!user}
				disabled={saving}
			/>
			<span class="text-sm">8–128 characters</span>
		</label>
		{#if mayBan}
			<label class="!flex items-center gap-2">
				<input name="banned" type="checkbox" bind:checked={banned} disabled={saving} />
				Banned
			</label>
		{/if}
	{/if}
	{#if message}<p role="alert">{message}</p>{/if}
	<div class="flex flex-wrap items-center gap-3">
		{#if !readOnly}
			<Button type="submit" disabled={saving || !changed}
				>{saving ? 'Saving…' : user ? 'Save changes' : 'Create manager'}</Button
			>
		{/if}
		<a href="/users" class="booking-button" data-variant="ghost"
			>{readOnly ? 'Back to users' : 'Cancel'}</a
		>
	</div>
</form>
