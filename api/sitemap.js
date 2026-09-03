export const config = { api: { bodyParser: true } };

// Карта сайта: список опубликованных страниц по sitemap.xml.
//
// Зачем (идея из открытой библиотеки goose-skills, раздел SEO): не начинать
// контент-план с чистого листа. Сначала узнать, что на сайте УЖЕ написано, —
// иначе модуль предлагает тему, которая давно опубликована, и статьи начинают
// конкурировать друг с другом в выдаче. Ровно та задача, ради которой владелица
// просила «чтобы статьи не перекрывались».
//
// Там это делают через платные Ahrefs/Semrush; здесь достаточно бесплатного
// sitemap.xml — его отдаёт почти любой сайт, и это открытый стандарт.
//
// Тот же стиль, что api/verify-quotes.js: серверный fetch чужих страниц (из
// браузера он невозможен — CORS), таймауты, никаких исключений наружу.
import { requireUser, setCorsHeaders } from './_auth.js';

const TIMEOUT = 8000;
const MAX_URLS = 300;          // потолок: дальше растёт промпт, а пользы уже нет
const MAX_CHILD_SITEMAPS = 5;  // sitemap-индекс ссылается на другие карты

async function get(url) {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      // Дефолтный User-Agent часть сайтов режет — та же причина, что в verify-quotes.js
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CA-Research/1.0)' },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

const locs = xml => [...String(xml || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]);
const isIndex = xml => /<sitemapindex/i.test(String(xml || ''));

export default async function handler(req, res) {
  setCorsHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req, res);
  if (!auth) return;

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: { message: 'url is required' } });
  }

  let origin;
  try {
    origin = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url).origin;
  } catch {
    return res.status(400).json({ error: { message: 'bad url' } });
  }

  try {
    // Где искать карту: сначала то, на что указывает сам сайт в robots.txt,
    // потом стандартные места. Порядок важен — у крупных сайтов карта часто
    // лежит не по умолчанию, и robots.txt единственный способ это узнать.
    const candidates = [];
    const robots = await get(origin + '/robots.txt');
    if (robots) {
      for (const m of String(robots).matchAll(/^\s*sitemap:\s*(\S+)/gim)) candidates.push(m[1]);
    }
    candidates.push(origin + '/sitemap.xml', origin + '/sitemap_index.xml');

    const seen = new Set();
    const urls = [];
    let checked = 0;

    for (const cand of candidates) {
      if (urls.length >= MAX_URLS || checked >= MAX_CHILD_SITEMAPS + 2) break;
      if (seen.has(cand)) continue;
      seen.add(cand); checked++;
      const xml = await get(cand);
      if (!xml) continue;

      if (isIndex(xml)) {
        // Это не карта, а список карт — заходим внутрь, но ограниченно.
        for (const child of locs(xml).slice(0, MAX_CHILD_SITEMAPS)) {
          if (urls.length >= MAX_URLS) break;
          if (seen.has(child)) continue;
          seen.add(child);
          const childXml = await get(child);
          if (!childXml) continue;
          for (const u of locs(childXml)) {
            if (urls.length >= MAX_URLS) break;
            if (!seen.has(u)) { seen.add(u); urls.push(u); }
          }
        }
      } else {
        for (const u of locs(xml)) {
          if (urls.length >= MAX_URLS) break;
          if (!seen.has(u)) { seen.add(u); urls.push(u); }
        }
      }
      if (urls.length) break;   // нашли рабочую карту — остальные кандидаты не нужны
    }

    res.status(200).json({ origin, urls, truncated: urls.length >= MAX_URLS });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
