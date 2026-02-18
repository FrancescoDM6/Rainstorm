import { useCallback, useRef, useEffect, useState } from 'react'
import ThreadEntry from './ThreadEntry'
import NewThoughtButton from './NewThoughtButton'

export default function ThreadView({
  thread,
  activeEntryId,
  setActiveEntryId,
  addEntry,
  updateEntryContent,
  setEntryQuestions,
  setEntryLoading
}) {
  const debounceRef = useRef(null)
  const cooldownRef = useRef(null)
  const abortControllerRef = useRef(null)
  const bottomRef = useRef(null)
  const entriesRef = useRef(thread?.entries || [])
  const lastGenerationRef = useRef(0)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [queuedEntries, setQueuedEntries] = useState({}) // entryId -> queue position
  const [providerConfig, setProviderConfig] = useState({ isLocal: true, cooldownMs: 2000 })

  // Fetch provider config on mount to set appropriate cooldown
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        const isLocal = data.isLocal ?? (data.provider === 'ollama')
        setProviderConfig({
          isLocal,
          cooldownMs: isLocal ? 2000 : 8000
        })
      })
      .catch(() => {
        setProviderConfig({ isLocal: false, cooldownMs: 8000 })
      })
  }, [])

  // Keep entriesRef in sync for use inside fetchQuestions
  useEffect(() => {
    entriesRef.current = thread?.entries || []
  }, [thread?.entries])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }, [])

  // Cooldown countdown timer
  const startCooldownTimer = useCallback((remainingMs) => {
    if (cooldownRef.current) clearInterval(cooldownRef.current)

    setCooldownRemaining(Math.ceil(remainingMs / 1000))
    cooldownRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          cooldownRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const fetchQuestions = useCallback(async (entryId) => {
    const entries = entriesRef.current
    const entriesWithContent = entries.filter(e => e.content.trim())
    if (entriesWithContent.length === 0) return

    // Check cooldown
    const now = Date.now()
    const elapsed = now - lastGenerationRef.current
    const cooldown = providerConfig.cooldownMs
    if (elapsed < cooldown) {
      const waitMs = cooldown - elapsed
      startCooldownTimer(waitMs)
      debounceRef.current = setTimeout(() => {
        fetchQuestions(entryId)
      }, waitMs)
      return
    }

    setEntryLoading(entryId, true)
    lastGenerationRef.current = Date.now()

    try {
      const controller = new AbortController()
      abortControllerRef.current = controller

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: entriesWithContent.map(e => ({
            id: e.id,
            content: e.content,
            inspiredBy: e.inspiredBy,
            questions: e.questions
          })),
          activeEntryId: entryId
        }),
        signal: controller.signal
      })

      if (!response.ok) throw new Error('Failed to generate questions')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentQuestions = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.queued) {
                // Server says we're queued — show position
                setQueuedEntries(prev => ({ ...prev, [entryId]: parsed.position }))
              } else if (parsed.question) {
                // First question arrives — no longer queued
                setQueuedEntries(prev => {
                  const next = { ...prev }
                  delete next[entryId]
                  return next
                })
                currentQuestions = [...currentQuestions, parsed.question]
                setEntryQuestions(entryId, currentQuestions, false)
              } else if (parsed.error && parsed.retryAfter) {
                startCooldownTimer(parsed.retryAfter * 1000)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      setQueuedEntries(prev => {
        const next = { ...prev }
        delete next[entryId]
        return next
      })
      setEntryQuestions(entryId, currentQuestions, false)
    } catch (error) {
      setQueuedEntries(prev => {
        const next = { ...prev }
        delete next[entryId]
        return next
      })
      if (error.name !== 'AbortError') {
        console.error('Error fetching questions:', error)
        setEntryLoading(entryId, false)
      }
    }
  }, [setEntryQuestions, setEntryLoading, providerConfig.cooldownMs, startCooldownTimer])

  const handleContentChange = useCallback((entryId, content) => {
    updateEntryContent(entryId, content)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchQuestions(entryId)
    }, 1200)
  }, [updateEntryContent, fetchQuestions])

  const handleFocus = useCallback((entryId) => {
    setActiveEntryId(entryId)
  }, [setActiveEntryId])

  const handleQuestionClick = useCallback((questionText) => {
    addEntry(questionText)
    scrollToBottom()
  }, [addEntry, scrollToBottom])

  const handleAddThought = useCallback(() => {
    addEntry(null)
    scrollToBottom()
  }, [addEntry, scrollToBottom])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (cooldownRef.current) clearInterval(cooldownRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  if (!thread) return null

  // Empty thread state
  if (thread.entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Start a thread of thought</p>
          <button
            onClick={handleAddThought}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Begin
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-6">
        {thread.entries.map((entry, index) => (
          <ThreadEntry
            key={entry.id}
            entry={entry}
            isActive={activeEntryId === entry.id}
            isFirst={index === 0}
            queuePosition={queuedEntries[entry.id] || 0}
            onContentChange={handleContentChange}
            onFocus={handleFocus}
            onQuestionClick={handleQuestionClick}
          />
        ))}
      </div>

      {cooldownRemaining > 0 && (
        <div className="mt-3 text-center text-xs text-gray-600">
          Next question in {cooldownRemaining}s...
        </div>
      )}

      <NewThoughtButton onClick={handleAddThought} />
      <div ref={bottomRef} />
    </div>
  )
}
