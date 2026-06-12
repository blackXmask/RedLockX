// @ts-check

function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Database not configured' })
  }

  const base = SUPABASE_URL.replace(/\/$/, '')
  const h = supabaseHeaders(SUPABASE_SERVICE_ROLE_KEY)

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${base}/rest/v1/llm_settings?select=*&limit=1&order=id.desc`, { headers: h })
      if (!r.ok) return res.status(502).json({ error: 'Database error' })
      const rows = await r.json()
      if (!rows.length) return res.status(404).json({ error: 'No LLM settings configured' })
      const s = rows[0]
      return res.status(200).json({
        provider: s.provider,
        model: s.model,
        hasApiKey: Boolean(s.api_key),
        baseUrl: s.base_url ?? null,
      })
    } catch (e) {
      return res.status(500).json({ error: 'Failed to retrieve settings' })
    }
  }

  if (req.method === 'POST') {
    const { provider, apiKey, model, baseUrl } = req.body ?? {}
    if (!provider || !apiKey || !model) {
      return res.status(400).json({ error: 'provider, apiKey, and model are required' })
    }
    if (!['openai', 'groq', 'gemini', 'custom'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' })
    }

    try {
      const existRes = await fetch(`${base}/rest/v1/llm_settings?select=id&limit=1&order=id.desc`, { headers: h })
      const existing = existRes.ok ? await existRes.json() : []

      let saved
      if (existing.length > 0) {
        const upRes = await fetch(
          `${base}/rest/v1/llm_settings?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: { ...h, Prefer: 'return=representation' },
            body: JSON.stringify({ provider, api_key: apiKey, model, base_url: baseUrl ?? null }),
          }
        )
        const rows = await upRes.json()
        saved = Array.isArray(rows) ? rows[0] : rows
      } else {
        const insRes = await fetch(`${base}/rest/v1/llm_settings`, {
          method: 'POST',
          headers: { ...h, Prefer: 'return=representation' },
          body: JSON.stringify({ provider, api_key: apiKey, model, base_url: baseUrl ?? null }),
        })
        const rows = await insRes.json()
        saved = Array.isArray(rows) ? rows[0] : rows
      }

      if (!saved) return res.status(500).json({ error: 'Failed to save settings' })
      return res.status(200).json({
        provider: saved.provider,
        model: saved.model,
        hasApiKey: true,
        baseUrl: saved.base_url ?? null,
      })
    } catch (e) {
      console.error('settings error', e)
      return res.status(500).json({ error: 'Failed to save settings' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
