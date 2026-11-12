<script lang="ts">
	export interface SelectOption {
		value: string;
		label: string;
	}

	let {
		id,
		label,
		options,
		value = $bindable(''),
		name,
		disabled = false
	}: {
		id: string;
		label: string;
		options: SelectOption[];
		value?: string;
		name?: string;
		disabled?: boolean;
	} = $props();
</script>

<label class="grid gap-2 text-sm font-medium text-[var(--black)]" for={id}>
	<span>{label}</span>
	<select
		{id}
		{name}
		bind:value
		{disabled}
		class="w-full rounded-md border border-black/20 bg-[var(--white)] px-3 py-2 text-base text-[var(--black)] transition outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-60"
	>
		{#each options as option}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</label>
