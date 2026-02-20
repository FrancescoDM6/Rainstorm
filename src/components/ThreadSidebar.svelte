<script>
    let {
        threads = [],
        activeThreadId = null,
        onSwitch,
        onNew,
        onDelete,
    } = $props();
</script>

<aside
    class="w-60 shrink-0 bg-gray-900 border-r border-gray-800 p-4 hidden md:block overflow-y-auto"
>
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-medium text-gray-400">Threads</h2>
        <button
            onclick={onNew}
            class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg cursor-pointer"
        >
            +
        </button>
    </div>

    <ul class="space-y-1">
        {#each threads as thread (thread.id)}
            {@const isActive = thread.id === activeThreadId}
            {@const title =
                thread.title ||
                thread.entries[0]?.content?.slice(0, 40) ||
                "New thread"}
            {@const truncated = title.length >= 40 ? title + "..." : title}

            <li>
                <button
                    onclick={() => onSwitch(thread.id)}
                    class="w-full text-left text-xs px-3 py-2 rounded transition-colors duration-150 cursor-pointer group flex items-center justify-between {isActive
                        ? 'bg-gray-800 text-gray-200'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}"
                >
                    <span class="truncate">{truncated}</span>
                    {#if threads.length > 1}
                        <span
                            role="button"
                            tabindex="0"
                            onclick={(e) => {
                                e.stopPropagation();
                                if (window.confirm("Delete this thread?")) {
                                    onDelete(thread.id);
                                }
                            }}
                            onkeydown={(e) => {
                                if (e.key === "Enter") {
                                    e.stopPropagation();
                                    onDelete(thread.id);
                                }
                            }}
                            class="ml-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            x
                        </span>
                    {/if}
                </button>
            </li>
        {/each}
    </ul>
</aside>
