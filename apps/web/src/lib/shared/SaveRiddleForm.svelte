<script lang="ts">
	import type { Riddle, RiddleInput } from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';
	import TextArea from '$lib/shared/ui/TextArea.svelte';

	let {
		initialValue = { question: '', questionZh: '', answer: '' },
		submitLabel = 'Save riddle',
		loading = false,
		error = '',
		onsave
	}: {
		initialValue?: RiddleInput | Riddle;
		submitLabel?: string;
		loading?: boolean;
		error?: string;
		onsave: (input: RiddleInput) => void;
	} = $props();

	const startingValue = {
		question: initialValue.question,
		questionZh: initialValue.questionZh ?? '',
		answer: initialValue.answer
	};
	let question = $state(startingValue.question);
	let questionZh = $state(startingValue.questionZh);
	let answer = $state(startingValue.answer);
	let validationError = $state('');

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		validationError = '';

		const normalized = {
			question: question.trim(),
			questionZh: questionZh.trim(),
			answer: answer.trim()
		};
		if (!normalized.question) {
			validationError = 'Question is required.';
			return;
		}
		if (!normalized.questionZh) {
			validationError = 'Simplified Chinese question is required.';
			return;
		}
		if (!normalized.answer) {
			validationError = 'Answer is required.';
			return;
		}
		onsave(normalized);
	}
</script>

<form class="grid gap-6" novalidate onsubmit={handleSubmit}>
	<div class="grid gap-5 rounded-lg border border-black/10 bg-[var(--white)] p-5 shadow-sm">
		<TextArea id="question" name="question" label="Question" required rows={7} bind:value={question} />
		<TextArea
			id="questionZh"
			name="questionZh"
			label="Question (Simplified Chinese)"
			required
			rows={7}
			bind:value={questionZh}
		/>
		<TextArea id="answer" name="answer" label="Answer" required bind:value={answer} />
	</div>
	<div class="grid gap-2">
		<Button type="submit" {loading} loadingLabel="Saving...">{submitLabel}</Button>
		{#if validationError || error}
			<span class="text-sm text-[var(--danger)]" role="alert">{validationError || error}</span>
		{/if}
	</div>
</form>
