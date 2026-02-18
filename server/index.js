import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Provider configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama'
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'http://localhost:1234/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'local-model'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

// Rate limiting config
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '0', 10) // 0 = unlimited
const isLocalProvider = LLM_PROVIDER === 'ollama'

// Initialize provider clients
let anthropic = null
if (LLM_PROVIDER === 'anthropic') {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

let genAI = null
let geminiModel = null
if (LLM_PROVIDER === 'gemini') {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  geminiModel = genAI.getGenerativeModel({ model: GEMINI_MODEL })
}

// --- Request logging & stats ---
const requestLog = [] // recent requests, capped at 100
const MAX_LOG_SIZE = 100

function logRequest(entry) {
  requestLog.push(entry)
  if (requestLog.length > MAX_LOG_SIZE) {
    requestLog.shift()
  }
  const status = entry.error ? `ERROR: ${entry.error}` : `OK (${entry.questionsGenerated} questions)`
  console.log(
    `[${entry.timestamp}] ${entry.provider}/${entry.model} | ${entry.durationMs}ms | ${status} | entries: ${entry.threadEntries}`
  )
}

// --- FIFO request queue ---
// Only one LLM request runs at a time. New requests wait in line.
let requestChain = Promise.resolve()
let queueDepth = 0

// --- Rate limiting ---
const requestTimestamps = []

function checkRateLimit() {
  if (RATE_LIMIT_RPM <= 0 || isLocalProvider) return null

  const now = Date.now()
  // Prune timestamps older than 60s
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift()
  }

  if (requestTimestamps.length >= RATE_LIMIT_RPM) {
    const oldestInWindow = requestTimestamps[0]
    const retryAfter = Math.ceil((oldestInWindow + 60000 - now) / 1000)
    return retryAfter
  }

  requestTimestamps.push(now)
  return null
}

function getModelName() {
  switch (LLM_PROVIDER) {
    case 'anthropic': return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    case 'ollama': return OLLAMA_MODEL
    case 'openai': return OPENAI_MODEL
    case 'gemini': return GEMINI_MODEL
    default: return 'unknown'
  }
}

console.log(`Using LLM provider: ${LLM_PROVIDER} (${getModelName()})`)
if (RATE_LIMIT_RPM > 0 && !isLocalProvider) {
  console.log(`Rate limit: ${RATE_LIMIT_RPM} requests/minute`)
} else if (isLocalProvider) {
  console.log(`Rate limit: disabled (local provider)`)
} else {
  console.log(`Rate limit: unlimited`)
}

// Build the prompt from thread state
function buildPrompt(entries, activeEntryId) {
  const activeEntry = entries.find(e => e.id === activeEntryId)
  const otherEntries = entries.filter(e => e.id !== activeEntryId)

  let threadContext = ''
  if (otherEntries.length > 0) {
    threadContext = '\nThread history (background context only):\n'
    for (const entry of otherEntries) {
      if (entry.inspiredBy) {
        threadContext += `  [inspired by: "${entry.inspiredBy}"]\n`
      }
      threadContext += `  "${entry.content}"\n`
      if (entry.questions && entry.questions.length > 0) {
        entry.questions.forEach(q => {
          threadContext += `    - ${q}\n`
        })
      }
    }
  }

  // Collect all previous questions to avoid repetition
  const allPreviousQuestions = entries
    .flatMap(e => e.questions || [])
    .filter(q => q)

  let noRepeatClause = ''
  if (allPreviousQuestions.length > 0) {
    noRepeatClause = `\nDo NOT repeat or closely paraphrase any of these previous questions:\n${allPreviousQuestions.map(q => `- ${q}`).join('\n')}\n`
  }

  return `You are a lateral thinking partner. The user is brainstorming and just wrote this:

"${activeEntry?.content || ''}"${activeEntry?.inspiredBy ? `\n(This was inspired by the question: "${activeEntry.inspiredBy}")` : ''}
${threadContext}
Generate 2-3 short questions that:
- Challenge assumptions or push sideways on what the user just wrote
- Surface hidden contradictions or unstated premises in this specific thought
- Occasionally connect to the thread history, but primarily engage with the current thought

Focus on the current thought. The thread history is background — don't let it dominate.
${noRepeatClause}
Return only the questions, one per line. No numbering, no preamble.`
}

// Anthropic streaming
async function streamAnthropic(prompt, res) {
  const stream = await anthropic.messages.stream({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  })

  let currentQuestion = ''
  let questionCount = 0

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      const text = event.delta.text
      for (const char of text) {
        if (char === '\n') {
          if (currentQuestion.trim()) {
            res.write(`data: ${JSON.stringify({ question: currentQuestion.trim() })}\n\n`)
            questionCount++
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
    questionCount++
  }

  return questionCount
}

// Gemini streaming
async function streamGemini(prompt, res) {
  const result = await geminiModel.generateContentStream(prompt)

  let currentQuestion = ''
  let questionCount = 0

  for await (const chunk of result.stream) {
    const text = chunk.text()
    if (text) {
      for (const char of text) {
        if (char === '\n') {
          if (currentQuestion.trim()) {
            res.write(`data: ${JSON.stringify({ question: currentQuestion.trim() })}\n\n`)
            questionCount++
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
    questionCount++
  }

  return questionCount
}

// Ollama streaming
async function streamOllama(prompt, res) {
  // Ollama can be slow to load models — give it up to 2 minutes for headers
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: true
    }),
    signal: AbortSignal.timeout(120000)
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let questionCount = 0

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
            const questions = fullText.split('\n').filter(q => q.trim().endsWith('?'))
            const sentCount = res.sentQuestions || 0
            for (let i = sentCount; i < questions.length; i++) {
              res.write(`data: ${JSON.stringify({ question: questions[i].trim() })}\n\n`)
              questionCount++
            }
            res.sentQuestions = questions.length
          }
        } catch (e) {
          // Skip parse errors
        }
      }
    }
  }

  const finalQuestions = fullText.split('\n').filter(q => q.trim())
  const sentCount = res.sentQuestions || 0
  for (let i = sentCount; i < finalQuestions.length; i++) {
    if (finalQuestions[i].trim()) {
      res.write(`data: ${JSON.stringify({ question: finalQuestions[i].trim() })}\n\n`)
      questionCount++
    }
  }

  return questionCount
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
  let questionCount = 0

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
                  questionCount++
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
    questionCount++
  }

  return questionCount
}

