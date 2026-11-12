<script lang="ts">
	let {
		id,
		label,
		value = $bindable(''),
		name,
		placeholder,
		required = false,
		disabled = false,
		rows = 5
	}: {
		id: string;
		label: string;
		value?: string;
		name?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		rows?: number;
	} = $props();
</script>

<label class="grid gap-2 text-sm font-medium text-[var(--black)]" for={id}>
	<span>{label}</span>
	<textarea
		{id}
		{name}
		bind:value
		{placeholder}
		{required}
		{disabled}
		{rows}
		class="w-full resize-y rounded-md border border-black/20 bg-[var(--white)] px-3 py-2 text-base text-[var(--black)] transition outline-none placeholder:text-[var(--grey)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-60"
	></textarea>
</label>
