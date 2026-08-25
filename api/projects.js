export const config = { api: { bodyParser: true } };

// Хранилище прогонов (бриф + результаты модулей + отчёт) в Supabase — вместо
// localStorage (ТЗ-АНАЛИТИЧЕСКИЙ-СЛОЙ.md, п.2.2: переживает чистку браузера,
// доступно с другого устройства и внешним агентам). Тот же стиль, что
// proxy.js/search.js: голый fetch к REST API Supabase (PostgREST), без SDK и
// без package.json — их в проекте нет, не добавляем зависимость ради одного файла.
//
// Б1+Б2+Б3 (24.08.2026): раньше здесь был SUPABASE_SERVICE_ROLE_KEY — ключ,
// который обходит RLS, поэтому GET без фильтра по владельцу отдавал ВСЕ
// исследования всем. Теперь запрос идёт от имени пользователя (его JWT) —
// PostgREST + RLS-политика `owner_id = auth.uid()` сами не отдадут чужие
// строки, фильтрация — свойство базы, не код этой функции.
import { requireUser, setCorsHeaders } from './_auth.js';
export default async function handler(req, res) {
  setCorsHeaders(res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req, res);
  if (!auth) return; // requireUser уже отправил 401/503

  const base = auth.pgBase + 'projects';
  const headers = auth.pgHeaders;

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