// Process a single generation request (called from FIFO queue)
async function processGeneration(entries, activeEntryId, res) {
  // Rate limiting
  const retryAfter = checkRateLimit()
  if (retryAfter !== null) {
    console.log(`[RATE LIMITED] Retry after ${retryAfter}s (${requestTimestamps.length}/${RATE_LIMIT_RPM} in window)`)
    res.write(`data: ${JSON.stringify({ error: 'Rate limited', retryAfter })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()

    logRequest({
      timestamp: new Date().toISOString(),
      provider: LLM_PROVIDER,
      model: getModelName(),
      threadEntries: entries.length,
      durationMs: 0,
      questionsGenerated: 0,
      error: `Rate limited (retry in ${retryAfter}s)`
    })
    return
  }

  const prompt = buildPrompt(entries, activeEntryId)
  const startTime = Date.now()

  try {
    let questionCount = 0

    switch (LLM_PROVIDER) {
      case 'anthropic':
        questionCount = await streamAnthropic(prompt, res)
        break
      case 'gemini':
        questionCount = await streamGemini(prompt, res)
        break
      case 'ollama':
        questionCount = await streamOllama(prompt, res)
        break
      case 'openai':
        questionCount = await streamOpenAI(prompt, res)
        break
      default:
        throw new Error(`Unknown LLM provider: ${LLM_PROVIDER}`)
    }

    res.write('data: [DONE]\n\n')
    res.end()

    logRequest({
      timestamp: new Date().toISOString(),
      provider: LLM_PROVIDER,
      model: getModelName(),
      threadEntries: entries.length,
      durationMs: Date.now() - startTime,
      questionsGenerated: questionCount,
      error: null
    })
  } catch (error) {
    console.error(`Error calling ${LLM_PROVIDER}:`, error)
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
    res.end()

    logRequest({
      timestamp: new Date().toISOString(),
      provider: LLM_PROVIDER,
      model: getModelName(),
      threadEntries: entries.length,
      durationMs: Date.now() - startTime,
      questionsGenerated: 0,
      error: error.message
    })
  }
}

app.post('/api/generate', (req, res) => {
  const { entries, activeEntryId } = req.body

  if (!entries || !activeEntryId) {
    return res.status(400).json({ error: 'Missing entries or activeEntryId' })
  }

  // Set up SSE headers immediately so the client gets a connection
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Queue this request — it waits for any in-flight request to finish first
  queueDepth++
  const position = queueDepth

  if (position > 1) {
    console.log(`[QUEUE] Request queued at position #${position}`)
    res.write(`data: ${JSON.stringify({ queued: true, position })}\n\n`)
  }

  requestChain = requestChain
    .then(() => {
      if (position > 1) {
        console.log(`[QUEUE] Processing queued request #${position}`)
      }
      return processGeneration(entries, activeEntryId, res)
    })
    .catch((error) => {
      // Safety net — should not reach here since processGeneration handles its own errors
      console.error('Unexpected queue error:', error)
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: 'Internal error' })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
    })
    .finally(() => {
      queueDepth--
    })
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: LLM_PROVIDER,
    model: getModelName(),
    isLocal: isLocalProvider,
    rateLimit: isLocalProvider ? null : (RATE_LIMIT_RPM > 0 ? RATE_LIMIT_RPM : null)
  })
})

// Stats endpoint for developer observability
app.get('/api/stats', (req, res) => {
  const now = Date.now()
  const lastMinute = requestLog.filter(r => new Date(r.timestamp).getTime() > now - 60000)
  const lastHour = requestLog.filter(r => new Date(r.timestamp).getTime() > now - 3600000)

  res.json({
    provider: LLM_PROVIDER,
    model: getModelName(),
    queue: {
      depth: queueDepth
    },
    rateLimit: {
      rpm: RATE_LIMIT_RPM || 'unlimited',
      currentWindowCount: requestTimestamps.length,
      isLocal: isLocalProvider
    },
    lastMinute: {
      requests: lastMinute.length,
      errors: lastMinute.filter(r => r.error).length,
      avgDurationMs: lastMinute.length > 0
        ? Math.round(lastMinute.reduce((s, r) => s + r.durationMs, 0) / lastMinute.length)
        : 0
    },
    lastHour: {
      requests: lastHour.length,
      errors: lastHour.filter(r => r.error).length,
      avgDurationMs: lastHour.length > 0
        ? Math.round(lastHour.reduce((s, r) => s + r.durationMs, 0) / lastHour.length)
        : 0
    },
    recentRequests: requestLog.slice(-20).reverse()
  })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
