<script>
    import { tick } from "svelte";
    let { items = [], loading = false, isActive = false } = $props();

    let containerRef = null;
    let previousLength = 0;

    // Scroll to bottom when new items are added
    $effect(() => {
        if (items.length > previousLength && containerRef) {
            tick().then(() => {
                containerRef.scrollTop = containerRef.scrollHeight;
            });
        }
        previousLength = items.length;
    });
</script>

{#if items.length > 0 || loading}
    <div
        bind:this={containerRef}
        class="mt-2 p-3 rounded-lg bg-gray-900/50 border border-gray-700/50 transition-opacity duration-300 max-h-64 overflow-y-auto {isActive
            ? 'opacity-100'
            : 'opacity-30 hover:opacity-70'}"
    >
        <ul class="space-y-3">
            {#each items as question}
                <li
                    class="text-xs text-gray-400 leading-relaxed pl-3 border-l-2 border-gray-700"
                >
                    {question}
                </li>
            {/each}
        </ul>

        {#if loading}
            <div class="flex items-center gap-2 text-gray-500 text-xs mt-3">
                <div
                    class="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"
                ></div>
                <span>Thinking laterally...</span>
            </div>
        {/if}
    </div>
{/if}
