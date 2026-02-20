<script>
    let { id, content, isActive, onContentChange, onFocus } = $props();

    let textareaRef = null;

    $effect(() => {
        if (isActive && textareaRef) {
            textareaRef.focus();
        }
    });

    function handleInput(e) {
        onContentChange(id, e.target.value);
    }
</script>

<div
    class="relative rounded-lg transition-all duration-200 {isActive
        ? 'bg-gray-800 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
        : 'bg-gray-800/50 hover:bg-gray-800/70'}"
>
    <textarea
        bind:this={textareaRef}
        value={content}
        oninput={handleInput}
        onfocus={() => onFocus(id)}
        placeholder="Drop a thought here..."
        class="w-full h-full min-h-[120px] p-4 bg-transparent text-gray-100 placeholder-gray-500 resize-none focus:outline-none text-sm leading-relaxed"
    ></textarea>
</div>
