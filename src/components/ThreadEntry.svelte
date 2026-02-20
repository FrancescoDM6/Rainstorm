<script>
    import ThoughtEditor from "./ThoughtEditor.svelte";
    import QuestionList from "./QuestionList.svelte";

    let {
        entry,
        isActive,
        isFirst,
        queuePosition,
        onContentChange,
        onFocus,
        onQuestionClick,
    } = $props();
</script>

<div class="relative">
    {#if entry.inspiredBy}
        <div class="mb-2 ml-4 text-xs text-blue-400/70 italic">
            <span class="text-gray-600 mr-1">&larr;</span>
            {entry.inspiredBy}
        </div>
    {/if}

    <ThoughtEditor
        content={entry.content}
        {isActive}
        {isFirst}
        onChange={(content) => onContentChange(entry.id, content)}
        onFocus={() => onFocus(entry.id)}
    />

    <QuestionList
        questions={entry.questions}
        loading={entry.questionsLoading}
        {queuePosition}
        {onQuestionClick}
    />
</div>
