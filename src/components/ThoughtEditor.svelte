<script>
    let {
        content = "",
        isActive = false,
        isFirst = false,
        onChange,
        onFocus,
    } = $props();

    let textareaRef = null;

    $effect(() => {
        if (isActive && textareaRef) {
            textareaRef.focus();
        }
    });

    $effect(() => {
        // Auto resize logic dependent on content
        if (textareaRef) {
            textareaRef.style.height = "auto";
            textareaRef.style.height = textareaRef.scrollHeight + "px";
        }
    });

    function handleInput(e) {
        onChange(e.target.value);
    }
</script>

<textarea
    bind:this={textareaRef}
    value={content}
    oninput={handleInput}
    onfocus={onFocus}
    placeholder={isFirst
        ? "What are you thinking?"
        : "Continue your thought..."}
    class="w-full p-4 rounded-lg resize-none bg-gray-800/50 text-gray-100 placeholder-gray-500 text-sm leading-relaxed transition-all duration-200 focus:outline-none {isActive
        ? 'bg-gray-800 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
        : 'hover:bg-gray-800/70'}"
    rows="1"
></textarea>
