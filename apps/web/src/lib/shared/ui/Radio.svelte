<script lang="ts">
	import Icon from '@iconify/svelte';

	let {
		id,
		name,
		value,
		label,
		description,
		icon,
		checked = false,
		disabled = false,
		borderless = false,
		showLabel = true,
		onchange
	}: {
		id: string;
		name: string;
		value: string;
		label: string;
		description?: string;
		icon?: string;
		checked?: boolean;
		disabled?: boolean;
		borderless?: boolean;
		showLabel?: boolean;
		onchange?: (event: Event) => void;
	} = $props();
</script>

<label
	class={`flex cursor-pointer items-start gap-3 rounded-md p-4 transition has-[:checked]:bg-[var(--primary)]/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${borderless ? '' : 'border border-black/10 hover:border-[var(--primary)]/50 has-[:checked]:border-[var(--primary)]'}`}
	for={id}
>
	<input
		{id}
		{name}
		type="radio"
		{value}
		{checked}
		{disabled}
		{onchange}
		aria-label={label}
		class="mt-1 size-4 accent-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
	/>
	{#if icon}<Icon {icon} class="mt-0.5 size-5 shrink-0" aria-hidden="true" />{/if}
	{#if showLabel || description}
		<span class="grid gap-1">
			{#if showLabel}<span class="font-medium">{label}</span>{/if}
			{#if description}<span class="text-sm text-[var(--grey)]">{description}</span>{/if}
		</span>
	{/if}
</label>
