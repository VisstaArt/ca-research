export const config = { api: { bodyParser: true } };

// M10 — трекер публикаций + метрики (ТЗ-АНАЛИТИЧЕСКИЙ-СЛОЙ.md, разд.5.1).
// Тот же стиль, что proxy.js/search.js/projects.js: голый fetch к REST Supabase
// (PostgREST), без SDK/package.json. Схема из 5.1 дополнена project_id — трекер
// привязан к проекту.
//
// Б1+Б2+Б3 (24.08.2026): изоляция по владельцу теперь через RLS на самой
// таблице (project_id -> projects.owner_id), запрос идёт от имени пользователя
// (его JWT), не service_role — см. api/_auth.js.
import { requireUser, setCorsHeaders } from './_auth.js';
export default async function handler(req, res) {
  setCorsHeaders(res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req, res);
  if (!auth) return;

  const base = auth.pgBase;
  const headers = auth.pgHeaders;

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
