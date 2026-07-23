export const config = { api: { bodyParser: true } };

// M10 — трекер публикаций + метрики (ТЗ-АНАЛИТИЧЕСКИЙ-СЛОЙ.md, разд.5.1).
// Тот же стиль, что proxy.js/search.js/projects.js: голый fetch к REST Supabase
// (PostgREST), без SDK/package.json. Схема из 5.1 дополнена project_id — трекер
// привязан к проекту (владелица подтвердила: разные проекты не связаны между
// собой, в перспективе — сервис с отдельными пользователями и их проектами).
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
    return res.status(503).json({ error: { message: 'DB is not configured', code: 'db_unconfigured' } });
  }
  // Тот же приём, что в projects.js: терпим SUPABASE_URL и с /rest/v1, и без него.
  const base = SB_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') + '/rest/v1/';
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
  };

  try {
    if (req.method === 'GET') {
      const projectId = req.query && req.query.project_id;
      if (!projectId) return res.status(400).json({ error: { message: 'project_id is required' } });
      const url = base + 'publications?project_id=eq.' + encodeURIComponent(projectId)
        + '&select=*,metrics_snapshots(*)&order=date.desc';
      const r = await fetch(url, { headers });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });
      return res.status(200).json({ publications: data });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.kind === 'metrics') {
        const { publication_id, snapshot_date, views, likes, comments, shares, watch_pct, subs_gained, clicks, registrations } = body;
        if (!publication_id) return res.status(400).json({ error: { message: 'publication_id is required' } });
        const row = { publication_id, snapshot_date: snapshot_date || new Date().toISOString().slice(0, 10),
          views, likes, comments, shares, watch_pct, subs_gained, clicks, registrations };
        const r = await fetch(base + 'metrics_snapshots', {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify([row]),
        });
        if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: { message: t } }); }
        return res.status(200).json({ ok: true });
      } else {
        const { project_id, date, platform, format, character, topic, hypothesis_id, hook_type, url, utm } = body;
        if (!project_id) return res.status(400).json({ error: { message: 'project_id is required' } });
        const row = { project_id, date: date || new Date().toISOString().slice(0, 10),
          platform, format, character, topic, hypothesis_id, hook_type, url, utm };
        const r = await fetch(base + 'publications', {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify([row]),
        });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: data });
        return res.status(200).json({ publication: data[0] });
      }
    }

    if (req.method === 'DELETE') {
      const id = req.query && req.query.id;
      if (!id) return res.status(400).json({ error: { message: 'id is required' } });
      const r = await fetch(base + 'publications?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers });
      if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: { message: t } }); }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: { message: 'Method not allowed' } });
  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}
