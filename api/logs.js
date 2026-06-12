// @ts-check

function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

function parseCount(contentRange) {
  if (!contentRange) return 0
  const match = contentRange.match(/\/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Database not configured' })
  }

  const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200)
  const offset = parseInt(req.query.offset ?? '0', 10)
  const verdict = req.query.verdict

  const base = SUPABASE_URL.replace(/\/$/, '')
  const headers = { ...supabaseHeaders(SUPABASE_SERVICE_ROLE_KEY), Prefer: 'count=exact' }

  let filter = `select=id,prompt,verdict,risk_score,is_safe,attack_type,hybrid_probability,ml_status,ml_confidence,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`
  if (verdict === 'BLOCK' || verdict === 'ALLOW') {
    filter += `&verdict=eq.${verdict}`
  }

  try {
    const [logsRes, countRes] = await Promise.all([
      fetch(`${base}/rest/v1/analysis_logs?${filter}`, { headers }),
      fetch(`${base}/rest/v1/analysis_logs?select=id&limit=0${verdict === 'BLOCK' || verdict === 'ALLOW' ? `&verdict=eq.${verdict}` : ''}`, { headers }),
    ])

    if (!logsRes.ok) {
      const err = await logsRes.text()
      return res.status(502).json({ error: `Database error: ${err}` })
    }

    const rows = await logsRes.json()
    const total = parseCount(countRes.headers.get('Content-Range'))

    return res.status(200).json({
      logs: rows.map((r) => ({
        id: r.id,
        prompt: r.prompt,
        verdict: r.verdict,
        riskScore: r.risk_score,
        isSafe: r.is_safe,
        attackType: r.attack_type,
        hybridProbability: r.hybrid_probability,
        mlStatus: r.ml_status,
        mlConfidence: r.ml_confidence,
        createdAt: r.created_at,
      })),
      total,
    })
  } catch (e) {
    console.error('logs error', e)
    return res.status(500).json({ error: 'Failed to fetch logs' })
  }
}
