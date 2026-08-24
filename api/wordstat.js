export const config = { api: { bodyParser: true } };

// Реальная частотность запросов для M7 (SEO) — Yandex Wordstat API (Yandex Cloud
// Search API / AI Studio). Раньше M7 честно писал «не замерено» почти везде,
// т.к. Tavily не измеряет Wordstat; теперь есть реальный источник чисел.
// Тот же стиль, что proxy.js/search.js: голый fetch, без SDK.
// Б1+Б2+Б3 (24.08.2026): общий APP_PASSWORD заменён на проверку JWT пользователя.
import { requireUser } from './_auth.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req, res);
  if (!auth) return;

  const YA_KEY = process.env.YANDEX_API_KEY;
  const YA_FOLDER = process.env.YANDEX_FOLDER_ID;
  if (!YA_KEY || !YA_FOLDER) {
    // M7 трактует это как «данных нет» и продолжает честно писать «не замерено».
    return res.status(503).json({ error: { message: 'Wordstat is not configured', code: 'wordstat_unconfigured' } });
  }

  const { phrase, numPhrases, regions, mode, period, fromDate, toDate } = req.body || {};
  if (!phrase || typeof phrase !== 'string') {
    return res.status(400).json({ error: { message: 'phrase is required' } });
  }

  // count приходит строкой (протобуф int64) — приводим к числу один раз здесь,
  // дальше по коду частотность везде ожидается числом.
  const toNum = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Api-Key ' + YA_KEY };

  try {
    if (mode === 'dynamics') {
      // Сезонность: частотность по месяцам за период — отдельный метод, не topRequests.
      if (!fromDate || !toDate) {
        return res.status(400).json({ error: { message: 'fromDate/toDate are required for mode=dynamics' } });
      }
      const r = await fetch('https://searchapi.api.cloud.yandex.net/v2/wordstat/dynamics', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phrase: phrase.slice(0, 400),
          period: period || 'PERIOD_MONTHLY',
          fromDate, toDate,
          folderId: YA_FOLDER,
          ...(Array.isArray(regions) && regions.length ? { regions } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        console.error('[wordstat/dynamics]', r.status, phrase, JSON.stringify(data));
        return res.status(r.status).json({ error: { message: data?.message || 'Wordstat error' } });
      }
      return res.status(200).json({
        results: (data.results || []).map(x => ({ date: x.date, count: toNum(x.count) })),
      });
    }

    const r = await fetch('https://searchapi.api.cloud.yandex.net/v2/wordstat/topRequests', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phrase: phrase.slice(0, 400),
        numPhrases: Math.min(Number(numPhrases) || 20, 2000),
        folderId: YA_FOLDER,
        ...(Array.isArray(regions) && regions.length ? { regions } : {}),
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[wordstat/topRequests]', r.status, phrase, JSON.stringify(data));
      return res.status(r.status).json({ error: { message: data?.message || 'Wordstat error' } });
    }

    res.status(200).json({
      totalCount: toNum(data.totalCount),
      results: (data.results || []).map(x => ({ phrase: x.phrase, count: toNum(x.count) })),
      associations: (data.associations || []).map(x => ({ phrase: x.phrase, count: toNum(x.count) })),
    });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
