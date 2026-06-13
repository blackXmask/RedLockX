// @ts-check

function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'count=exact',
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

  const base = SUPABASE_URL.replace(/\/$/, '')
  const h = supabaseHeaders(SUPABASE_SERVICE_ROLE_KEY)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  try {
    const [totalRes, blockedRes, todayRes, todayBlockedRes, riskRes] = await Promise.all([
      fetch(`${base}/rest/v1/analysis_logs?select=id&limit=0`, { headers: h }),
      fetch(`${base}/rest/v1/analysis_logs?select=id&verdict=eq.BLOCK&limit=0`, { headers: h }),
      fetch(`${base}/rest/v1/analysis_logs?select=id&created_at=gte.${todayIso}&limit=0`, { headers: h }),
      fetch(`${base}/rest/v1/analysis_logs?select=id&verdict=eq.BLOCK&created_at=gte.${todayIso}&limit=0`, { headers: h }),
      fetch(`${base}/rest/v1/analysis_logs?select=risk_score&limit=500&order=created_at.desc`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      }),
    ])

    const totalAnalyzed = parseCount(totalRes.headers.get('Content-Range'))
    const totalBlocked = parseCount(blockedRes.headers.get('Content-Range'))
    const totalAllowed = totalAnalyzed - totalBlocked
    const todayAnalyzed = parseCount(todayRes.headers.get('Content-Range'))
    const todayBlocked = parseCount(todayBlockedRes.headers.get('Content-Range'))
    const blockRate = totalAnalyzed > 0 ? (totalBlocked / totalAnalyzed) * 100 : 0

    let avgRiskScore = 0
    if (riskRes.ok) {
      const riskRows = await riskRes.json()
      if (riskRows.length > 0) {
        avgRiskScore = riskRows.reduce((sum, r) => sum + (r.risk_score ?? 0), 0) / riskRows.length
      }
    }

    return res.status(200).json({
      totalAnalyzed,
      totalBlocked,
      totalAllowed,
      blockRate,
      avgRiskScore,
      todayAnalyzed,
      todayBlocked,
    })
  } catch (e) {
    console.error('stats error', e)
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
}
