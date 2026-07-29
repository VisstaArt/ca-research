export const config = { api: { bodyParser: true } };

// Реальная частотность запросов для M7 (SEO) — Yandex Wordstat API (Yandex Cloud
// Search API / AI Studio). Раньше M7 честно писал «не замерено» почти везде,
// т.к. Tavily не измеряет Wordstat; теперь есть реальный источник чисел.
// Тот же стиль, что proxy.js/search.js: голый fetch, без SDK.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const appPassword = process.env.APP_PASSWORD;
  if (appPassword && req.headers['x-app-key'] !== appPassword) {
    return res.status(401).json({ error: { message: 'Unauthorized', code: 'bad_app_key' } });
  }

  const YA_KEY = process.env.YANDEX_API_KEY;
  const YA_FOLDER = process.env.YANDEX_FOLDER_ID;
  if (!YA_KEY || !YA_FOLDER) {
    // M7 трактует это как «данных нет» и продолжает честно писать «не замерено».
    return res.status(503).json({ error: { message: 'Wordstat is not configured', code: 'wordstat_unconfigured' } });
  }

  const { phrase, numPhrases, regions } = req.body || {};
  if (!phrase || typeof phrase !== 'string') {
    return res.status(400).json({ error: { message: 'phrase is required' } });
  }

  try {
    const r = await fetch('https://searchapi.api.cloud.yandex.net/v2/wordstat/topRequests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Api-Key ' + YA_KEY,
      },
      body: JSON.stringify({
        phrase: phrase.slice(0, 400),
        numPhrases: Math.min(Number(numPhrases) || 20, 2000),
        folderId: YA_FOLDER,
        ...(Array.isArray(regions) && regions.length ? { regions } : {}),
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: { message: data?.message || 'Wordstat error' } });

    // count приходит строкой (протобуф int64) — приводим к числу один раз здесь,
    // дальше по коду частотность везде ожидается числом.
    const toNum = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    res.status(200).json({
      totalCount: toNum(data.totalCount),
      results: (data.results || []).map(x => ({ phrase: x.phrase, count: toNum(x.count) })),
      associations: (data.associations || []).map(x => ({ phrase: x.phrase, count: toNum(x.count) })),
    });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
