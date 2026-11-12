<script lang="ts">
	import { goto } from '$app/navigation';
	import { isAxiosError } from 'axios';
	import { loginGm } from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import Input from '$lib/shared/ui/Input.svelte';

	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	function getErrorMessage(cause: unknown): string {
		if (isAxiosError(cause)) {
			if (!cause.response) return 'Unable to reach the server. Please try again.';

			const responseData: unknown = cause.response.data;
			if (
				isRecord(responseData) &&
				typeof responseData.error === 'string' &&
				responseData.error.trim().length > 0
			) {
				return responseData.error;
			}

			return 'Login failed. Please try again.';
		}

		if (cause instanceof Error && cause.message.length > 0) return cause.message;
		return 'Login failed. Please try again.';
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (loading) return;

		error = '';
		if (password.trim().length === 0) {
			error = 'Password is required.';
			return;
		}

		loading = true;
		try {
			const response = await loginGm(password);
			localStorage.setItem('gm_token', response.token);
			await goto('/gm/games');
		} catch (cause) {
			error = getErrorMessage(cause);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>GM Login</title>
</svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
		<div class="w-full max-w-md rounded-lg border border-black/10 bg-[var(--white)] p-4 shadow-sm">
			<h1 class="mb-6 text-2xl font-semibold">GM Login</h1>

			<form class="grid gap-6" novalidate onsubmit={handleSubmit}>
				<Input
					id="password"
					name="password"
					label="Password"
					type="password"
					autocomplete="current-password"
					required
					bind:value={password}
				/>

				<div class="grid gap-2">
					<Button type="submit" {loading} loadingLabel="Logging in...">Login</Button>
					{#if error}
						<span class="text-sm text-[var(--danger)]" role="alert">{error}</span>
					{/if}
				</div>
			</form>
		</div>
	</section>
</main>
