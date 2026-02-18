import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'rainstorm-threads'
const ACTIVE_KEY = 'rainstorm-active-thread'

const generateId = () => Math.random().toString(36).substring(2, 9)

function createThread() {
  return {
    id: generateId(),
    title: '',
    createdAt: Date.now(),
    entries: []
  }
}

function createEntry(inspiredBy = null) {
  return {
    id: generateId(),
    content: '',
    inspiredBy,
    questions: [],
    questionsLoading: false,
    createdAt: Date.now()
  }
}

function loadThreads() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Clear any stale loading states from previous session
        return parsed.map(t => ({
          ...t,
          entries: t.entries.map(e => ({ ...e, questionsLoading: false }))
        }))
      }
    }
  } catch {
    // Ignore corrupt data
  }
  const initial = createThread()
  initial.entries = [createEntry()]
  return [initial]
}

function loadActiveThreadId(threads) {
  try {
    const saved = localStorage.getItem(ACTIVE_KEY)
    if (saved && threads.find(t => t.id === saved)) {
      return saved
    }
  } catch {
    // Ignore
  }
  return threads[0]?.id || null
}

export default function useThreadStore() {
  const [threads, setThreads] = useState(loadThreads)
  const [activeThreadId, setActiveThreadId] = useState(() => loadActiveThreadId(threads))
  const [activeEntryId, setActiveEntryId] = useState(() => {
    const thread = threads.find(t => t.id === activeThreadId)
    const entries = thread?.entries || []
    return entries[entries.length - 1]?.id || null
  })

  // Persist threads to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads))
  }, [threads])

  useEffect(() => {
    if (activeThreadId) {
      localStorage.setItem(ACTIVE_KEY, activeThreadId)
    }
  }, [activeThreadId])

  const activeThread = threads.find(t => t.id === activeThreadId) || null

  const updateThread = useCallback((threadId, updater) => {
    setThreads(prev => prev.map(t =>
      t.id === threadId ? updater(t) : t
    ))
  }, [])

  const addThread = useCallback(() => {
    const thread = createThread()
    const entry = createEntry()
    thread.entries = [entry]
    setThreads(prev => [...prev, thread])
    setActiveThreadId(thread.id)
    setActiveEntryId(entry.id)
    return thread
  }, [])

  const deleteThread = useCallback((threadId) => {
    setThreads(prev => {
      const remaining = prev.filter(t => t.id !== threadId)
      if (remaining.length === 0) {
        const fresh = createThread()
        fresh.entries = [createEntry()]
        return [fresh]
      }
      return remaining
    })
    setActiveThreadId(prev => {
      if (prev === threadId) {
        const remaining = threads.filter(t => t.id !== threadId)
        return remaining[0]?.id || null
      }
      return prev
    })
  }, [threads])

  const switchThread = useCallback((threadId) => {
    setActiveThreadId(threadId)
    const thread = threads.find(t => t.id === threadId)
    const entries = thread?.entries || []
    setActiveEntryId(entries[entries.length - 1]?.id || null)
  }, [threads])

  const addEntry = useCallback((inspiredBy = null) => {
    const entry = createEntry(inspiredBy)
    updateThread(activeThreadId, t => ({
      ...t,
      entries: [...t.entries, entry]
    }))
    setActiveEntryId(entry.id)
    return entry
  }, [activeThreadId, updateThread])

  const updateEntryContent = useCallback((entryId, content) => {
    updateThread(activeThreadId, t => ({
      ...t,
      title: t.entries[0]?.id === entryId && !t.title ? content.slice(0, 40) : t.title,
      entries: t.entries.map(e =>
        e.id === entryId ? { ...e, content } : e
      )
    }))
  }, [activeThreadId, updateThread])

  const setEntryQuestions = useCallback((entryId, questions, loading = false) => {
    updateThread(activeThreadId, t => ({
      ...t,
      entries: t.entries.map(e =>
        e.id === entryId ? { ...e, questions, questionsLoading: loading } : e
      )
    }))
  }, [activeThreadId, updateThread])

  const setEntryLoading = useCallback((entryId, loading) => {
    updateThread(activeThreadId, t => ({
      ...t,
      entries: t.entries.map(e =>
        e.id === entryId ? { ...e, questionsLoading: loading } : e
      )
    }))
  }, [activeThreadId, updateThread])

  return {
    threads,
    activeThread,
    activeThreadId,
    activeEntryId,
    setActiveThreadId,
    setActiveEntryId,
    addThread,
    deleteThread,
    switchThread,
    addEntry,
    updateEntryContent,
    setEntryQuestions,
    setEntryLoading,
    setThreads
  }
}
