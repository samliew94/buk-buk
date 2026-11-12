<script lang="ts">
	import { goto } from '$app/navigation';
	import { retainDuration } from '$lib/customer/availability';
	import Button from '$lib/customer/Button.svelte';
	import TimeButton from '$lib/customer/TimeButton.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let selection = $state<{ time: string; roomCategoryId: string }>();
	let duration = $state(60);
	let adjustment = $state('');
	let expandedKey = $state<string>();
	let categories = $derived(
		data.slots
			.filter(
				(slot, index, slots) =>
					slots.findIndex((other) => other.category.id === slot.category.id) === index
			)
			.map((slot) => slot.category)
	);
	let category = $derived(
		categories.find((item) => item.id === selection?.roomCategoryId) ?? categories[0]
	);
	let timeSlots = $derived(data.slots.filter((slot) => slot.category.id === category?.id));
	let active = $derived(timeSlots.find((slot) => slot.time === selection?.time) ?? timeSlots[0]);
	let viewKey = $derived(`${data.date}/${category?.id}`);
	let expanded = $derived(expandedKey === viewKey);
	$effect(() => {
		viewKey;
		expandedKey = undefined;
	});
	$effect(() => {
		const next = retainDuration(duration, active);
		const changed =
			selection &&
			active &&
			(selection.roomCategoryId !== active.category.id || selection.time !== active.time);
		if (next !== duration || changed) {
			adjustment =
				next !== duration
					? 'Selection updated. Duration adjusted to 1 hour for this selection.'
					: 'Selection adjusted to the first available room or time.';
		}
		duration = next;
		if (active && (!selection || changed)) {
			selection = { time: active.time, roomCategoryId: active.category.id };
		}
	});
	function durationLabel(minutes: number) {
		return `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}`;
	}
</script>

<svelte:head>
	<title>New booking{data.name ? ` · ${data.name}` : ''}</title>
</svelte:head>

