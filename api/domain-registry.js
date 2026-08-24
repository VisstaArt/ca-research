export const config = { api: { bodyParser: true } };

// M3 VoC — реестр площадок по нише (ТЗ-M3-VOC.md, п.2). Полностью автоматический:
// заполняется поиском (discoverNicheDomains) + доменами конкурентов из уже готового
// M2 (competitorDomainsFromM2), без ручного ввода — владелица делает исследование
// целиком автоматически, руками ничего не вводит. Тот же стиль, что publications.js.
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
  const base = SB_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') + '/rest/v1/';
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
  };

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
      const rows = domains
        .filter(d => d && d.domain)
        .map(d => ({ niche, domain: d.domain, category: d.category || null, source: d.source || 'auto' }));
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
