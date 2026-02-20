<script>
    import NoteCard from "./NoteCard.svelte";
    import QuestionPanel from "./QuestionPanel.svelte";

    const generateId = () => Math.random().toString(36).substring(2, 9);

    let notes = $state([]);
    let activeNoteId = $state(null);

    // questionThreads is an object: { [noteId]: { items: string[], loading: boolean } }
    let questionThreads = $state({});

    let debounceTimer = null;
    let abortController = null;

    function addNote() {
        const newNote = {
            id: generateId(),
            content: "",
            createdAt: Date.now(),
        };
        notes.push(newNote); // reactivity in runes feels like plain JS
        activeNoteId = newNote.id;
        questionThreads[newNote.id] = { items: [], loading: false };
    }

    function handleContentChange(id, content) {
        const noteIndex = notes.findIndex((n) => n.id === id);
        if (noteIndex !== -1) {
            notes[noteIndex].content = content;
        }

        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            fetchQuestions(id);
        }, 1200);
    }

    function handleNoteFocus(id) {
        activeNoteId = id;
    }

    async function fetchQuestions(noteId) {
        if (abortController) {
            abortController.abort();
        }

        const notesWithContent = notes.filter((n) => n.content.trim());
        if (notesWithContent.length === 0) return;

        abortController = new AbortController();

        if (!questionThreads[noteId]) {
            questionThreads[noteId] = { items: [], loading: true };
        } else {
            questionThreads[noteId].loading = true;
        }

        // Store initial length to append properly
        const initialItemsLength = questionThreads[noteId].items.length;
        let currentStreamedQuestions = [];

        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    notes: notesWithContent.map((n) => ({
                        id: n.id,
                        content: n.content,
                    })),
                    activeNoteId: noteId,
                }),
                signal: abortController.signal,
            });

            if (!response.ok) throw new Error("Failed to generate questions");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

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
                            if (parsed.question) {
                                currentStreamedQuestions = [
                                    ...currentStreamedQuestions,
                                    parsed.question,
                                ];
                                // Update the thread with the *appended* questions
                                questionThreads[noteId].items = [
                                    ...questionThreads[noteId].items.slice(
                                        0,
                                        initialItemsLength,
                                    ),
                                    ...currentStreamedQuestions,
                                ];
                            } else if (parsed.partial) {
                                const partialList =
                                    currentStreamedQuestions.length > 0
                                        ? [
                                              ...currentStreamedQuestions.slice(
                                                  0,
                                                  -1,
                                              ),
                                              currentStreamedQuestions[
                                                  currentStreamedQuestions.length -
                                                      1
                                              ] + parsed.partial,
                                          ]
                                        : [parsed.partial];
                                questionThreads[noteId].items = [
                                    ...questionThreads[noteId].items.slice(
                                        0,
                                        initialItemsLength,
                                    ),
                                    ...partialList,
                                ];
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                }
            }

            questionThreads[noteId].loading = false;
        } catch (error) {
            if (error.name !== "AbortError") {
                console.error("Error fetching questions:", error);
                questionThreads[noteId].loading = false;
            }
        }
    }
</script>

{#if notes.length === 0}
    <div class="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div class="text-center">
            <h1 class="text-2xl font-light text-gray-300 mb-2">
                Brainstorm Canvas
            </h1>
            <p class="text-gray-500 mb-8 max-w-md">
                Drop thoughts into separate notes. The AI reads the whole canvas
                and surfaces lateral questions as you type.
            </p>
            <button
                onclick={addNote}
                class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
                Start with a thought
            </button>
        </div>
    </div>
{:else}
    <div class="min-h-screen bg-gray-950 p-8">
        <div class="max-w-6xl mx-auto">
            <header class="flex items-center justify-between mb-8">
                <h1 class="text-xl font-light text-gray-400">
                    Brainstorm Canvas
                </h1>
                <button
                    onclick={addNote}
                    class="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors text-xl"
                >
                    +
                </button>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {#each notes as note (note.id)}
                    <div>
                        <NoteCard
                            id={note.id}
                            content={note.content}
                            isActive={activeNoteId === note.id}
                            onContentChange={handleContentChange}
                            onFocus={handleNoteFocus}
                        />
                        <QuestionPanel
                            items={questionThreads[note.id]?.items || []}
                            loading={questionThreads[note.id]?.loading || false}
                            isActive={activeNoteId === note.id}
                        />
                    </div>
                {/each}
            </div>
        </div>
    </div>
{/if}
