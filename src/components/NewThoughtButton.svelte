<script>
    let { onClick } = $props();
</script>

<button
    onclick={onClick}
    class="w-full py-3 mt-4 text-sm text-gray-500 hover:text-gray-300 border border-dashed border-gray-700 hover:border-gray-500 rounded-lg transition-colors duration-200 cursor-pointer"
>
    + Add a thought
</button>
