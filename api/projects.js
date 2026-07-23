export const config = { api: { bodyParser: true } };

// Хранилище прогонов (бриф + результаты модулей + отчёт) в Supabase — вместо
// localStorage (ТЗ-АНАЛИТИЧЕСКИЙ-СЛОЙ.md, п.2.2: переживает чистку браузера,
// доступно с другого устройства и внешним агентам). Тот же стиль, что
// proxy.js/search.js: голый fetch к REST API Supabase (PostgREST), без SDK и
// без package.json — их в проекте нет, не добавляем зависимость ради одного файла.
// SUPABASE_SERVICE_ROLE_KEY живёт только здесь, клиенту никогда не отдаётся.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const appPassword = process.env.APP_PASSWORD;
  if (appPassword && req.headers['x-app-key'] !== appPassword) {
    return res.status(401).json({ error: { message: 'Unauthorized', code: 'bad_app_key' } });
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SB_KEY) {
    // Клиент трактует 503 как «БД недоступна» и молча остаётся на localStorage.
    return res.status(503).json({ error: { message: 'DB is not configured', code: 'db_unconfigured' } });
  }
  const base = SB_URL.replace(/\/$/, '') + '/rest/v1/projects';
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
  };

  try {
    if (req.method === 'GET') {
      const r = await fetch(base + '?select=*&order=updated_at.desc', { headers });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });
      return res.status(200).json({ projects: data });
    }

    if (req.method === 'POST') {
      const p = req.body || {};
      if (!p.id) return res.status(400).json({ error: { message: 'id is required' } });
      const row = {
        id: p.id,
        created_at: p.createdAt || new Date().toISOString(),
        updated_at: p.updatedAt || new Date().toISOString(),
        brief: p.brief || {},
        lang: p.lang || '',
        mods: p.mods || [],
        results: p.results || [],
        report: p.report || '',
        price_layers: p.priceLayers || [],
        selected_layers: p.selectedLayers || [],
      };
      const r = await fetch(base, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([row]),
      });
      if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: { message: t } }); }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || (req.body && req.body.id);
      if (!id) return res.status(400).json({ error: { message: 'id is required' } });
      const r = await fetch(base + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers });
      if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: { message: t } }); }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: { message: 'Method not allowed' } });
  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}
