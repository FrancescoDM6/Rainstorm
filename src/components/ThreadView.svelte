<script>
    import { tick, onMount, onDestroy } from "svelte";
    import ThreadEntry from "./ThreadEntry.svelte";
    import NewThoughtButton from "./NewThoughtButton.svelte";
    import {
        threadStore,
        addEntry,
        updateEntryContent,
        setEntryQuestions,
        setEntryLoading,
    } from "../store.svelte";

    let { thread } = $props();

    let debounceRef = null;
    let cooldownRef = null;
    let abortControllerRef = null;
    let bottomRef = null;

    let lastGeneration = $state(0);
    let cooldownRemaining = $state(0);
    let queuedEntries = $state({}); // entryId -> queue position
    let providerConfig = $state({ isLocal: true, cooldownMs: 2000 });

    onMount(() => {
        fetch("/api/health")
            .then((r) => r.json())
            .then((data) => {
                const isLocal = data.isLocal ?? data.provider === "ollama";
                providerConfig = {
                    isLocal,
                    cooldownMs: isLocal ? 2000 : 8000,
                };
            })
            .catch(() => {
                providerConfig = { isLocal: false, cooldownMs: 8000 };
            });
    });

    onDestroy(() => {
        if (debounceRef) clearTimeout(debounceRef);
        if (cooldownRef) clearInterval(cooldownRef);
        if (abortControllerRef) abortControllerRef.abort();
    });

    function scrollToBottom() {
        setTimeout(() => {
            if (bottomRef) {
                bottomRef.scrollIntoView({ behavior: "smooth" });
            }
        }, 50);
    }

    function startCooldownTimer(remainingMs) {
        if (cooldownRef) clearInterval(cooldownRef);

        cooldownRemaining = Math.ceil(remainingMs / 1000);
        cooldownRef = setInterval(() => {
            if (cooldownRemaining <= 1) {
                clearInterval(cooldownRef);
                cooldownRef = null;
                cooldownRemaining = 0;
            } else {
                cooldownRemaining -= 1;
            }
        }, 1000);
    }

    async function fetchQuestions(entryId) {
        const currentThread = threadStore.threads.find(
            (t) => t.id === threadStore.activeThreadId,
        );
        if (!currentThread) return;

        const entries = currentThread.entries;
        const entriesWithContent = entries.filter((e) => e.content.trim());
        if (entriesWithContent.length === 0) return;

        const now = Date.now();
        const elapsed = now - lastGeneration;
        const cooldown = providerConfig.cooldownMs;

        if (elapsed < cooldown) {
            const waitMs = cooldown - elapsed;
            startCooldownTimer(waitMs);
            debounceRef = setTimeout(() => {
                fetchQuestions(entryId);
            }, waitMs);
            return;
        }

        setEntryLoading(entryId, true);
        lastGeneration = Date.now();

        try {
            const controller = new AbortController();
            abortControllerRef = controller;

            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entries: entriesWithContent.map((e) => ({
                        id: e.id,
                        content: e.content,
                        inspiredBy: e.inspiredBy,
                        questions: e.questions,
                    })),
                    activeEntryId: entryId,
                }),
                signal: controller.signal,
            });

            if (!response.ok) throw new Error("Failed to generate questions");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let currentQuestions = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") continue;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.queued) {
                                queuedEntries = {
                                    ...queuedEntries,
                                    [entryId]: parsed.position,
                                };
                            } else if (parsed.question) {
                                const next = { ...queuedEntries };
                                delete next[entryId];
                                queuedEntries = next;

                                currentQuestions = [
                                    ...currentQuestions,
                                    parsed.question,
                                ];
                                setEntryQuestions(
                                    entryId,
                                    currentQuestions,
                                    false,
                                );
                            } else if (parsed.error && parsed.retryAfter) {
                                startCooldownTimer(parsed.retryAfter * 1000);
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            }

            const next = { ...queuedEntries };
            delete next[entryId];
            queuedEntries = next;

            setEntryQuestions(entryId, currentQuestions, false);
        } catch (error) {
            const next = { ...queuedEntries };
            delete next[entryId];
            queuedEntries = next;

            if (error.name !== "AbortError") {
                console.error("Error fetching questions:", error);
                setEntryLoading(entryId, false);
            }
        }
    }

    function handleContentChange(entryId, content) {
        updateEntryContent(entryId, content);

        if (debounceRef) {
            clearTimeout(debounceRef);
        }

        debounceRef = setTimeout(() => {
            fetchQuestions(entryId);
        }, 1200);
    }

    function handleFocus(entryId) {
        threadStore.activeEntryId = entryId;
    }

    function handleQuestionClick(questionText) {
        addEntry(questionText);
        scrollToBottom();
    }

    function handleAddThought() {
        addEntry(null);
        scrollToBottom();
    }
</script>

{#if !thread}
    <!-- Do not render -->
{:else if thread.entries.length === 0}
    <div class="flex items-center justify-center h-full">
        <div class="text-center">
            <p class="text-gray-500 mb-4">Start a thread of thought</p>
            <button
                onclick={handleAddThought}
                class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
                Begin
            </button>
        </div>
    </div>
{:else}
    <div class="max-w-2xl mx-auto">
        <div class="space-y-6">
            {#each thread.entries as entry, index (entry.id)}
                <ThreadEntry
                    {entry}
                    isActive={threadStore.activeEntryId === entry.id}
                    isFirst={index === 0}
                    queuePosition={queuedEntries[entry.id] || 0}
                    onContentChange={handleContentChange}
                    onFocus={handleFocus}
                    onQuestionClick={handleQuestionClick}
                />
            {/each}
        </div>

        {#if cooldownRemaining > 0}
            <div class="mt-3 text-center text-xs text-gray-600">
                Next question in {cooldownRemaining}s...
            </div>
        {/if}

        <NewThoughtButton onClick={handleAddThought} />
        <div bind:this={bottomRef}></div>
    </div>
{/if}
