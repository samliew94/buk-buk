<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let order = $state<{ id: string; price: number; status: string } | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	const status = $derived(order?.status);
	let submitting = $state(false);
	let message = $state('');
	let redirectReference = $state<string | null>(null);
	let countdown = $state(3);
	const amount = $derived(
		new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(order?.price ?? 0)
	);

	$effect(() => {
		const { apiUrl, orderId } = data;
		const controller = new AbortController();
		order = null;
		loading = true;
		loadError = '';
		message = '';
		redirectReference = null;
		async function loadOrder() {
			try {
				if (!apiUrl) throw new Error('Payment service is unavailable.');
				const response = await fetch(
					new URL(`/v1/demo-payment-orders/${encodeURIComponent(orderId)}`, apiUrl),
					{ signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) }
				);
				if (!response.ok) throw new Error('Unable to load payment order. Please try again.');
				const loaded: { id: string; price: number; status: string; reference_id: string } | null =
					await response.json();
				if (!loaded) throw new Error('Payment order not found.');
				if (!controller.signal.aborted) {
					order = loaded;
					if (loaded.status !== 'pending') {
						redirectReference = loaded.reference_id;
					}
				}
			} catch (error) {
				if (!controller.signal.aborted) {
					loadError =
						error instanceof Error
							? error.message
							: 'Unable to load payment order. Please try again.';
				}
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}
		void loadOrder();
		return () => controller.abort();
	});

	$effect(() => {
		if (!redirectReference) return;
		const destination = `/customer/payments/${encodeURIComponent(redirectReference)}`;
		countdown = 3;
		let remaining = 3;
		const timer = window.setInterval(() => {
			remaining -= 1;
			countdown = remaining;
			if (remaining === 0) {
				window.clearInterval(timer);
				window.location.assign(destination);
			}
		}, 1000);
		return () => window.clearInterval(timer);
	});

	async function submit(outcome: 'paid' | 'cancelled') {
		if (!order || submitting || status !== 'pending') return;
		submitting = true;
		message = '';
		try {
			const response = await fetch(
				new URL(`/v1/demo-payment-orders/${encodeURIComponent(order.id)}`, data.apiUrl),
				{
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ status: outcome }),
					signal: AbortSignal.timeout(15000)
				}
			);
			if (!response.ok) throw new Error('Payment request failed.');
			const result: { status: string; reference_id: string } = await response.json();
			order = { ...order, status: result.status };
			redirectReference = result.reference_id;
		} catch {
			message = 'Unable to confirm the payment result. Reload the page to check its status.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Demo payment gateway</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	class="flex min-h-screen items-center justify-center bg-slate-100 p-4 font-sans text-slate-900"
>
	<section
		class="w-full max-w-md rounded-xl bg-white p-6 shadow-sm"
		aria-labelledby="payment-title"
	>
		<h1 id="payment-title" class="mb-6 text-xl font-semibold">Demo payment gateway</h1>
		{#if loading}
			<p role="status" class="text-center text-sm">Loading payment…</p>
		{:else if loadError}
			<p role="alert" class="text-sm text-red-700">{loadError}</p>
		{:else if order}
			<dl class="space-y-4">
				<div>
					<dt class="order-id-label text-xs">Order ID</dt>
					<dd class="mt-1 break-all">{order.id}</dd>
				</div>
			</dl>
			<p class="mt-4 text-center text-2xl font-semibold">{amount}</p>
			<div class="payment-actions mt-6 grid grid-cols-2 gap-3">
				<button
					type="button"
					class="approve-button min-h-11 rounded-lg px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={submitting || status !== 'pending' || !!message}
					onclick={() => submit('paid')}>Approve</button
				>
				<button
					type="button"
					class="min-h-11 rounded-lg bg-transparent px-4 font-semibold text-black hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={submitting || status !== 'pending' || !!message}
					onclick={() => submit('cancelled')}>Cancel</button
				>
			</div>
			<div class="text-center" role="status" aria-live="polite">
				{#if submitting}
					<p class="mt-4 text-sm">Processing…</p>
				{:else if status !== 'pending'}
					<p class="mt-4 text-sm" class:payment-approved={status === 'paid'}>
						{status === 'paid'
							? 'Payment approved.'
							: status === 'cancelled'
								? 'Payment cancelled.'
								: `Payment ${status}.`}
						{#if redirectReference}
							Redirecting in {countdown}...{/if}
					</p>
				{/if}
			</div>
			{#if message}<p role="alert" class="mt-4 text-sm text-red-700">{message}</p>{/if}
		{/if}
	</section>
</main>

<style>
	.order-id-label {
		color: #848484;
	}

	.payment-actions button {
		padding-block: 0.75rem;
	}

	.approve-button {
		background-color: #1d4ed8;
		color: #fff;
	}

	.approve-button:hover {
		background-color: #1e40af;
	}

	.payment-approved {
		color: #1d4ed8;
	}
</style>
