<script lang="ts">
	import { publicFetch } from '$lib/auth/session';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { DateTime } from 'luxon';
	import Icon from '@iconify/svelte';
	import AdminNav from '$lib/auth/AdminNav.svelte';
	import ErrorModal from '$lib/reservation/ErrorModal.svelte';
	import Button from '@booking/ui/Button.svelte';
	import type { PageProps } from './$types';
	import {
		BOOKING_DRAFT_KEY,
		parseBookingDraft,
		bookingDraftSummary,
		type BookingDraft
	} from '$lib/reservation/booking-draft';

	let { data }: PageProps = $props();
	let draft = $state<BookingDraft | null>(null);
	let loaded = $state(false);
	let recovery = $state(
		'Your booking selection is missing or invalid. Please select your booking details again.'
	);
	let name = $state('');
	let country = $state('+60');
	let mobile = $state('');
	let submitting = $state(false);
	let submissionError = $state('');
	let canSubmit = $derived(!!draft && !!name.trim() && !!mobile.trim() && !submitting);
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		submissionError = '';
		const selection = parseBookingDraft(JSON.stringify(draft));
		if (!name.trim() || !mobile.trim() || !['+60', '+65'].includes(country)) {
			submissionError = 'Enter your name, mobile number and a supported calling code.';
			return;
		}
		if (!selection) {
			submissionError =
				'Your booking selection is invalid. Please select your booking details again.';
			return;
		}
		const start = DateTime.fromISO(`${selection.date}T${selection.time}`, {
			zone: 'Asia/Kuala_Lumpur'
		});
		if (!start.plus({ minutes: selection.duration }).isValid) {
			submissionError =
				'Your booking duration is invalid. Please select your booking details again.';
			return;
		}
		if (!data.apiUrl) {
			submissionError = 'Booking is currently unavailable. Please try again later.';
			return;
		}
		submitting = true;
		let stage = 'customer';
		try {
			const customerResponse = await publicFetch(data.apiUrl, '/v1/customers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim(), phone: country + mobile.trim() })
			});
			if (!customerResponse.ok) {
				submissionError = 'Unable to save your contact details. Please try again.';
				return;
			}
			const customer: unknown = await customerResponse.json();
			if (
				!customer ||
				typeof customer !== 'object' ||
				!('id' in customer) ||
				typeof customer.id !== 'string' ||
				!customer.id.trim()
			) {
				submissionError = 'Unable to save your contact details. Please try again.';
				return;
			}
			stage = 'booking';
			const bookingResponse = await publicFetch(data.apiUrl, '/v1/bookings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					business_id: data.businessId,
					customer_id: customer.id,
					from: start.toUTC().toISO(),
					duration: selection.duration,
					room_category_id: selection.room.id,
					...(selection.quantity === undefined ? {} : { quantity: selection.quantity })
				})
			});
			if (!bookingResponse.ok) {
				submissionError =
					bookingResponse.status === 409
						? 'The requested rooms are no longer available. Please choose another time or quantity.'
						: 'Unable to create your booking. Please try again.';
				return;
			}
			const booking: unknown = await bookingResponse.json();
			if (
				!booking ||
				typeof booking !== 'object' ||
				!('booking_id' in booking) ||
				typeof booking.booking_id !== 'string' ||
				!booking.booking_id.trim() ||
				!('payment_url' in booking) ||
				!(
					booking.payment_url === null ||
					(typeof booking.payment_url === 'string' && booking.payment_url.trim())
				)
			) {
				submissionError =
					'Your booking was created, but its confirmation could not be read. Please contact us before submitting again.';
				return;
			}
			await goto(`/bookings/${encodeURIComponent(booking.booking_id)}`);
		} catch {
			submissionError =
				stage === 'customer'
					? 'Unable to save your contact details. Please try again.'
					: 'Unable to create your booking. Please try again.';
		} finally {
			submitting = false;
		}
	}

	onMount(() => {
		try {
			draft = parseBookingDraft(localStorage.getItem(BOOKING_DRAFT_KEY));
		} catch {
			recovery =
				'Unable to read your booking selection. Please allow browser storage and select your booking details again.';
		}
		loaded = true;
	});
</script>

<svelte:head><title>Customer information</title></svelte:head>

<main class="mx-auto max-w-5xl">
	<AdminNav links={data.navigation} name={data.name} />
	{#if !loaded}
		<p class="p-5 sm:p-7" role="status">Loading booking selection…</p>
	{:else if draft}
		<div class="space-y-2 bg-booking-primary px-5 py-4 text-booking-black sm:px-7">
			{#each bookingDraftSummary(draft) as line}
				<div class="flex items-center gap-3">
					<Icon icon={line.icon} class="size-6 shrink-0" aria-hidden="true" />
					<p class="min-w-0 break-words">{line.text}</p>
				</div>
			{/each}
		</div>
		<form class="space-y-6 px-5 py-7 sm:px-7" aria-busy={submitting} onsubmit={submit}>
			<h1 class="text-[1.75rem]! text-booking-white">Contact Info</h1>
			<div>
				<label for="customer-name" class="mb-2 block text-booking-muted">Name</label>
				<input
					id="customer-name"
					name="name"
					autocomplete="name"
					required
					bind:value={name}
					disabled={submitting}
					class="w-full rounded-lg border border-booking-white bg-transparent px-3 py-3 text-booking-white focus:border-booking-primary focus:outline-none"
				/>
			</div>
			<div>
				<label for="customer-mobile" class="mb-2 block text-booking-muted">Mobile Number</label>
				<div class="flex gap-3">
					<div class="relative shrink-0">
						<select
							aria-label="Country calling code"
							name="country-code"
							autocomplete="tel-country-code"
							bind:value={country}
							disabled={submitting}
							class="h-full appearance-none rounded-lg border border-booking-white bg-booking-black py-3 pr-10 pl-3 text-booking-white focus:border-booking-primary focus:outline-none"
						>
							<option value="+60">MY (+60)</option>
							<option value="+65">SG (+65)</option>
						</select>
						<Icon
							icon="mdi:chevron-down"
							class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
							aria-hidden="true"
						/>
					</div>
					<input
						id="customer-mobile"
						name="mobile"
						type="tel"
						autocomplete="tel-national"
						required
						bind:value={mobile}
						disabled={submitting}
						class="min-w-0 flex-1 rounded-lg border border-booking-white bg-transparent px-3 py-3 text-booking-white focus:border-booking-primary focus:outline-none"
					/>
				</div>
			</div>
			<ErrorModal
				title="Unable to Submit Booking"
				description={submissionError}
				onclose={() => (submissionError = '')}
			/>
			<div class="flex justify-center">
				<Button type="submit" variant="primary" class="min-w-64 text-[16px]!" disabled={!canSubmit}
					>Submit</Button
				>
			</div>
		</form>
	{:else}
		<div class="p-5 sm:p-7">
			<p role="status">{recovery}</p>
			<a
				href="/bookings/new"
				class="mt-4 inline-block text-booking-primary underline focus-visible:outline-2 focus-visible:outline-booking-primary"
				>Select booking details</a
			>
		</div>
	{/if}
</main>
