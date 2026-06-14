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
  // result[0] = verdict string e.g. "🟥 MALICIOUS (Prompt Injection Detected)"
  // result[1] = risk % string e.g. "100.00%"
  const verdictStr = String(result[0] ?? '')
  const riskStr = String(result[1] ?? '0')
  const riskMatch = riskStr.match(/[\d.]+/)
  const riskPercent = riskMatch ? parseFloat(riskMatch[0]) : 0
  const isSafe = !verdictStr.toUpperCase().includes('MALICIOUS')
  return { verdictStr, riskPercent, isSafe }
}

async function callMlSpace(prompt) {
  const result = await gradioCall(ML_BASE, 'detect', [prompt])
  // result[0] = empty string, result[1] = JSON string, result[2] = HTML string
  const raw = result[1] ?? result[0] ?? '{}'
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

// ─── Decision logic ───────────────────────────────────────────────────────────

function decision(hybrid, ml) {
  const isAttack = !hybrid.isSafe || ml.status === 'DANGEROUS'
  const verdict = isAttack ? 'BLOCK' : 'ALLOW'
  const mlWeight = ml.status === 'DANGEROUS' ? (ml.confidence ?? 0) : 0
  const riskScore = Math.min(100, Math.max(0, 0.6 * hybrid.riskPercent + 0.4 * mlWeight * 100))
  const attackLabel = ml.attack_type?.label?.replace(/_/g, ' ') ?? 'unknown pattern'
  const attackScore = ml.attack_type?.score ?? 0
  const triggerWords = ml.trigger_words?.join(', ')
  const mlConf = ml.confidence ?? ml.binary_confidence ?? 0

  let explanation
  if (verdict === 'BLOCK') {
    explanation = `This prompt was flagged as malicious. The hybrid model detected a ${hybrid.riskPercent.toFixed(1)}% injection risk, and the DeBERTa model classified it as DANGEROUS with ${(mlConf * 100).toFixed(1)}% confidence. Primary attack pattern: ${attackLabel} (${(attackScore * 100).toFixed(1)}% match).`
    if (triggerWords) explanation += ` Trigger words detected: ${triggerWords}.`
  } else {
    explanation = `This prompt appears safe. The hybrid model detected a low injection risk of ${hybrid.riskPercent.toFixed(1)}%, and the DeBERTa model classified it as SAFE with ${(mlConf * 100).toFixed(1)}% confidence. No significant injection patterns were detected.`
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

// ─── Supabase logger ──────────────────────────────────────────────────────────

async function insertLog(supabaseUrl, serviceKey, prompt, result) {
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/analysis_logs`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        prompt,
        verdict: result.verdict,
        risk_score: result.riskScore,
        is_safe: result.isSafe,
        attack_type: result.attackType,
        hybrid_probability: result.hybridProbability,
        ml_status: result.mlStatus,
        ml_confidence: result.mlConfidence,
        explanation: result.explanation,
      }),
    })
    if (res.ok) {
      const rows = await res.json()
      return Array.isArray(rows) ? rows[0] : rows
    }
  } catch (e) {
    console.error('supabase insert error', e)
  }
  return null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' })
  }

  // Run both HF spaces in parallel, fall back to simulation on error
  const [hybridResult, mlResult] = await Promise.all([
    callHybridSpace(prompt).catch((err) => {
      console.warn('Hybrid space unavailable, using simulation:', err.message)
      return { ...simulateHybrid(prompt), source: 'simulation' }
    }),
    callMlSpace(prompt).catch((err) => {
      console.warn('ML space unavailable, using simulation:', err.message)
      return simulateMl(prompt)
    }),
  ])

  const final = decision(hybridResult, mlResult)

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  let id = 0
  let createdAt = new Date().toISOString()

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const row = await insertLog(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, prompt, final)
    if (row) {
      id = row.id ?? 0
      createdAt = row.created_at ?? createdAt
    }
  }

  return res.status(200).json({ id, ...final, createdAt })
}
