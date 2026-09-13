export const config = { api: { bodyParser: true } };

// Клиенты и их рынки — общие таблицы с контент-машиной (решение владелицы
// 11.09.2026). Оболочка до сих пор собирала список клиентов из прогонов
// инструмента: это работало ровно на той машине, где прогон делали, и
// разъезжалось с тем, что видит контент-машина. Теперь источник один — база.
//
// Запрос идёт ОТ ИМЕНИ ПОЛЬЗОВАТЕЛЯ (его JWT), как в projects.js: RLS с
// политикой `owner_id = auth.uid()` сама не отдаст чужие строки. Сервисный
// ключ здесь нельзя — он обходит RLS, и один забытый фильтр показал бы
// клиентов чужого аккаунта.
//
// Рынки приходят вложенными одним запросом (PostgREST умеет связи по внешнему
// ключу) — иначе оболочке пришлось бы делать запрос на каждого клиента.
import { requireUser, setCorsHeaders } from './_auth.js';

export default async function handler(req, res) {
  setCorsHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req, res);
  if (!auth) return;

  const headers = auth.pgHeaders;
  const SELECT = 'id,name,domain,one_liner,created_at,'
    + 'markets(id,country,country_name,lang,price_range,audience_note,result_promise)';

  try {
    if (req.method === 'GET') {
      const r = await fetch(auth.pgBase + 'clients?select=' + encodeURIComponent(SELECT)
        + '&order=created_at.asc', { headers });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });
      return res.status(200).json({ clients: data });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      // owner_id НЕ передаём: колонку заполняет база от имени вошедшего
      // (default auth.uid()). Клиент физически не может подставить чужой id —
      // это и было доводом, когда правило принимали.
      if (b.market) {
        if (!b.client_id) return res.status(400).json({ error: { message: 'client_id is required' } });
        const m = b.market;
        if (!m.lang) return res.status(400).json({ error: { message: 'lang is required' } });
        const r = await fetch(auth.pgBase + 'markets', {
          method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            client_id: b.client_id,
            country: m.country || '',
            country_name: m.country_name || '',
            lang: m.lang,
            price_range: m.price_range || '',
            audience_note: m.audience_note || '',
            result_promise: m.result_promise || '',
          }),
        });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: data });
        return res.status(200).json({ market: Array.isArray(data) ? data[0] : data });
      }
      if (!b.name) return res.status(400).json({ error: { message: 'name is required' } });
      const r = await fetch(auth.pgBase + 'clients', {
        method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          name: b.name, domain: b.domain || '', one_liner: b.one_liner || '',
        }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });
      return res.status(200).json({ client: Array.isArray(data) ? data[0] : data });
    }

    return res.status(405).json({ error: { message: 'Method not allowed' } });
  } catch (e) {
    console.error('[clients]', e);
    return res.status(500).json({ error: { message: String(e && e.message || e) } });
  }
}
