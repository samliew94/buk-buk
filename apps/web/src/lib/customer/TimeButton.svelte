<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Button from './Button.svelte';

	let {
		time,
		selected = false,
		...attributes
	}: Omit<HTMLButtonAttributes, 'children'> & {
		time: string;
		selected?: boolean;
	} = $props();

	let label = $derived.by(() => {
		const [hour, minute] = time.split(':').map(Number);
		return `${hour % 12 || 12}:${String(minute).padStart(2, '0')}${hour >= 12 ? 'PM' : 'AM'}`;
	});
</script>

<Button
	{...attributes}
	variant={selected ? 'primary' : 'secondary'}
	aria-pressed={selected}
	class={[
		'flex-col gap-1! px-2! py-2! font-poppins! font-normal! hover:opacity-100!',
		selected
			? 'text-booking-black! transition-none! hover:bg-booking-primary!'
			: 'border-[0.5px]! border-booking-primary/30! text-booking-white! hover:bg-booking-primary/30!',
		attributes.class
	]}
>
	<span class={['text-[14px]', selected ? 'font-semibold' : 'font-normal']}>{label}</span>
</Button>
