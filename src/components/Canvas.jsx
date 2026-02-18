import { useState, useCallback, useRef, useEffect } from 'react'
import NoteCard from './NoteCard'
import QuestionPanel from './QuestionPanel'

const generateId = () => Math.random().toString(36).substring(2, 9)

export default function Canvas() {
  const [notes, setNotes] = useState([])
  const [activeNoteId, setActiveNoteId] = useState(null)
  const [questions, setQuestions] = useState({ noteId: null, items: [], loading: false })

  const debounceRef = useRef(null)
  const abortControllerRef = useRef(null)

  const addNote = useCallback(() => {
    const newNote = {
      id: generateId(),
      content: '',
      createdAt: Date.now()
    }
    setNotes(prev => [...prev, newNote])
    setActiveNoteId(newNote.id)
  }, [])

  const updateNoteContent = useCallback((id, content) => {
    setNotes(prev => prev.map(note =>
      note.id === id ? { ...note, content } : note
    ))
  }, [])

  const fetchQuestions = useCallback(async (noteId, allNotes) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const notesWithContent = allNotes.filter(n => n.content.trim())
    if (notesWithContent.length === 0) return

    abortControllerRef.current = new AbortController()
    setQuestions({ noteId, items: [], loading: true })

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notesWithContent.map(n => ({ id: n.id, content: n.content })),
          activeNoteId: noteId
        }),
        signal: abortControllerRef.current.signal
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
              if (parsed.question) {
                currentQuestions = [...currentQuestions, parsed.question]
                setQuestions({ noteId, items: currentQuestions, loading: false })
              } else if (parsed.partial) {
                // Handle streaming partial question
                const partial = currentQuestions.length > 0
                  ? [...currentQuestions.slice(0, -1), currentQuestions[currentQuestions.length - 1] + parsed.partial]
                  : [parsed.partial]
                setQuestions({ noteId, items: partial, loading: false })
              }
            } catch (e) {
              // Ignore parse errors for partial data
            }
          }
        }
      }

      setQuestions({ noteId, items: currentQuestions, loading: false })
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching questions:', error)
        setQuestions({ noteId, items: [], loading: false })
      }
    }
  }, [])

  const handleContentChange = useCallback((id, content) => {
    updateNoteContent(id, content)

    // Debounce the AI call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      setNotes(currentNotes => {
        fetchQuestions(id, currentNotes)
        return currentNotes
      })
    }, 1200) // 1.2 second debounce
  }, [updateNoteContent, fetchQuestions])

  const handleNoteFocus = useCallback((id) => {
    setActiveNoteId(id)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  // Empty state
  if (notes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-light text-gray-300 mb-2">Brainstorm Canvas</h1>
          <p className="text-gray-500 mb-8 max-w-md">
            Drop thoughts into separate notes. The AI reads the whole canvas and surfaces lateral questions as you type.
          </p>
          <button
            onClick={addNote}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Start with a thought
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-light text-gray-400">Brainstorm Canvas</h1>
          <button
            onClick={addNote}
            className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors text-xl"
          >
            +
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => (
            <div key={note.id}>
              <NoteCard
                id={note.id}
                content={note.content}
                isActive={activeNoteId === note.id}
                onContentChange={handleContentChange}
                onFocus={handleNoteFocus}
              />
              <QuestionPanel
                questions={questions.noteId === note.id ? questions.items : []}
                loading={questions.noteId === note.id && questions.loading}
                isActive={activeNoteId === note.id}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
