<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let message = $state('');

	$effect(() => {
		const { apiUrl, paymentId } = data;
		const controller = new AbortController();
		message = '';

		async function redirectToBooking() {
			try {
				if (!apiUrl) throw new Error('Payment service is unavailable.');
				const response = await fetch(
					new URL(`/v1/payments/${encodeURIComponent(paymentId)}`, apiUrl),
					{ signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) }
				);
				if (!response.ok) throw new Error('Unable to load payment. Reload the page to try again.');
				const payment: { booking_id: string } | null = await response.json();
				if (!payment) throw new Error('Payment not found.');
				if (!payment.booking_id) throw new Error('No booking was found for this payment.');
				if (!controller.signal.aborted) {
					window.location.replace(`/customer/bookings/${encodeURIComponent(payment.booking_id)}`);
				}
			} catch (error) {
				if (!controller.signal.aborted) {
					message =
						error instanceof Error
							? error.message
							: 'Unable to load payment. Reload the page to try again.';
				}
			}
		}

		void redirectToBooking();
		return () => controller.abort();
	});
</script>

<svelte:head>
	<title>Opening your booking</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-5 text-center">
	{#if message}
		<p role="alert">{message}</p>
	{:else}
		<p role="status" aria-live="polite">Opening your booking. Please wait...</p>
	{/if}
</main>
