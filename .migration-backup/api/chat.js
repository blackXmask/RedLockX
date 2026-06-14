// @ts-check

const HYBRID_BASE =
  process.env.HYBRID_SPACE_URL ??
  'https://blackxmask-redlockx-hybrid-prompt-detector-space-v2.hf.space'
const ML_BASE =
  process.env.ML_SPACE_URL ??
  'https://blackxmask-redlockx-ml-deberta-v3-prompt-detector-space.hf.space'

// ─── Gradio SSE helper ────────────────────────────────────────────────────────

async function gradioCall(baseUrl, fn, data) {
  const postRes = await fetch(`${baseUrl}/gradio_api/call/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!postRes.ok) throw new Error(`Gradio submit failed: ${postRes.status}`)

  const { event_id } = await postRes.json()
  const sseRes = await fetch(`${baseUrl}/gradio_api/call/${fn}/${event_id}`, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!sseRes.ok || !sseRes.body) throw new Error(`Gradio stream failed: ${sseRes.status}`)

  const reader = sseRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastEventName = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        lastEventName = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim()
        if (lastEventName === 'complete') {
          const result = JSON.parse(raw)
          reader.cancel()
          return result
        } else if (lastEventName === 'error') {
          throw new Error(`Gradio error: ${raw}`)
        }
      }
    }
  }
  throw new Error('Gradio stream ended without a complete event')
}

// ─── Simulation fallback ──────────────────────────────────────────────────────

const INJECTION_KEYWORDS = [
  'ignore previous', 'ignore all', 'disregard', 'forget your', 'you are now', 'act as',
  'pretend you', 'system prompt', 'jailbreak', 'dan mode', 'developer mode', 'override',
  'bypass', 'sudo', 'admin mode', 'base64', '\\x', 'unicode escape',
]

function simulateHybrid(prompt) {
  const lower = prompt.toLowerCase()
  const matches = INJECTION_KEYWORDS.filter((kw) => lower.includes(kw))
  const riskPercent = Math.min(99, matches.length * 25 + (matches.length > 0 ? 30 : 5))
  const isSafe = matches.length === 0
  return { verdictStr: isSafe ? 'SAFE' : 'MALICIOUS', riskPercent, isSafe }
}

function simulateMl(prompt) {
  const lower = prompt.toLowerCase()
  const matches = INJECTION_KEYWORDS.filter((kw) => lower.includes(kw))
  if (matches.length === 0) return { status: 'SAFE', confidence: 0.95 }
  const attackLabel = lower.includes('base64') || lower.includes('\\x') || lower.includes('unicode')
    ? 'obfuscation_attack'
    : lower.includes('act as') || lower.includes('pretend') || lower.includes('dan')
    ? 'jailbreak_attempt'
    : lower.includes('ignore') || lower.includes('disregard') || lower.includes('forget')
    ? 'direct_injection'
    : 'indirect_injection'
  return {
    status: 'DANGEROUS',
    confidence: Math.min(0.99, 0.7 + matches.length * 0.1),
    attack_type: { label: attackLabel, score: Math.min(0.99, 0.65 + matches.length * 0.1) },
    trigger_words: matches.slice(0, 3),
  }
}

// ─── HuggingFace space callers ────────────────────────────────────────────────

async function callHybridSpace(prompt) {
  const result = await gradioCall(HYBRID_BASE, 'detect', [prompt])
  const verdictStr = String(result[0] ?? '')
  const riskStr = String(result[1] ?? '0')
  const riskMatch = riskStr.match(/[\d.]+/)
  const riskPercent = riskMatch ? parseFloat(riskMatch[0]) : 0
  const isSafe = !verdictStr.toUpperCase().includes('MALICIOUS')
  return { verdictStr, riskPercent, isSafe }
}

async function callMlSpace(prompt) {
  const result = await gradioCall(ML_BASE, 'detect', [prompt])
  const raw = result[1] ?? result[0] ?? '{}'
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

// ─── Firewall analysis using real HF spaces ───────────────────────────────────

async function buildAnalysis(prompt) {
  const [hybrid, ml] = await Promise.all([
    callHybridSpace(prompt).catch((err) => {
      console.warn('Hybrid space unavailable, using simulation:', err.message)
      return simulateHybrid(prompt)
    }),
    callMlSpace(prompt).catch((err) => {
      console.warn('ML space unavailable, using simulation:', err.message)
      return simulateMl(prompt)
    }),
  ])

  const isAttack = !hybrid.isSafe || ml.status === 'DANGEROUS'
  const verdict = isAttack ? 'BLOCK' : 'ALLOW'
  const mlConf = ml.confidence ?? ml.binary_confidence ?? 0
  const mlWeight = ml.status === 'DANGEROUS' ? mlConf : 0
  const riskScore = Math.min(100, Math.max(0, 0.6 * hybrid.riskPercent + 0.4 * mlWeight * 100))
  const attackLabel = ml.attack_type?.label?.replace(/_/g, ' ') ?? 'unknown pattern'
  const attackScore = ml.attack_type?.score ?? 0
  const triggerWords = ml.trigger_words?.join(', ')

  let explanation
  if (verdict === 'BLOCK') {
    explanation = `Blocked: ${hybrid.riskPercent.toFixed(1)}% injection risk, ML: DANGEROUS (${(mlConf * 100).toFixed(1)}% conf). Pattern: ${attackLabel} (${(attackScore * 100).toFixed(1)}% match)${triggerWords ? `. Triggers: ${triggerWords}` : ''}.`
  } else {
    explanation = `Safe: ${hybrid.riskPercent.toFixed(1)}% risk, ML: SAFE (${(mlConf * 100).toFixed(1)}% conf).`
  }

  return {
    verdict,
    riskScore,
    isSafe: !isAttack,
    attackType: isAttack ? (ml.attack_type?.label ?? 'prompt_injection') : null,
    hybridProbability: hybrid.riskPercent / 100,
    mlStatus: ml.status,
    mlConfidence: mlConf,
    explanation,
    source: 'hf',
  }
}

async function callLlm(settings, history, message) {
  if (settings.provider === 'gemini') {
    const contents = [
      ...history.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.api_key}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 1500, temperature: 0.7 } }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!r.ok) throw new Error(`Gemini error ${r.status}`)
    const data = await r.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no response)'
  }

  const baseUrl = settings.provider === 'openai'
    ? 'https://api.openai.com/v1'
    : settings.provider === 'groq'
    ? 'https://api.groq.com/openai/v1'
    : settings.base_url ?? 'https://api.openai.com/v1'

  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant. This conversation is monitored by a prompt injection firewall — only safe, benign requests reach you.' },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]
  const r = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.api_key}` },
    body: JSON.stringify({ model: settings.model, messages, max_tokens: 1500, temperature: 0.7 }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!r.ok) throw new Error(`LLM error ${r.status}`)
  const data = await r.json()
  return data.choices?.[0]?.message?.content ?? '(no response)'
}

function makeSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, history = [], sessionId: reqSessionId } = req.body ?? {}
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' })
  }

  const sessionId = reqSessionId ?? makeSessionId()

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Database not configured' })
  }

  const base = SUPABASE_URL.replace(/\/$/, '')
  const h = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }

  const settingsRes = await fetch(`${base}/rest/v1/llm_settings?select=*&limit=1&order=id.desc`, { headers: h })
  const settingsRows = settingsRes.ok ? await settingsRes.json() : []
  if (!settingsRows.length) {
    return res.status(503).json({ error: 'No LLM configured. Add your API key in Settings first.' })
  }
  const settings = settingsRows[0]

  const analysis = await buildAnalysis(message)
  const createdAt = new Date().toISOString()

  const logRes = await fetch(`${base}/rest/v1/analysis_logs`, {
    method: 'POST',
    headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify({
      prompt: message,
      verdict: analysis.verdict,
      risk_score: analysis.riskScore,
      is_safe: analysis.isSafe,
      attack_type: analysis.attackType,
      hybrid_probability: analysis.hybridProbability,
      ml_status: analysis.mlStatus,
      ml_confidence: analysis.mlConfidence,
      explanation: analysis.explanation,
    }),
  })
  const logRows = logRes.ok ? await logRes.json() : []
  const logId = (Array.isArray(logRows) ? logRows[0]?.id : logRows?.id) ?? 0

  const analysisResult = { id: logId, ...analysis, createdAt }

  if (analysis.verdict === 'BLOCK') {
    await fetch(`${base}/rest/v1/chat_messages`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ session_id: sessionId, role: 'user', content: message, verdict: 'BLOCK', risk_score: analysis.riskScore, is_blocked: true, blocked_reason: analysis.explanation }),
    }).catch(() => {})
    return res.status(200).json({ blocked: true, sessionId, reply: null, analysis: analysisResult })
  }

  let reply
  try {
    reply = await callLlm(settings, history, message)
  } catch (e) {
    console.error('LLM call failed', e)
    return res.status(502).json({ error: `LLM call failed: ${e.message}` })
  }

  await fetch(`${base}/rest/v1/chat_messages`, {
    method: 'POST',
    headers: { ...h, Prefer: 'return=minimal' },
    body: JSON.stringify([
      { session_id: sessionId, role: 'user', content: message, verdict: 'ALLOW', risk_score: analysis.riskScore, is_blocked: false },
      { session_id: sessionId, role: 'assistant', content: reply, is_blocked: false },
    ]),
  }).catch(() => {})

  return res.status(200).json({ blocked: false, sessionId, reply, analysis: analysisResult })
}
