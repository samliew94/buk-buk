<script lang="ts">
	import { DateTime } from 'luxon';
	import TopNav from '@booking/ui/TopNav.svelte';
	import type { PageData } from './$types';
	import {
		groupBookingReservations,
		type BookingReservation
	} from '$lib/customer/booking-reservations';
	type Booking = {
		id: string;
		status: 'confirmed' | 'cancelled' | 'pending';
		expire_at: string;
		reservations: BookingReservation[];
	};
	let { data }: { data: PageData } = $props();
	let booking = $state<Booking | null>(null);
	let reservations = $derived(groupBookingReservations(booking?.reservations ?? []));
	let loading = $state(true);
	let message = $state('');
	let now = $state(Date.now());
	let status = $derived(
		booking?.status === 'confirmed'
			? 'Confirmed'
			: booking?.status === 'cancelled'
				? 'Cancelled'
				: booking && now >= Date.parse(booking.expire_at)
					? 'Expired'
					: 'Pending'
	);
	function local(value: string) {
		return DateTime.fromISO(value, { zone: 'UTC' }).setZone('Asia/Kuala_Lumpur').setLocale('en');
	}
	function duration(minutes: number) {
		const hours = Math.floor(minutes / 60);
		const rest = Number((minutes % 60).toFixed(6));
		return (
			[
				hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
				rest ? `${rest} ${rest === 1 ? 'minute' : 'minutes'}` : ''
			]
				.filter(Boolean)
				.join(' ') || '0 minutes'
		);
	}
	$effect(() => {
		const { apiUrl, bookingId } = data;
		const controller = new AbortController();
		booking = null;
		loading = true;
		message = '';
		now = Date.now();
		const timer = setInterval(() => {
			now = Date.now();
		}, 1000);
		async function loadBooking() {
			try {
				if (!apiUrl) throw new Error('Missing API configuration');
				const response = await fetch(
					new URL(`/v1/bookings/${encodeURIComponent(bookingId)}`, apiUrl),
					{ signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) }
				);
				if (response.status === 404) {
					if (!controller.signal.aborted)
						message = 'Booking not found. Check your booking reference and reload the page.';
					return;
				}
				if (!response.ok) throw new Error('Lookup failed');
				const result: Booking | null = await response.json();
				if (controller.signal.aborted) return;
				booking = result;
				if (!result)
					message = 'Booking not found. Check your booking reference and reload the page.';
			} catch {
				if (!controller.signal.aborted)
					message = 'Unable to load your booking. Reload the page to try again.';
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}
		void loadBooking();
		return () => {
			controller.abort();
			clearInterval(timer);
		};
	});
</script>

<svelte:head>
	<title>Booking details</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto max-w-5xl">
	<TopNav links={[{ href: '/bookings/new', label: 'New Reservation' }]} name={data.name} />
	<section
		class="mt-5 rounded-2xl bg-booking-white p-5 text-booking-black sm:p-7"
		aria-label="Booking details"
		aria-busy={loading}
	>
		{#if loading}
			<p role="status">Loading your booking. Please wait...</p>
		{:else if message}
			<p role="alert">{message}</p>
		{:else if booking}
			<dl class="detail-rows">
				<div>
					<dt>Booking reference</dt>
					<dd class="w-fit max-w-full bg-booking-primary px-3 py-2 break-all text-booking-black">
						{booking.id}
					</dd>
				</div>
				<div>
					<dt>Status</dt>
					<dd aria-live="polite">{status}</dd>
				</div>
			</dl>
			<hr class="booking-divider" />
			{#each reservations as reservation, index (reservation.id)}
				<dl
					class="detail-rows mt-4 grid-cols-2 items-start sm:grid-cols-1"
					aria-label={`Reservation ${index + 1}`}
				>
					<div>
						<dt>Date</dt>
						<dd>{local(reservation.from).toFormat('ccc d LLL yyyy')}</dd>
					</div>
					<div>
						<dt>Room</dt>
						<dd class="break-words">
							{reservation.room_category_name}{reservation.room_category_acronym?.toUpperCase() === 'RACING'
								? ` × ${reservation.quantity}`
								: ''} · {reservation.rooms.join(', ')}
						</dd>
					</div>
					<div>
						<dt>Time</dt>
						<dd>
							{local(reservation.from).toFormat('h:mma')} - {local(reservation.to).toFormat(
								'h:mma'
							)}
						</dd>
					</div>
					<div>
						<dt>Duration</dt>
						<dd>{duration(reservation.duration)}</dd>
					</div>
				</dl>
			{:else}
				<p class="mt-5">No reservations are attached to this booking.</p>
			{/each}
		{/if}
	</section>
</main>

<style>
	.booking-divider {
		height: 8px;
		margin: 1.25rem 0;
		border: 0;
		background-image: radial-gradient(
			circle at 4px 4px,
			color-mix(in srgb, var(--color-booking-muted) 15%, transparent) 3.5px,
			transparent 4px
		);
		background-size: 21px 8px;
		background-repeat: repeat-x;
	}
	.detail-rows {
		display: grid;
		gap: 1rem;
	}
	.detail-rows > div {
		display: grid;
		gap: 0;
	}
	.detail-rows dt {
		color: var(--color-booking-muted);
	}
	.detail-rows dd {
		min-width: 0;
		color: var(--color-booking-black);
	}
</style>
