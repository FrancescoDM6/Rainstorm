<script>
    let {
        questions = [],
        loading = false,
        queuePosition = 0,
        onQuestionClick,
    } = $props();
</script>

{#if questions?.length > 0 || loading || queuePosition > 0}
    <div class="mt-2 ml-4 pl-4 border-l-2 border-gray-700/50">
        {#if queuePosition > 0}
            <div class="flex items-center gap-2 text-gray-500 text-xs py-1">
                <div
                    class="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"
                ></div>
                <span>Queued (#{queuePosition})...</span>
            </div>
        {:else if loading}
            <div class="flex items-center gap-2 text-gray-500 text-xs py-1">
                <div
                    class="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"
                ></div>
                <span>Thinking laterally...</span>
            </div>
        {:else}
            <ul class="space-y-1.5">
                {#each questions as question}
                    <li>
                        <button
                            onclick={() => onQuestionClick(question)}
                            class="text-left text-xs text-gray-400 leading-relaxed py-1 px-2 -ml-2 rounded hover:text-blue-300 hover:bg-blue-500/10 transition-colors duration-150 cursor-pointer w-full"
                        >
                            {question}
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
{/if}
