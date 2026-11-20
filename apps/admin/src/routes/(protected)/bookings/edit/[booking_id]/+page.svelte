<script lang="ts">
	import { publicFetch } from '$lib/auth/session';
	import { staffFetch, requestMessage } from '$lib/auth/staff';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { DateTime } from 'luxon';
	import Button from '@booking/ui/Button.svelte';
	import AdminNav from '$lib/auth/AdminNav.svelte';
	import TimeButton from '$lib/reservation/TimeButton.svelte';
	import {
		blankDraft,
		physicalRows,
		roomOptions,
		firstAvailable,
		firstAvailableCategory,
		options,
		overlaps,
		payload,
		days,
		zone,
		type Draft,
		type Room,
		type Busy
	} from '$lib/reservation/reservation-editor';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let rows = $state<Draft[]>([]),
		rooms = $state<Room[]>([]);
	let categories = $state<{ id: string; name: string; acronym?: string | null }[]>([]);
	let hours = $state<{ open_at: string | null; close_at: string | null }>({
		open_at: null,
		close_at: null
	});
	let cache = $state<Record<string, Busy[]>>({}),
		errors = $state<Record<string, string>>({});
	let loading = $state(true),
		saving = $state(false),
		message = $state(''),
		ready = $state(false),
		now = $state(Date.now());
	let alive = true;
	const requests = new Map<string, Promise<Busy[]>>();
	const controller = new AbortController();
	let back = $derived(`/bookings/${encodeURIComponent(data.bookingId)}`);
	async function request<T>(
		path: string,
		body?: object,
		method = body ? 'QUERY' : 'GET'
	): Promise<T> {
		if (!data.apiUrl) throw Error('Missing API configuration');
		const response = await (method === 'PUT' ? staffFetch : publicFetch)(data.apiUrl, path, {
			method,
			headers: body ? { 'Content-Type': 'application/json' } : undefined,
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])
		});
		if (!response.ok) throw Error(`Request failed (${response.status}).`);
		return response.json();
	}
	function defaultCategory(date: string, result: Busy[]) {
		for (const row of rows.filter((r) => r.date === date && !r.category)) {
			Object.assign(
				row,
				firstAvailableCategory(
					row,
					categories,
					rooms,
					hours.open_at,
					hours.close_at,
					result,
					data.bookingId,
					rows.filter((r) => r !== row),
					Date.now()
				)
			);
		}
	}
	async function availability(date: string, fresh = false): Promise<Busy[]> {
		if (requests.has(date)) return requests.get(date)!;
		if (!fresh && cache[date]) {
			defaultCategory(date, cache[date]);
			return cache[date];
		}
		const pending = request<Busy[]>('/v1/reservations', {
			business_id: data.businessId,
			date: DateTime.fromISO(date, { zone }).startOf('day').toUTC().toISO()
		})
			.then((result) => {
				if (alive) {
					cache[date] = result;
					delete errors[date];
					defaultCategory(date, result);
				}
				return result;
			})
			.catch((error) => {
				if (alive) {
					delete cache[date];
					errors[date] = 'Availability could not be loaded. Retry this date.';
				}
				throw error;
			})
			.finally(() => requests.delete(date));
		requests.set(date, pending);
		return pending;
	}
	async function load() {
		loading = true;
		ready = false;
		message = '';
		try {
			const [c, r, h] = await Promise.all([
				request<typeof categories>('/v1/room-categories', { business_id: data.businessId }),
				request<Room[]>('/v1/rooms', { business_id: data.businessId }),
				request<typeof hours>(`/v1/businesses/${encodeURIComponent(data.businessId)}`)
			]);
			if (!alive) return;
			categories = c;
			rooms = r;
			hours = h;
			if (!rows.length) rows = [blankDraft()];
			ready = true;
			await Promise.allSettled(
				[...new Set(rows.map((r) => r.date))].map((date) => availability(date))
			);
		} catch {
			if (alive) message = 'Unable to load the booking editor. Please retry.';
		} finally {
			if (alive) loading = false;
		}
	}
	onMount(() => {
		void load();
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => {
			alive = false;
			controller.abort();
			clearInterval(timer);
		};
	});
	function slots(row: Draft) {
		return options(row, hours.open_at, hours.close_at, cache[row.date] ?? [], data.bookingId, now);
	}
	function racing(row: Draft) {
		return categories.find((c) => c.id === row.category)?.acronym?.toUpperCase() === 'RACING';
	}
	function valid(row: Draft) {
		const selected = physicalRows(row);
		return (
			selected.length > 0 &&
			!!cache[row.date] &&
			!errors[row.date] &&
			selected.every(
				(r) =>
					rooms.some((room) => room.id === r.room && room.room_category_id === r.category) &&
					!!roomOptions(r, hours.open_at, hours.close_at, cache[r.date], data.bookingId, now)
						.find((s) => s.time === r.time)
						?.durations.includes(r.duration)
			)
		);
	}
	function reconcile(row: Draft) {
		const slot = slots(row).find((s) => s.time === row.time);
		if (!slot) {
			row.time = '';
			row.duration = 0;
		} else if (!slot.durations.includes(row.duration)) row.duration = 0;
	}
	const selectionVersions = new WeakMap<Draft, number>();
	function selectRoom(row: Draft, room: string) {
		selectionVersions.set(row, (selectionVersions.get(row) ?? 0) + 1);
		if (!racing(row)) {
			change(row, 'room', room);
			return;
		}
		const selected = row.selectedRooms ?? (row.room ? [row.room] : []);
		row.selectedRooms = selected.includes(room)
			? selected.filter((id) => id !== room)
			: [...selected, room];
		row.room = row.selectedRooms[0] ?? '';
		reconcile(row);
		message = '';
	}
	async function chooseCategory(row: Draft, version: number) {
		const date = row.date;
		try {
			const busy = await availability(date);
			if (!alive || selectionVersions.get(row) !== version || row.date !== date) return;
			Object.assign(
				row,
				firstAvailable(
					row,
					rooms,
					hours.open_at,
					hours.close_at,
					busy,
					data.bookingId,
					rows.filter((r) => r !== row),
					Date.now()
				)
			);
			if (!row.room)
				message = 'No rooms or times are available for this category on the selected date.';
		} catch {
			/* The date-specific error provides a retry action. */
		}
	}
	function change(row: Draft, field: 'date' | 'category' | 'room' | 'time', value: string) {
		const version = (selectionVersions.get(row) ?? 0) + 1;
		selectionVersions.set(row, version);
		row[field] = value;
		message = '';
		if (field === 'category') {
			row.room = '';
			row.selectedRooms = [];
			row.time = '';
			void chooseCategory(row, version);
			return;
		}
		if (field === 'room') row.selectedRooms = value ? [value] : [];
		reconcile(row);
		if (field === 'date') void availability(value).catch(() => {});
	}
	let conflict = $derived(overlaps(rows));
	let hoursAvailable = $derived(
		!!hours.open_at &&
			!!hours.close_at &&
			/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hours.open_at) &&
			/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hours.close_at)
	);
	let canSave = $derived(
		ready &&
			!loading &&
			!saving &&
			hoursAvailable &&
			rows.length > 0 &&
			rows.every(valid) &&
			!conflict
	);
	async function save() {
		if (!canSave) return;
		saving = true;
		message = '';
		try {
			await Promise.all(
				[...new Set(rows.map((r) => r.date))].map((date) => availability(date, true))
			);
			if (!rows.every(valid) || overlaps(rows)) {
				message = 'A selected room or interval is no longer available. Review your reservations.';
				return;
			}
			await request(`/v1/bookings/${encodeURIComponent(data.bookingId)}`, payload(rows), 'PUT');
			await goto(back, { invalidateAll: true });
		} catch (error) {
			if (alive)
				message = requestMessage(
					error,
					'Changes could not be saved. Your edits are retained; check availability and try again.'
				);
		} finally {
			if (alive) saving = false;
		}
	}
