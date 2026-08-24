export const config = { api: { bodyParser: true } };

// M8 — тренд-монитор: история снапшотов по (проекту, нише). ТЗ-АНАЛИТИЧЕСКИЙ-СЛОЙ.md
// разд.3: периодический скан, а не одноразовый результат — поэтому отдельная
// таблица с историей (как publications/metrics_snapshots у M10), не proj.results.
// Тот же стиль, что proxy.js/search.js/projects.js/publications.js: голый fetch
// к REST Supabase (PostgREST), без SDK/package.json.
//
// Б1+Б2+Б3 (24.08.2026): изоляция по владельцу через RLS (project_id ->
// projects.owner_id), запрос от имени пользователя, не service_role.
import { requireUser } from './_auth.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req, res);
  if (!auth) return;

  const base = auth.pgBase;
  const headers = auth.pgHeaders;

  try {
    if (req.method === 'GET') {
      const projectId = req.query && req.query.project_id;
      const niche = (req.query && req.query.niche) || '';
      if (!projectId) return res.status(400).json({ error: { message: 'project_id is required' } });
      const url = base + 'trend_snapshots?project_id=eq.' + encodeURIComponent(projectId)
        + '&niche=eq.' + encodeURIComponent(niche) + '&order=snapshot_date.desc';
      const r = await fetch(url, { headers });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });
      return res.status(200).json({ snapshots: data });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { project_id, niche, snapshot_date, trends, newsworthy, delta, content } = body;
      if (!project_id) return res.status(400).json({ error: { message: 'project_id is required' } });
      const row = {
        project_id, niche: niche || '',
        snapshot_date: snapshot_date || new Date().toISOString().slice(0, 10),
        trends: trends || [], newsworthy: newsworthy || [], delta: delta || {}, content: content || '',
      };
      const r = await fetch(base + 'trend_snapshots', {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify([row]),
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });
      return res.status(200).json({ snapshot: data[0] });
    }

    return res.status(405).json({ error: { message: 'Method not allowed' } });
  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}