<main class="mx-auto max-w-5xl">
	<nav
		class="flex h-12 items-center justify-between gap-3 bg-booking-container px-5 sm:px-7"
		aria-label="Main navigation"
	>
		<span class="font-semibold text-booking-white">{data.name ?? ''}</span>
		<Button variant="ghost" icon="mdi:menu" aria-label="Open menu" class="min-h-8! px-2!" />
	</nav>
	<section class="mt-8 overflow-hidden rounded-2xl bg-booking-container shadow-sm">
		<div class="px-5 pt-5 sm:px-7 sm:pt-7">
			<p class="text-[14px]! font-semibold text-booking-white">Select Date</p>
		</div>
		<form
			method="GET"
			class="date-button-row flex gap-3 overflow-x-auto p-5 sm:p-7"
			aria-label="Select booking date"
		>
			{#each data.days as day (day.date)}
				<Button
					type="submit"
					name="date"
					value={day.date}
					onclick={(event) => {
						event.preventDefault();
						goto(`?date=${day.date}`, { keepFocus: true, noScroll: true });
					}}
					variant={data.date === day.date ? 'primary' : 'secondary'}
					aria-label={day.label}
					aria-pressed={data.date === day.date}
					class={[
						'w-14 max-w-14 shrink-0 flex-col gap-0.5! border p-1! hover:opacity-100!',
						data.date === day.date
							? 'border-booking-primary'
							: 'border-booking-white! hover:bg-booking-primary/30!'
					]}
				>
					<span class="font-poppins text-[14px] font-normal text-booking-muted">{day.weekday}</span>
					<span
						class={[
							'font-poppins text-[18px] font-bold',
							data.date === day.date ? 'text-booking-black' : 'text-booking-white'
						]}>{day.day}</span
					>
					<span
						class={[
							'font-poppins text-[12px] font-normal',
							data.date === day.date ? 'text-booking-black' : 'text-booking-primary'
						]}>{day.month}</span
					>
				</Button>
			{/each}
		</form>

		{#if data.message}
			<p class="p-5 text-booking-warning sm:p-7" role="status">{data.message}</p>
		{:else if active}
			<div>
				<div class="p-5 sm:p-7">
					<p class="text-[14px]! font-semibold text-booking-white">Select Room</p>
					<div
						class="date-button-row mt-4 flex gap-2 overflow-x-auto pb-2"
						aria-label="Room categories"
					>
						{#each categories as item (item.id)}
							<Button
								variant={category?.id === item.id ? 'primary' : 'secondary'}
								class={[
									'h-12 w-30 shrink-0 text-center leading-tight whitespace-normal hover:opacity-100!',
									category?.id === item.id
										? 'border-booking-primary'
										: 'border-booking-white! hover:bg-booking-primary/30!'
								]}
								aria-pressed={category?.id === item.id}
								onclick={() => {
									selection = { roomCategoryId: item.id, time: active.time };
									adjustment = '';
								}}>{item.name}</Button
							>
						{/each}
					</div>
				</div>
				<div class="p-5 sm:p-7">
					<p class="text-[14px]! font-semibold text-booking-white">Select Time</p>
					<div class="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Start times">
						{#each timeSlots as slot, index (`${slot.time}-${slot.category.id}`)}
							{@const category = slot.category}
							<TimeButton
								time={slot.time}
								aria-label={`${slot.time}, ${category.name}`}
								selected={active.time === slot.time && active.category.id === category.id}
								class={!expanded && timeSlots.length > 8 && index >= 7
									? 'hidden! sm:inline-flex!'
									: ''}
								onclick={() => (selection = { time: slot.time, roomCategoryId: category.id })}
							/>
						{/each}
						{#if !expanded && timeSlots.length > 8}
							<Button
								variant="secondary"
								class="border-[0.5px]! border-booking-primary/30! font-poppins! text-[16px]! font-normal! text-booking-primary! sm:hidden!"
								aria-expanded={false}
								onclick={() => (expandedKey = viewKey)}>More</Button
							>
						{/if}
					</div>
				</div>

				<div class="p-5 sm:p-7">
					<p class="text-[14px]! font-semibold text-booking-white">Select Duration</p>
					<div class="mt-4 flex items-center gap-4" role="group" aria-label="Booking duration">
						<Button
							variant="secondary"
							icon="mdi:minus"
							class="border-booking-white! hover:border-transparent! hover:bg-booking-primary! hover:text-booking-black! hover:opacity-100!"
							aria-label="Decrease duration by 1 hour"
							disabled={duration <= 60}
							onclick={() => {
								duration -= 60;
								adjustment = '';
							}}
						/>
						<span class="min-w-20 text-center font-bold text-booking-primary" aria-live="polite"
							>{durationLabel(duration)}</span
						>
						<Button
							variant="secondary"
							icon="mdi:plus"
							class="border-booking-white! hover:border-transparent! hover:bg-booking-primary! hover:text-booking-black! hover:opacity-100!"
							aria-label="Increase duration by 1 hour"
							disabled={!active.durations.includes(duration + 60)}
							onclick={() => {
								duration += 60;
								adjustment = '';
							}}
						/>
					</div>
					<p class="mt-2 text-booking-muted" role="status">{adjustment}</p>
				</div>
			</div>
		{:else}
			<p class="p-5 text-booking-muted sm:p-7" role="status">
				No one-hour bookings are available on this date. Please choose another date.
			</p>
		{/if}
	</section>
	<div class="h-28" aria-hidden="true"></div>
</main>

<div
	class="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-5xl justify-center rounded-t-2xl bg-booking-container pt-5 sm:justify-end sm:rounded-none sm:bg-transparent sm:pt-0"
	style="padding-bottom: max(1.25rem, env(safe-area-inset-bottom));"
>
	<Button variant="primary" class="pointer-events-auto min-w-64 text-[16px]!">Confirm</Button>
</div>