</script>

<svelte:head><title>Edit reservations</title><meta name="robots" content="noindex" /></svelte:head>
<main class="mx-auto max-w-5xl pb-8">
	<AdminNav links={data.navigation} name={data.name} />
	<section class="mt-5 rounded-2xl bg-booking-container p-5 sm:p-7" aria-busy={loading || saving}>
		<h1 class="text-xl! font-bold">Edit Reservations</h1>
		{#if message}<p role="alert" class="my-4 text-booking-warning">{message}</p>{/if}
		{#if loading}<p role="status">Loading editor…</p>
		{:else if !ready}<Button onclick={load}>Retry</Button>
		{:else}
			{#if !hoursAvailable}<p role="alert">Opening hours are unavailable. Saving is disabled.</p>
				<Button onclick={load}>Retry configuration</Button>{/if}
			{#each rows as row, index (index)}
				{@const times = slots(row)}
				{@const dates = days(now)}
				{@const durations = times.find((t) => t.time === row.time)?.durations ?? []}
				<fieldset disabled={saving} aria-label={`Reservation ${index + 1}`} class="my-6 min-w-0">
					<p class="label">Select Date</p>
					<div class="flex gap-3 overflow-x-auto py-3">
						{#each dates as date}
							{@const d = DateTime.fromISO(date, { zone }).setLocale('en')}
							<Button
								variant={row.date === date ? 'primary' : 'secondary'}
								class="w-14 max-w-14 shrink-0 flex-col gap-0.5! p-1!"
								aria-label={d.toFormat('cccc d LLLL yyyy')}
								aria-pressed={row.date === date}
								onclick={() => change(row, 'date', date)}
							>
								<span class="font-poppins text-[14px] text-booking-muted">{d.toFormat('ccc')}</span
								><span class="font-poppins text-[18px] font-bold">{d.toFormat('dd')}</span><span
									class={[
										'font-poppins text-[12px] font-normal',
										row.date === date ? 'text-booking-black' : 'text-booking-primary'
									]}>{d.toFormat('LLL')}</span
								>
							</Button>{/each}
					</div>
					<p class="label">Select Room Category</p>
					<div class="choices">
						{#each categories as category}<Button
								variant={row.category === category.id ? 'primary' : 'secondary'}
								aria-pressed={row.category === category.id}
								onclick={() => change(row, 'category', category.id)}>{category.name}</Button
							>{/each}
					</div>
					<p class="label">Select Room</p>
					<div class="choices">
						{#each rooms.filter((r) => r.room_category_id === row.category) as room}<Button
								variant={physicalRows(row).some((r) => r.room === room.id)
									? 'primary'
									: 'secondary'}
								aria-pressed={physicalRows(row).some((r) => r.room === room.id)}
								onclick={() => selectRoom(row, room.id)}>{room.name}</Button
							>{/each}
					</div>
					<p class="label">Select Time</p>
					{#if errors[row.date]}<p role="alert">{errors[row.date]}</p>
						<Button onclick={() => availability(row.date, true).catch(() => {})}
							>Retry availability</Button
						>
					{:else if !cache[row.date]}<p role="status">Loading availability…</p>{/if}
					<div class="my-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
						{#each times.map((slot) => slot.time) as time}
							<TimeButton
								{time}
								selected={row.time === time}
								onclick={() => change(row, 'time', time)}
							/>{/each}
					</div>
					<p class="label">Select Duration</p>
					<div class="choices" role="group" aria-label={`Reservation ${index + 1} duration`}>
						<Button
							variant="secondary"
							icon="mdi:minus"
							aria-label="Decrease duration"
							disabled={!durations.some((d) => d < row.duration)}
							onclick={() => (row.duration = durations.filter((d) => d < row.duration).at(-1)!)}
						/>
						<span class="min-w-20 text-center font-bold text-booking-primary" aria-live="polite"
							>{row.duration
								? `${row.duration / 60} ${row.duration === 60 ? 'hour' : 'hours'}`
								: 'Select duration'}</span
						>
						<Button
							variant="secondary"
							icon="mdi:plus"
							aria-label="Increase duration"
							disabled={!durations.some((d) => d > row.duration)}
							onclick={() => (row.duration = durations.find((d) => d > row.duration)!)}
						/>
					</div>
				</fieldset>
			{/each}
			{#if conflict}<p role="alert" class="my-4 text-booking-warning">
					Reservations in this draft overlap in the same room. Choose separate intervals or rooms.
				</p>{/if}
		{/if}
	</section>
	<div class="h-44 sm:h-28" aria-hidden="true"></div>
</main>

<div
	class="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-5xl flex-col-reverse items-center gap-3 rounded-t-2xl bg-booking-container pt-5 sm:flex-row sm:justify-end sm:rounded-none sm:bg-transparent sm:pt-0"
	style="padding-bottom: max(1.25rem, env(safe-area-inset-bottom));"
>
	<a
		class="pointer-events-auto rounded-lg px-5 py-3 font-bold text-booking-white focus-visible:outline-2 focus-visible:outline-booking-primary"
		href={back}>Cancel</a
	>
	<Button
		variant="primary"
		class="pointer-events-auto min-w-64 text-[16px]!"
		disabled={!canSave}
		onclick={save}>{saving ? 'Saving…' : 'Confirm'}</Button
	>
</div>

<style>
	.label {
		font-size: 14px;
		font-weight: 600;
		margin-top: 1rem;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin: 1rem 0;
	}
</style>
