<script>
  import ThreadSidebar from "./components/ThreadSidebar.svelte";
  import ThreadView from "./components/ThreadView.svelte";
  import {
    threadStore,
    addThread,
    deleteThread,
    switchThread,
    getActiveThread,
  } from "./store.svelte.js";
</script>

<div class="min-h-screen bg-gray-950 flex">
  <ThreadSidebar
    threads={threadStore.threads}
    activeThreadId={threadStore.activeThreadId}
    onSwitch={switchThread}
    onNew={addThread}
    onDelete={deleteThread}
  />

  <main class="flex-1 p-8 overflow-y-auto w-full">
    <header class="max-w-2xl mx-auto mb-8 flex items-center justify-between">
      <h1 class="text-xl font-light text-gray-400">Rainstorm</h1>
      <button
        onclick={addThread}
        class="md:hidden w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg cursor-pointer"
      >
        +
      </button>
    </header>

    <ThreadView thread={getActiveThread()} />
  </main>
</div>
