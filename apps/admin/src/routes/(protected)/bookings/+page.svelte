<script lang="ts">
	import { staffFetch, requestMessage } from '$lib/auth/staff';
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import { DateTime } from 'luxon';
	import AdminNav from '$lib/auth/AdminNav.svelte';
	import type { Booking } from '$lib/admin/booking-grid';
	import {
		groupBookingReservations,
		type BookingReservation
	} from '$lib/reservation/booking-reservations';
	type ListBooking = Omit<Booking, 'reservations'> & { reservations: BookingReservation[] };
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let result = $state<ListBooking[]>([]);
	let loading = $state(true);
	let message = $state('');
	let attempt = $state(0);
	let selectedDate = $state('');
	let now = $state(Date.now());
	let bookings = $derived(
		result
			.filter((booking) => booking.status !== 'pending' || now < Date.parse(booking.expire_at))
			.sort((a, b) => {
				const first = (booking: ListBooking) =>
					booking.reservations.reduce(
						(start, reservation) => Math.min(start, Date.parse(reservation.from)),
						Infinity
					);
				return first(a) - first(b) || a.id.localeCompare(b.id);
			})
	);
	$effect(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(timer);
	});
	onMount(() => {
		selectedDate = DateTime.now().setZone('Asia/Kuala_Lumpur').toISODate()!;
	});
	let day = $derived(DateTime.fromISO(selectedDate || '1970-01-01', { zone: 'Asia/Kuala_Lumpur' }));
	function local(value: string, format: string) {
		return DateTime.fromISO(value).setLocale('en').toFormat(format);
	}
	function formatDuration(minutes: number) {
		const hours = Math.floor(minutes / 60);
		const remaining = minutes % 60;
		return [
			hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
			remaining || !hours ? `${remaining} ${remaining === 1 ? 'minute' : 'minutes'}` : ''
		]
			.filter(Boolean)
			.join(' ');
	}
	function changeDate(event: Event) {
		const date = (event.currentTarget as HTMLInputElement).value;
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !DateTime.fromISO(date).isValid) return;
		selectedDate = date;
	}
	$effect(() => {
		const { apiUrl, businessId } = data;
		const date = selectedDate;
		if (!date) return;
		void attempt;
		const controller = new AbortController();
		loading = true;
		message = '';
		result = [];
		async function load() {
			try {
				if (!apiUrl) throw new Error('Missing API configuration');
				const response = await staffFetch(apiUrl, '/v1/bookings', {
					method: 'QUERY',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ business_id: businessId, date }),
					signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])
				});
				if (!response.ok) throw new Error('Query failed');
				const value: { bookings: ListBooking[] } = await response.json();
				if (!controller.signal.aborted) result = value.bookings;
			} catch (error) {
				if (!controller.signal.aborted)
					message = requestMessage(error, 'Unable to load bookings. Try again.');
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}
		void load();
		return () => controller.abort();
	});
</script>

<svelte:head>
	<title>Admin bookings</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="admin-navigation">
	<AdminNav links={data.navigation} name={data.name} />
