<script module lang="ts">
	import { DateTime } from 'luxon';

	export type CalendarDateRange = { from: string; to: string };

	export function formatCalendarDateRange({ from, to }: CalendarDateRange) {
		const format = (date: string) =>
			DateTime.fromISO(date, { zone: 'UTC', locale: 'en' }).toFormat('ccc, dd LLL yyyy');
		return `${format(from)} - ${format(to)}`;
	}
</script>

<script lang="ts">
	import { parseDate, type DateValue } from '@internationalized/date';
	import { Popover, RangeCalendar, type DateRange } from 'bits-ui';

	let {
		id,
		value,
		onCommit
	}: {
		id: string;
		value: CalendarDateRange;
		onCommit: (value: CalendarDateRange) => void;
	} = $props();

	let open = $state(false);
	let selection = $state<DateRange>({ start: undefined, end: undefined });
	let panel = $state<HTMLElement | null>(null);

	function openChanged(next: boolean) {
		if (next) {
			selection = { start: parseDate(value.from), end: parseDate(value.to) };
		}
	}

	function isValidRange(first: DateValue, second: DateValue) {
		const [start, end] = first.compare(second) <= 0 ? [first, second] : [second, first];
		return end.compare(start.add({ years: 1 })) < 0;
	}

	function isDateDisabled(date: DateValue) {
		const { start, end } = selection;
		return !!start && !end && !isValidRange(start, date);
	}

	function selectionChanged({ start, end }: DateRange) {
		if (!start || !end || !isValidRange(start, end)) return;
		onCommit({ from: start.toString(), to: end.toString() });
		open = false;
	}

	function focusDay(event: Event) {
		const day = panel?.querySelector<HTMLElement>('[data-range-calendar-day][tabindex="0"]');
		if (!day) return;
		event.preventDefault();
		day.focus();
	}
</script>

<Popover.Root bind:open onOpenChange={openChanged}>
	<Popover.Trigger {id} class="booking-date-trigger">
		{formatCalendarDateRange(value)}
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			bind:ref={panel}
			class="booking-date-popover"
			aria-label="Select booking date range"
			align="start"
			sideOffset={8}
			collisionPadding={8}
			onOpenAutoFocus={focusDay}
		>
			<RangeCalendar.Root
				bind:value={selection}
				onValueChange={selectionChanged}
				{isDateDisabled}
				calendarLabel="Booking dates"
				locale="en-GB"
				weekdayFormat="short"
				preventDeselect
			>
				{#snippet children({ months, weekdays })}
					<RangeCalendar.Header class="booking-date-header">
						<RangeCalendar.PrevButton class="booking-date-arrow">
							<span aria-hidden="true">‹</span>
						</RangeCalendar.PrevButton>
						<RangeCalendar.Heading />
						<RangeCalendar.NextButton class="booking-date-arrow">
							<span aria-hidden="true">›</span>
						</RangeCalendar.NextButton>
					</RangeCalendar.Header>
					{#each months as month (month.value.toString())}
						<RangeCalendar.Grid class="booking-date-grid">
							<RangeCalendar.GridHead>
								<RangeCalendar.GridRow>
									{#each weekdays as weekday, index (index)}
										<RangeCalendar.HeadCell>{weekday}</RangeCalendar.HeadCell>
									{/each}
								</RangeCalendar.GridRow>
							</RangeCalendar.GridHead>
							<RangeCalendar.GridBody>
								{#each month.weeks as week (week[0].toString())}
									<RangeCalendar.GridRow>
										{#each week as date (date.toString())}
											<RangeCalendar.Cell {date} month={month.value}>
												<RangeCalendar.Day class="booking-date-day">
													{date.day}
												</RangeCalendar.Day>
											</RangeCalendar.Cell>
										{/each}
									</RangeCalendar.GridRow>
								{/each}
							</RangeCalendar.GridBody>
						</RangeCalendar.Grid>
					{/each}
				{/snippet}
			</RangeCalendar.Root>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
	:global(.booking-date-trigger) {
		max-width: 100%;
		padding: 8px 12px;
		border: 0;
		border-radius: 4px;
		background: var(--color-booking-primary);
		color: var(--color-booking-black);
		cursor: pointer;
	}

	:global(.booking-date-popover) {
		z-index: 20;
		box-sizing: border-box;
		width: min(328px, calc(100dvw - 16px));
		max-height: var(--bits-popover-content-available-height);
		overflow: auto;
		padding: 12px;
		border: 1px solid var(--color-booking-muted);
		border-radius: 8px;
		background: var(--color-booking-container);
		color: var(--color-booking-white);
		font: 14px/1.4 'Montserrat', sans-serif;
	}

	:global(.booking-date-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
		font-weight: 600;
	}

	:global(.booking-date-arrow) {
		width: 36px;
		height: 36px;
		border-radius: 4px;
		font-size: 24px;
		cursor: pointer;
	}

	:global(.booking-date-grid) {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		text-align: center;
	}

	:global(.booking-date-grid th) {
		padding-bottom: 4px;
		color: var(--color-booking-muted);
		font-weight: 400;
	}

	:global(.booking-date-day) {
		display: grid;
		min-height: 36px;
		border-radius: 4px;
		place-items: center;
		cursor: pointer;
	}

	:global(.booking-date-arrow:hover),
	:global(.booking-date-day:not([data-disabled]):hover),
	:global(.booking-date-day[data-highlighted]) {
		background: color-mix(in srgb, var(--color-booking-primary) 24%, transparent);
	}

	:global(.booking-date-day[data-selected]:not([data-outside-month])) {
		background: var(--color-booking-primary);
		color: var(--color-booking-black);
	}

	:global(.booking-date-day[data-disabled]),
	:global(.booking-date-arrow:disabled) {
		opacity: 0.45;
		cursor: default;
	}

	:global(.booking-date-trigger:focus-visible),
	:global(.booking-date-arrow:focus-visible),
	:global(.booking-date-day:focus-visible) {
		outline: 2px solid var(--color-booking-primary);
		outline-offset: 2px;
	}
</style>
