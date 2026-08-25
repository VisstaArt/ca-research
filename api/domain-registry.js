export const config = { api: { bodyParser: true } };

// M3 VoC — реестр площадок по нише (ТЗ-M3-VOC.md, п.2). Полностью автоматический:
// заполняется поиском (discoverNicheDomains) + доменами конкурентов из уже готового
// M2 (competitorDomainsFromM2), без ручного ввода — владелица делает исследование
// целиком автоматически, руками ничего не вводит. Тот же стиль, что publications.js.
//
// Б1+Б2+Б3 (24.08.2026): реестр ОБЩИЙ на всех клиентов (не приватные данные —
// публичный список форумов/отзовиков по нише), но доступ только вошедшим
// пользователям (requireUser) — RLS-политика на таблице разрешает любому
// authenticated, а не owner_id (см. план). service_role здесь тоже убран —
// единообразие с остальными api/*.js важнее, чем разница в семантике таблицы.
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
      const niche = req.query && req.query.niche;
      if (!niche) return res.status(400).json({ error: { message: 'niche is required' } });
      const url = base + 'domain_registry?niche=eq.' + encodeURIComponent(niche) + '&select=*&order=domain.asc';
      const r = await fetch(url, { headers });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });
      return res.status(200).json({ domains: data });
    }

    if (req.method === 'POST') {
      // Массовый upsert — заполнение ниши это сразу много доменов за раз,
      // не по одному, как у большинства других api/*.js.
      const { niche, domains } = req.body || {};
      if (!niche || !Array.isArray(domains) || !domains.length) {
        return res.status(400).json({ error: { message: 'niche and domains[] are required' } });
      }
      // refreshed_at — свежесть реестра (владелица, 24.08: без срока годности
      // общий реестр зачерствеет). Пишем при каждом апсерте, включая повтор
      // уже существующих доменов — merge-duplicates обновит именно эту колонку.
      const rows = domains
        .filter(d => d && d.domain)
        .map(d => ({ niche, domain: d.domain, category: d.category || null, source: d.source || 'auto', refreshed_at: new Date().toISOString() }));
      if (!rows.length) return res.status(200).json({ ok: true, inserted: 0 });
      const r = await fetch(base + 'domain_registry', {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: { message: t } }); }
      return res.status(200).json({ ok: true, inserted: rows.length });
    }

    if (req.method === 'DELETE') {
      const id = req.query && req.query.id;
      if (!id) return res.status(400).json({ error: { message: 'id is required' } });
      const r = await fetch(base + 'domain_registry?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers });
      if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: { message: t } }); }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: { message: 'Method not allowed' } });
  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}
