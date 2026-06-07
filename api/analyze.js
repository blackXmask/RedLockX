async function simulateHybrid(prompt) {
  const INJECTION_KEYWORDS = [
    'ignore previous', 'ignore all', 'disregard', 'forget your', 'you are now', 'act as',
    'pretend you', 'system prompt', 'jailbreak', 'dan mode', 'developer mode', 'override',
    'bypass', 'sudo', 'admin mode', 'base64', '\\x', 'unicode escape',
  ]
  const lower = prompt.toLowerCase()
  const matches = INJECTION_KEYWORDS.filter((kw) => lower.includes(kw))
  const riskPercent = Math.min(99, matches.length * 25 + (matches.length > 0 ? 30 : 5))
  const isSafe = matches.length === 0
  return { verdictStr: isSafe ? 'SAFE' : 'MALICIOUS', riskPercent, isSafe }
}

async function simulateMl(prompt) {
  const INJECTION_KEYWORDS = [
    'ignore previous', 'ignore all', 'disregard', 'forget your', 'you are now', 'act as',
    'pretend you', 'system prompt', 'jailbreak', 'dan mode', 'developer mode', 'override',
    'bypass', 'sudo', 'admin mode', 'base64', '\\x', 'unicode escape',
  ]
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

function decision(hybrid, ml) {
  const isAttack = !hybrid.isSafe || ml.status === 'DANGEROUS'
  const verdict = isAttack ? 'BLOCK' : 'ALLOW'
  const mlWeight = ml.status === 'DANGEROUS' ? ml.confidence : 0
  const riskScore = Math.min(100, Math.max(0, 0.6 * hybrid.riskPercent + 0.4 * mlWeight * 100))
  const attackLabel = ml.attack_type?.label?.replace(/_/g, ' ') ?? 'unknown pattern'
  const attackScore = ml.attack_type?.score ?? 0
  const triggerWords = ml.trigger_words?.join(', ')
  let explanation
  if (verdict === 'BLOCK') {
    explanation = `This prompt was flagged as malicious. The hybrid model detected a ${hybrid.riskPercent.toFixed(1)}% injection risk, and the ML model classified it as DANGEROUS with ${(ml.confidence * 100).toFixed(1)}% confidence. Primary attack pattern: ${attackLabel} (${(attackScore * 100).toFixed(1)}% match).`
    if (triggerWords) explanation += ` Trigger words detected: ${triggerWords}.`
  } else {
    explanation = `This prompt appears safe. The hybrid model detected a low injection risk of ${hybrid.riskPercent.toFixed(1)}%, and the ML model classified it as SAFE with ${(ml.confidence * 100).toFixed(1)}% confidence. No significant injection patterns were detected.`
  }
  return {
    verdict,
    riskScore,
    isSafe: !isAttack,
    attackType: isAttack ? (ml.attack_type?.label ?? 'prompt_injection') : null,
    hybridProbability: hybrid.riskPercent / 100,
    mlStatus: ml.status,
    mlConfidence: ml.confidence,
    explanation,
  }
}

async function insertLogToSupabase(supabaseUrl, serviceKey, prompt, result) {
  try {
    const body = {
      prompt,
      verdict: result.verdict,
      risk_score: result.riskScore,
      attack_type: result.attackType,
      created_at: new Date().toISOString(),
    }
    await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/logs`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.error('supabase log error', e)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { prompt } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt is required' })
  const hybrid = await simulateHybrid(prompt)
  const ml = await simulateMl(prompt)
  const final = decision(hybrid, ml)
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    void insertLogToSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, prompt, final)
  }
  return res.status(200).json(final)
}
