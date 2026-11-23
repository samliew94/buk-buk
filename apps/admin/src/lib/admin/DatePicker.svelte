<script lang="ts">
	import { parseDate, type DateValue } from '@internationalized/date';
	import { Calendar, Popover } from 'bits-ui';
	import { DateTime } from 'luxon';

	let {
		id,
		value,
		onCommit,
		calendarLabel = 'Select date'
	}: {
		id: string;
		value: string;
		onCommit: (value: string) => void;
		calendarLabel?: string;
	} = $props();

	let open = $state(false);
	let selection = $derived(value ? parseDate(value) : undefined);
	let panel = $state<HTMLElement | null>(null);

	function selectionChanged(date: DateValue | undefined) {
		if (!date) return;
		onCommit(date.toString());
		open = false;
	}

	function focusDay(event: Event) {
		const day = panel?.querySelector<HTMLElement>('[data-calendar-day][tabindex="0"]');
		if (!day) return;
		event.preventDefault();
		day.focus();
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger {id} class="booking-single-date-trigger">
		{value
			? DateTime.fromISO(value, { zone: 'UTC', locale: 'en' }).toFormat('ccc, dd LLL yyyy')
			: 'Select date'}
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			bind:ref={panel}
			class="booking-single-date-popover"
			aria-label={calendarLabel}
			align="start"
			sideOffset={8}
			collisionPadding={8}
			onOpenAutoFocus={focusDay}
		>
			<Calendar.Root
				type="single"
				value={selection}
				onValueChange={selectionChanged}
				{calendarLabel}
				locale="en-GB"
				weekdayFormat="short"
				preventDeselect
			>
				{#snippet children({ months, weekdays })}
					<Calendar.Header class="booking-single-date-header">
						<Calendar.PrevButton class="booking-single-date-arrow">
							<span aria-hidden="true">‹</span>
						</Calendar.PrevButton>
						<Calendar.Heading />
						<Calendar.NextButton class="booking-single-date-arrow">
							<span aria-hidden="true">›</span>
						</Calendar.NextButton>
					</Calendar.Header>
					{#each months as month (month.value.toString())}
						<Calendar.Grid class="booking-single-date-grid">
							<Calendar.GridHead>
								<Calendar.GridRow>
									{#each weekdays as weekday, index (index)}
										<Calendar.HeadCell>{weekday}</Calendar.HeadCell>
									{/each}
								</Calendar.GridRow>
							</Calendar.GridHead>
							<Calendar.GridBody>
								{#each month.weeks as week (week[0].toString())}
									<Calendar.GridRow>
										{#each week as date (date.toString())}
											<Calendar.Cell {date} month={month.value}>
												<Calendar.Day class="booking-single-date-day">
													{date.day}
												</Calendar.Day>
											</Calendar.Cell>
										{/each}
									</Calendar.GridRow>
								{/each}
							</Calendar.GridBody>
						</Calendar.Grid>
					{/each}
				{/snippet}
			</Calendar.Root>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
	:global(.booking-single-date-trigger) {
		max-width: 100%;
		padding: 8px 12px;
		border: 0;
		border-radius: 4px;
		background: var(--color-booking-primary);
		color: var(--color-booking-black);
		cursor: pointer;
	}

	:global(.booking-single-date-popover) {
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
		font:
			14px/1.4 'Montserrat',
			sans-serif;
	}

	:global(.booking-single-date-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
		font-weight: 600;
	}

	:global(.booking-single-date-arrow) {
		width: 36px;
		height: 36px;
		border-radius: 4px;
		font-size: 24px;
		cursor: pointer;
	}

	:global(.booking-single-date-grid) {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		text-align: center;
	}

	:global(.booking-single-date-grid th) {
		padding-bottom: 4px;
		color: var(--color-booking-muted);
		font-weight: 400;
	}

	:global(.booking-single-date-day) {
		display: grid;
		min-height: 36px;
		border-radius: 4px;
		place-items: center;
		cursor: pointer;
	}

	:global(.booking-single-date-arrow:hover),
	:global(.booking-single-date-day:not([data-disabled]):hover),
	:global(.booking-single-date-day[data-highlighted]) {
		background: color-mix(in srgb, var(--color-booking-primary) 24%, transparent);
	}

	:global(.booking-single-date-day[data-selected]:not([data-outside-month])) {
		background: var(--color-booking-primary);
		color: var(--color-booking-black);
	}

	:global(.booking-single-date-day[data-disabled]),
	:global(.booking-single-date-arrow:disabled) {
		opacity: 0.45;
		cursor: default;
	}

	:global(.booking-single-date-trigger:focus-visible),
	:global(.booking-single-date-arrow:focus-visible),
	:global(.booking-single-date-day:focus-visible) {
		outline: 2px solid var(--color-booking-primary);
		outline-offset: 2px;
	}
</style>