</div>
<main>
	<div class="controls">
		<label for="booking-date">Date</label>
		<div class="date-control">
			<span aria-hidden="true"
				>{selectedDate ? day.setLocale('en').toFormat('ccc, dd LLL yyyy') : 'Select date'}</span
			>
			<input id="booking-date" type="date" value={selectedDate} onchange={changeDate} />
		</div>
	</div>
	<section aria-label="Bookings for selected date" aria-busy={loading}>
		{#if loading}
			<p role="status">Loading bookings...</p>
		{:else if message}
			<p role="alert">{message}</p>
			<button class="retry" onclick={() => attempt++}>Retry</button>
		{:else if !bookings.length}
			<p role="status">No bookings for this date.</p>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll the table.) -->
			<div
				class="scroll"
				role="region"
				aria-label="Bookings, scroll horizontally for more columns"
				tabindex="0"
			>
				<table>
					<caption class="sr-only"
						>Bookings for {selectedDate} (Malaysia date); reservation times in your local timezone</caption
					>
					<thead
						><tr>
							<th scope="col">Customer</th>
							<th scope="col">Reservations</th><th scope="col">Status</th>
							<th scope="col" class="actions">Actions</th>
						</tr></thead
					>
					<tbody>
						{#each bookings as booking (booking.id)}
							<tr>
								<td class="customer">
									<div>{booking.customer_name}</div>
									<div>{booking.customer_phone}</div>
								</td>
								<td>
									{#each groupBookingReservations(booking.reservations) as reservation (reservation.id)}
										<div class="reservation">
											<div>
												<strong
													>{reservation.room_category_name}{reservation.room_category_acronym?.toUpperCase() ===
													'RACING'
														? ` × ${reservation.quantity}`
														: ''}</strong
												>
												· {reservation.rooms.join(', ')}
											</div>
											<div>{local(reservation.from, 'h:mma')}</div>
											<div>{formatDuration(reservation.duration)}</div>
										</div>
									{:else}No reservations{/each}
								</td>
								<td>{booking.status}</td>
								<td class="actions"
									><a
										class="view"
										href={`/bookings/${encodeURIComponent(booking.id)}`}
										aria-label={`View booking for ${booking.customer_name}`}
									>
										<Icon icon="mdi:eye" width="24" height="24" aria-hidden="true" />
									</a></td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</main>

<style>
	.admin-navigation {
		font:
			0.9375rem/1.5 'Montserrat',
			sans-serif;
	}
	main {
		min-height: 100vh;
		padding: 24px;
		background: var(--color-booking-black);
		color: var(--color-booking-white);
		font:
			14px/1.4 'Montserrat',
			sans-serif;
	}
	input,
	button {
		font-family: inherit;
	}
	input {
		color-scheme: light;
	}
	.date-control {
		position: relative;
		border: 0;
		background: var(--color-booking-primary);
		color: var(--color-booking-black);
		border-radius: 4px;
		padding: 8px 12px;
	}
	.date-control input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}
	.date-control input::-webkit-calendar-picker-indicator {
		position: absolute;
		inset: 0;
		width: auto;
		height: auto;
		cursor: pointer;
	}
	.retry {
		border-color: var(--color-booking-primary);
		cursor: pointer;
	}
	.retry:hover {
		background: color-mix(in srgb, var(--color-booking-primary) 30%, transparent);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-bottom: 20px;
	}
	input,
	.retry {
		border: 1px solid var(--color-booking-muted);
		border-radius: 4px;
		padding: 8px 12px;
		background: var(--color-booking-black);
		color: var(--color-booking-white);
	}
	p {
		margin: 10px 0;
	}
	.scroll {
		max-width: 100%;
		max-height: 75vh;
		overflow: auto;
		border: 1px solid #444;
		scrollbar-color: var(--color-booking-primary) transparent;
	}
	table {
		width: 100%;
		min-width: 800px;
		border-collapse: separate;
		border-spacing: 0;
	}
	th,
	td {
		padding: 12px 16px;
		text-align: left;
		border-bottom: 1px solid #444;
		white-space: nowrap;
	}
	thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--color-booking-container);
	}
	td {
		background: var(--color-booking-black);
	}
	.reservation + .reservation {
		margin-top: 16px;
	}
	.date-control:focus-within {
		outline: 3px solid var(--color-booking-primary);
		outline-offset: 3px;
	}
	.customer {
		white-space: normal;
		overflow-wrap: anywhere;
		max-width: 260px;
	}
	.actions {
		position: sticky;
		right: 0;
		z-index: 1;
		border-left: 1px solid #444;
	}
	thead .actions {
		z-index: 3;
	}
	.view {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
		border: 0;
		color: var(--color-booking-primary);
		text-decoration: none;
	}
	.view:hover {
		background: color-mix(in srgb, var(--color-booking-primary) 30%, transparent);
	}
	.view:focus-visible,
	button:focus-visible,
	.scroll:focus-visible {
		outline: 3px solid var(--color-booking-primary);
		outline-offset: 2px;
	}
	main {
		min-width: 0;
	}
	@media (max-width: 600px) {
		main {
			padding: 16px;
		}
	}
</style>
