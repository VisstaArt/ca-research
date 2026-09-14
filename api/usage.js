export const config = { api: { bodyParser: true } };

// Учёт расхода исследования. До сих пор его не было вовсе: контент-машина
// писала свои вызовы в usage_counters, а прогоны модулей — самая дорогая часть
// платформы — не писали ничего. В строке проекта владелица видела десять
// центов и думала, что это весь расход за месяц.
//
// Складываем в ту же таблицу и тем же ключом (клиент + месяц), что и они:
// расход у проекта один, и разделять его по тому, какая половина платформы
// потратила, человеку незачем.
//
// Прибавление делаем ЧТЕНИЕМ И ЗАПИСЬЮ, а не upsert'ом с постоянным значением:
// upsert затирает, а нам нужно именно прибавить к тому, что уже насчитала
// контент-машина. Гонка здесь маловероятна (прогон идёт в одном браузере), а
// цена ошибки — неверный счёт, поэтому пишем с проверкой прежнего значения.
import { requireUser, setCorsHeaders } from './_auth.js';

// Цены за миллион токенов, в центах. Держим здесь, а не в браузере: цена
// меняется у провайдера, и правка в одном месте не требует пересборки страницы.
// Прейскурант со страницы цен OpenAI (скрины владелицы 14.09.2026), короткий
// контекст. Цены за миллион токенов, в центах.
const PRICES = {
  'gpt-6-astra':   { in: 1000, out: 5000 },   // $10 / $50
  'gpt-5.6-sol':   { in:  400, out: 2000 },   // $4  / $20
  'gpt-5.6-terra': { in:  200, out: 1200 },   // $2  / $12
  'gpt-5.6-luna':  { in:   20, out:  120 },   // $0.20 / $1.20
  'gpt-5':         { in:  125, out: 1000 },   // $1.25 / $10
  'gpt-4.1':       { in:  200, out:  800 },   // $2  / $8
  'gpt-4.1-mini':  { in:   40, out:  160 },
};
const PRICE = PRICES['gpt-4.1'];           // запасной вариант, если модель не названа
const SEARCH_CENTS = 1;                    // Tavily: ~$0.01 за поиск

export default async function handler(req, res) {
  setCorsHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const auth = await requireUser(req, res);
  if (!auth) return;

  // GET — прейскурант для сметы в интерфейсе. Цены живут ТОЛЬКО здесь
  // (см. комментарий выше), браузер их спрашивает, а не хранит копию:
  // смета и счёт обязаны сходиться, а две копии цен молча расходятся.
  if (req.method === 'GET') {
    return res.status(200).json({ price: PRICE, prices: PRICES, search_cents: SEARCH_CENTS });
  }

  const b = req.body || {};
  const clientId = b.client_id;
  if (!clientId) return res.status(400).json({ error: { message: 'client_id is required' } });

  const tin = Math.max(0, Number(b.tokens_in) || 0);
  const tout = Math.max(0, Number(b.tokens_out) || 0);
  const calls = Math.max(0, Number(b.llm_calls) || 0);
  const search = Math.max(0, Number(b.search_calls) || 0);
  const cents = Math.round((tin * PRICE.in + tout * PRICE.out) / 1e6) + search * SEARCH_CENTS;

  const period = new Date().toISOString().slice(0, 7) + '-01';
  const headers = auth.pgHeaders;
  const q = 'usage_counters?client_id=eq.' + encodeURIComponent(clientId)
    + '&period=eq.' + period;

  try {
    const cur = await fetch(auth.pgBase + q + '&select=*', { headers });
    const rows = cur.ok ? await cur.json().catch(() => []) : [];
    const old = Array.isArray(rows) && rows[0] ? rows[0] : null;
    const row = {
      client_id: clientId, period,
      llm_calls: (old ? old.llm_calls : 0) + calls,
      llm_tokens: (old ? old.llm_tokens : 0) + tin + tout,
      llm_tokens_in: (old ? old.llm_tokens_in : 0) + tin,
      llm_tokens_out: (old ? old.llm_tokens_out : 0) + tout,
      search_calls: (old ? old.search_calls : 0) + search,
      search_units: (old ? old.search_units : 0) + search,
      cost_cents: (old ? old.cost_cents : 0) + cents,
    };
    const r = await fetch(auth.pgBase + (old ? q : 'usage_counters'), {
      method: old ? 'PATCH' : 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(old ? { ...row, client_id: undefined, period: undefined } : row),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.status(200).json({ usage: Array.isArray(data) ? data[0] : data, added_cents: cents });
  } catch (e) {
    console.error('[usage]', e);
    return res.status(500).json({ error: { message: String(e && e.message || e) } });
  }
}
