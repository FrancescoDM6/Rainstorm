import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Provider configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama' // 'anthropic', 'ollama', or 'openai'
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'http://localhost:1234/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'local-model'

// Initialize Anthropic client only if needed
let anthropic = null
if (LLM_PROVIDER === 'anthropic') {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

console.log(`Using LLM provider: ${LLM_PROVIDER}`)

// Build the prompt from canvas state
function buildPrompt(notes, activeNoteId) {
  const notesContext = notes
    .map((note, i) => `Note ${i + 1}${note.id === activeNoteId ? ' (currently editing)' : ''}: "${note.content}"`)
    .join('\n')

  return `Here are all the notes on a brainstorming canvas:

${notesContext}

The user is currently editing the note marked "(currently editing)". Generate 2-3 short questions that create lateral connections across the canvas. Don't respond to the user's thought — pressure it sideways. Challenge assumptions, find contradictions, or surface unexpected connections.

Return only the questions, one per line. No numbering, no preamble.`
}

// Stream questions to response
function streamQuestions(res, text) {
  const lines = text.split('\n').filter(line => line.trim())
  for (const line of lines) {
    res.write(`data: ${JSON.stringify({ question: line.trim() })}\n\n`)
  }
}

// Anthropic streaming
async function streamAnthropic(prompt, res) {
  const stream = await anthropic.messages.stream({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  })

  let currentQuestion = ''

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      const text = event.delta.text
      for (const char of text) {
        if (char === '\n') {
          if (currentQuestion.trim()) {
            res.write(`data: ${JSON.stringify({ question: currentQuestion.trim() })}\n\n`)
          }
          currentQuestion = ''
        } else {
          currentQuestion += char
        }
      }
    }
  }

  if (currentQuestion.trim()) {
    res.write(`data: ${JSON.stringify({ question: currentQuestion.trim() })}\n\n`)
  }
}

// Ollama streaming
async function streamOllama(prompt, res) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: true
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        try {
          const data = JSON.parse(line)
          if (data.response) {
            fullText += data.response
            // Check for complete questions (ending with ?)
            const questions = fullText.split('\n').filter(q => q.trim().endsWith('?'))
            const sentCount = res.sentQuestions || 0
            for (let i = sentCount; i < questions.length; i++) {
              res.write(`data: ${JSON.stringify({ question: questions[i].trim() })}\n\n`)
            }
            res.sentQuestions = questions.length
          }
        } catch (e) {
          // Skip parse errors
        }
      }
    }
  }

  // Send any remaining questions
  const finalQuestions = fullText.split('\n').filter(q => q.trim())
  const sentCount = res.sentQuestions || 0
  for (let i = sentCount; i < finalQuestions.length; i++) {
    if (finalQuestions[i].trim()) {
      res.write(`data: ${JSON.stringify({ question: finalQuestions[i].trim() })}\n\n`)
    }
  }
}

// OpenAI-compatible streaming (LM Studio, LocalAI, vLLM, etc.)
async function streamOpenAI(prompt, res) {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.OPENAI_API_KEY && { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` })
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      max_tokens: 300
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI-compatible API error: ${response.status} ${response.statusText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentQuestion = ''

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
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            for (const char of content) {
              if (char === '\n') {
                if (currentQuestion.trim()) {
                  res.write(`data: ${JSON.stringify({ question: currentQuestion.trim() })}\n\n`)
                }
                currentQuestion = ''
              } else {
                currentQuestion += char
              }
            }
          }
        } catch (e) {
          // Skip parse errors
        }
      }
    }
  }

  if (currentQuestion.trim()) {
    res.write(`data: ${JSON.stringify({ question: currentQuestion.trim() })}\n\n`)
  }
}

app.post('/api/generate', async (req, res) => {
  const { notes, activeNoteId } = req.body

  if (!notes || !activeNoteId) {
    return res.status(400).json({ error: 'Missing notes or activeNoteId' })
  }

  const prompt = buildPrompt(notes, activeNoteId)

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    switch (LLM_PROVIDER) {
      case 'anthropic':
        await streamAnthropic(prompt, res)
        break
      case 'ollama':
        await streamOllama(prompt, res)
        break
      case 'openai':
        await streamOpenAI(prompt, res)
        break
      default:
        throw new Error(`Unknown LLM provider: ${LLM_PROVIDER}`)
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (error) {
    console.error(`Error calling ${LLM_PROVIDER}:`, error)
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
    res.end()
  }
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: LLM_PROVIDER,
    model: LLM_PROVIDER === 'anthropic' ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514') :
           LLM_PROVIDER === 'ollama' ? OLLAMA_MODEL : OPENAI_MODEL
  })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
