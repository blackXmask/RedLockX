// @ts-check

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

  try {
    const logsRes = await fetch(
      `${base}/rest/v1/analysis_logs?select=attack_type&verdict=eq.BLOCK&attack_type=not.is.null&limit=1000&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )

    if (!logsRes.ok) {
      return res.status(502).json({ error: 'Database error' })
    }

    const rows = await logsRes.json()

    const counts = {}
    for (const row of rows) {
      const key = row.attack_type ?? 'unknown'
      counts[key] = (counts[key] ?? 0) + 1
    }

    const result = Object.entries(counts)
      .map(([attackType, count]) => ({ attackType, count }))
      .sort((a, b) => b.count - a.count)

    return res.status(200).json(result)
  } catch (e) {
    console.error('attack-types error', e)
    return res.status(500).json({ error: 'Failed to fetch attack types' })
  }
}
