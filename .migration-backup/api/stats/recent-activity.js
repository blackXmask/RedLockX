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

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  try {
    const logsRes = await fetch(
      `${base}/rest/v1/analysis_logs?select=verdict,created_at&created_at=gte.${sevenDaysAgo.toISOString()}&limit=2000&order=created_at.asc`,
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

    const byDay = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      byDay[key] = { date: key, analyzed: 0, blocked: 0, allowed: 0 }
    }

    for (const row of rows) {
      const key = row.created_at?.slice(0, 10)
      if (key && byDay[key]) {
        byDay[key].analyzed++
        if (row.verdict === 'BLOCK') byDay[key].blocked++
        else byDay[key].allowed++
      }
    }

    return res.status(200).json(Object.values(byDay))
  } catch (e) {
    console.error('recent-activity error', e)
    return res.status(500).json({ error: 'Failed to fetch recent activity' })
  }
}
