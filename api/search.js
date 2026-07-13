export const config = { api: { bodyParser: true } };

// Реальный веб-поиск через Tavily.
// Возвращает сырые выдержки с URL — их кладём в промпт модуля,
// модель работает ТОЛЬКО с переданным материалом (антигаллюцинационный пайплайн).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const appPassword = process.env.APP_PASSWORD;
  if (appPassword && req.headers['x-app-key'] !== appPassword) {
    return res.status(401).json({ error: { message: 'Unauthorized', code: 'bad_app_key' } });
  }

  if (!process.env.TAVILY_API_KEY) {
    return res.status(503).json({ error: { message: 'Search is not configured (TAVILY_API_KEY missing)', code: 'search_unconfigured' } });
  }

  const { query, max_results, depth, days, include_domains } = req.body || {};
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: { message: 'query is required', code: 'bad_request' } });
  }

  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: depth === 'advanced' ? 'advanced' : 'basic',
        max_results: Math.min(Number(max_results) || 8, 20),
        ...(days ? { days: Number(days) } : {}),
        ...(Array.isArray(include_domains) && include_domains.length ? { include_domains } : {}),
        include_answer: false,
        include_raw_content: false,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: { message: data?.detail || 'Tavily error' } });

    // Приводим к компактному виду для промптов: только то, что нужно модели
    const results = (data.results || []).map(x => ({
      title: x.title,
      url: x.url,
      content: x.content,
      score: x.score,
      published_date: x.published_date || null,
    }));
    res.status(200).json({ query, results });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
