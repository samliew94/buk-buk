<script lang="ts">
	import { staffFetch, requestMessage } from '$lib/auth/staff';
	import { onMount } from 'svelte';
	import { DateTime } from 'luxon';
	import DatePicker from '$lib/admin/DatePicker.svelte';
	import AdminNav from '$lib/auth/AdminNav.svelte';
	import { layoutDay, type DayBookings } from '$lib/admin/booking-grid';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let result = $state<DayBookings>({ rooms: [], bookings: [] });
	let loading = $state(true);
	let message = $state('');
	let attempt = $state(0);
	let now = $state(Date.now());
	let selectedDate = $state('');
	onMount(() => {
		selectedDate = DateTime.now().setZone('Asia/Kuala_Lumpur').toISODate()!;
	});
	let day = $derived(DateTime.fromISO(selectedDate || '1970-01-01', { zone: 'Asia/Kuala_Lumpur' }));
	let grid = $derived(layoutDay(result, day.toMillis(), now));
	let gridStart = $derived(DateTime.fromMillis(grid.start, { zone: 'Asia/Kuala_Lumpur' }));
	function local(value: string) {
		return DateTime.fromISO(value)
			.setZone('Asia/Kuala_Lumpur')
			.setLocale('en')
			.toFormat('dd LLL yyyy HH:mm');
	}
	$effect(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(timer);
	});
	$effect(() => {
		const { apiUrl, businessId } = data;
		const date = selectedDate;
		if (!date) return;
		void attempt;
		const controller = new AbortController();
		loading = true;
		message = '';
		result = { rooms: [], bookings: [] };
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
				const value: DayBookings = await response.json();
				if (!controller.signal.aborted) result = value;
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
	<title>Admin calendar</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="admin-navigation">
	<AdminNav links={data.navigation} name={data.name} />
</div>
<main>
	<div class="controls">
		<label for="booking-date">Date</label>
		<DatePicker id="booking-date" value={selectedDate} onCommit={(date) => (selectedDate = date)} />
	</div>
	<section aria-label="Calendar for selected date" aria-busy={loading}>
		{#if loading}
			<p role="status">Loading bookings...</p>
		{:else if message}
			<p role="alert">{message}</p>
			<button class="retry" onclick={() => attempt++}>Retry</button>
		{:else if !result.rooms.length}
			<p role="status">No rooms are configured for this business.</p>
		{:else}
			{#if !grid.rows.some((row) => row.reservations.length)}<p role="status">
					No bookings for this date.
				</p>{/if}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll the grid.) -->
			<div
				class="scroll"
				role="region"
				aria-label="Room booking grid, scroll horizontally for more hours"
				tabindex="0"
			>
				<table style={`width: ${180 + grid.hours * 120}px`}>
					<caption class="sr-only">Room bookings for {selectedDate}, Malaysia time</caption>
					<thead
						><tr>
							<th class="room-label corner" scope="col">Room</th>
							{#each Array.from({ length: grid.hours }, (_, i) => i) as hour}
								<th class="hour" scope="col">
									{gridStart.plus({ hours: hour }).toFormat('HH:mm')}
								</th>
							{/each}
						</tr></thead
					>
					<tbody>
						{#each grid.rows as row (row.room.id)}
							<tr>
								<th class="room-label" scope="row"
									>{row.room.name}<span class="category">{row.room.room_category_name}</span></th
								>
								<td colspan={grid.hours}>
									<div class="timeline" style={`height: ${row.lanes * 54 + 12}px`}>
										{#each row.reservations as block (block.reservation.id)}
											{@const status = block.booking.status}
											{@const details = `Customer ${block.booking.customer_name}. Phone ${block.booking.customer_phone}. Booking ${block.booking.id}. ${status}. ${block.reservation.room_category_name}, room ${block.reservation.room_name}. Start ${local(block.reservation.from)}. End ${local(block.reservation.to)} MYT. Duration ${block.reservation.duration} minutes.`}
											<button
												class="block"
												class:confirmed={status === 'confirmed'}
												class:pending={status === 'pending'}
												class:cancelled={status === 'cancelled'}
												style={`left: ${block.left}px; width: ${block.width}px; top: ${block.lane * 54 + 6}px`}
												aria-label={details}
												title={details}
												popovertarget={`details-${block.reservation.id}`}
											>
												<span class="customer-line">{block.booking.customer_name}</span>
												<span class="customer-line">{block.booking.customer_phone}</span>
											</button>
											<div id={`details-${block.reservation.id}`} popover class="details">
												<p>{details}</p>
												{#if Date.parse(block.reservation.from) < day.toMillis()}<p>
														Continues from the previous day.
													</p>{/if}
												<button
													popovertarget={`details-${block.reservation.id}`}
													popovertargetaction="hide">Close</button
												>
											</div>
										{/each}
									</div>
								</td>
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
	button {
		font-family: inherit;
	}
	.retry,
	.details button {
		border-color: var(--color-booking-primary);
		cursor: pointer;
	}
	.retry:hover,
	.details button:hover {
		background: color-mix(in srgb, var(--color-booking-primary) 30%, transparent);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-bottom: 20px;
	}
	.category {
		color: var(--color-booking-muted);
	}
	.retry,
	.details button {
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
		border-collapse: separate;
		border-spacing: 0;
		table-layout: fixed;
	}
	th,
	td {
		padding: 0;
		border-right: 1px solid #444;
		border-bottom: 1px solid #444;
		text-align: left;
	}
	thead th {
		position: sticky;
		top: 0;
		z-index: 3;
		height: 64px;
		background: var(--color-booking-container);
	}
	.hour {
		width: 120px;
		padding: 8px;
		vertical-align: bottom;
		font-weight: 500;
	}
	.room-label {
		position: sticky;
		left: 0;
		width: 180px;
		min-width: 180px;
		max-width: 180px;
		padding: 12px;
		z-index: 2;
		background: var(--color-booking-black);
		overflow-wrap: anywhere;
	}
	.corner {
		z-index: 4;
		background: var(--color-booking-container);
	}
	.category {
		display: block;
		font-weight: 400;
		font-size: 12px;
	}
	.timeline {
		position: relative;
		background: repeating-linear-gradient(
			to right,
			transparent 0,
			transparent 119px,
			#444 119px,
			#444 120px
		);
	}
	.block {
		position: absolute;
		height: 44px;
		border: 1px solid var(--color-booking-muted);
		border-radius: 3px;
		padding: 3px;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		text-align: left;
		font-size: 11px;
		color: var(--color-booking-white);
		background: var(--color-booking-container);
		cursor: pointer;
	}
	.customer-line {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.confirmed {
		background: var(--color-booking-primary);
		border-color: var(--color-booking-primary);
		color: var(--color-booking-black);
	}
	.pending {
		background: color-mix(in srgb, var(--color-booking-warning) 18%, var(--color-booking-black));
		border-color: var(--color-booking-warning);
	}
	.cancelled {
		background: color-mix(in srgb, var(--color-booking-danger) 18%, var(--color-booking-black));
		border-color: var(--color-booking-danger);
	}
	.block:focus-visible,
	button:focus-visible,
	.scroll:focus-visible {
		outline: 3px solid var(--color-booking-primary);
		outline-offset: 2px;
	}
	.details {
		margin: auto;
		max-width: min(440px, calc(100vw - 32px));
		padding: 20px;
		border: 1px solid var(--color-booking-muted);
		border-radius: 8px;
		background: var(--color-booking-black);
		color: var(--color-booking-white);
		overflow-wrap: anywhere;
	}
	.details::backdrop {
		background: #ffffff33;
	}
	@media (max-width: 600px) {
		main {
			padding: 16px;
		}
	}
</style>
