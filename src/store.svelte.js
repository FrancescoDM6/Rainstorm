export const STORAGE_KEY = 'rainstorm-threads';
export const ACTIVE_KEY = 'rainstorm-active-thread';

export const generateId = () => Math.random().toString(36).substring(2, 9);

export function createThread() {
    return {
        id: generateId(),
        title: '',
        createdAt: Date.now(),
        entries: []
    };
}

export function createEntry(inspiredBy = null) {
    return {
        id: generateId(),
        content: '',
        inspiredBy,
        questions: [],
        questionsLoading: false,
        createdAt: Date.now()
    };
}

// Global shared state using Svelte 5 Runes
export const threadStore = $state({
    threads: loadThreads(),
    activeThreadId: null,
    activeEntryId: null
});

threadStore.activeThreadId = loadActiveThreadId(threadStore.threads);

// Setup initial active entry id
const activeThreadInit = threadStore.threads.find(t => t.id === threadStore.activeThreadId);
const entriesInit = activeThreadInit?.entries || [];
threadStore.activeEntryId = entriesInit[entriesInit.length - 1]?.id || null;

function loadThreads() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((t) => ({
                    ...t,
                    entries: t.entries.map((e) => ({ ...e, questionsLoading: false }))
                }));
            }
        }
    } catch {
        // Ignore corrupt data
    }
    const initial = createThread();
    initial.entries = [createEntry()];
    return [initial];
}

function loadActiveThreadId(threads) {
    try {
        const saved = localStorage.getItem(ACTIVE_KEY);
        if (saved && threads.find((t) => t.id === saved)) {
            return saved;
        }
    } catch {
        // Ignore
    }
    return threads[0]?.id || null;
}

// Subscriptions
$effect.root(() => {
    $effect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(threadStore.threads));
    });

    $effect(() => {
        if (threadStore.activeThreadId) {
            localStorage.setItem(ACTIVE_KEY, threadStore.activeThreadId);
        }
    });
});

export function getActiveThread() {
    return threadStore.threads.find((t) => t.id === threadStore.activeThreadId) || null;
}

export function addThread() {
    const thread = createThread();
    const entry = createEntry();
    thread.entries = [entry];
    threadStore.threads.push(thread);
    threadStore.activeThreadId = thread.id;
    threadStore.activeEntryId = entry.id;
    return thread;
}

export function deleteThread(threadId) {
    const remaining = threadStore.threads.filter((t) => t.id !== threadId);
    if (remaining.length === 0) {
        const fresh = createThread();
        fresh.entries = [createEntry()];
        threadStore.threads = [fresh];
    } else {
        threadStore.threads = remaining;
    }

    if (threadStore.activeThreadId === threadId) {
        threadStore.activeThreadId = threadStore.threads[0]?.id || null;
    }
}

export function switchThread(threadId) {
    threadStore.activeThreadId = threadId;
    const thread = threadStore.threads.find((t) => t.id === threadId);
    const entries = thread?.entries || [];
    threadStore.activeEntryId = entries[entries.length - 1]?.id || null;
}

export function addEntry(inspiredBy = null) {
    const entry = createEntry(inspiredBy);
    const threadIndex = threadStore.threads.findIndex(t => t.id === threadStore.activeThreadId);
    if (threadIndex !== -1) {
        threadStore.threads[threadIndex].entries.push(entry);
    }
    threadStore.activeEntryId = entry.id;
    return entry;
}

export function updateEntryContent(entryId, content) {
    const threadIndex = threadStore.threads.findIndex(t => t.id === threadStore.activeThreadId);
    if (threadIndex === -1) return;

    const thread = threadStore.threads[threadIndex];

    if (thread.entries[0]?.id === entryId && !thread.title) {
        thread.title = content.slice(0, 40);
    }

    const entryIndex = thread.entries.findIndex(e => e.id === entryId);
    if (entryIndex !== -1) {
        thread.entries[entryIndex].content = content;
    }
}

export function setEntryQuestions(entryId, questions, loading = false) {
    const threadIndex = threadStore.threads.findIndex(t => t.id === threadStore.activeThreadId);
    if (threadIndex === -1) return;

    const entryIndex = threadStore.threads[threadIndex].entries.findIndex(e => e.id === entryId);
    if (entryIndex !== -1) {
        threadStore.threads[threadIndex].entries[entryIndex].questions = questions;
        threadStore.threads[threadIndex].entries[entryIndex].questionsLoading = loading;
    }
}

export function setEntryLoading(entryId, loading) {
    const threadIndex = threadStore.threads.findIndex(t => t.id === threadStore.activeThreadId);
    if (threadIndex === -1) return;

    const entryIndex = threadStore.threads[threadIndex].entries.findIndex(e => e.id === entryId);
    if (entryIndex !== -1) {
        threadStore.threads[threadIndex].entries[entryIndex].questionsLoading = loading;
    }
}
