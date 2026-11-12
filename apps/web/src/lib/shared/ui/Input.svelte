<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		id,
		label,
		type = 'text',
		value = $bindable(''),
		name,
		autocomplete,
		placeholder,
		required = false,
		disabled = false
	}: {
		id: string;
		label?: string;
		type?: 'text' | 'password' | 'email' | 'number';
		value?: string | number;
		name?: string;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
	} = $props();
</script>

<label class="grid gap-2 text-sm font-medium text-[var(--black)]" for={id}>
	{#if label}<span>{label}</span>{/if}
	<input
		{id}
		{name}
		{type}
		bind:value
		{autocomplete}
		{placeholder}
		{required}
		{disabled}
		class="w-full rounded-md border border-black/20 bg-[var(--white)] px-3 py-2 text-base text-[var(--black)] transition outline-none placeholder:text-[var(--grey)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-60"
	/>
</label>
