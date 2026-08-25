export const config = { api: { bodyParser: true }, maxDuration: 60 };

// M3 VoC — программная верификация цитат (ТЗ-M3-VOC.md, пункт 1, механизм
// «верификация подстроки»). Грузим страницу по URL и проверяем, что точная
// строка цитаты в ней реально есть — это код, не просьба к модели, поэтому
// фабрикация цитат становится структурно невозможной, а не «нежелательной».
// Тот же стиль/CORS, что api/search.js. Без Supabase, без OpenAI — голый fetch
// на чужую страницу, поэтому бесплатно и не зависит от бюджета.
// Б1+Б2+Б3 (24.08.2026): общий APP_PASSWORD заменён на проверку JWT пользователя.
import { requireUser, setCorsHeaders } from './_auth.js';
export default async function handler(req, res) {
  setCorsHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req, res);
  if (!auth) return;

  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: { message: 'items[] is required' } });
  }

  const normalize = s => String(s || '').replace(/\s+/g, ' ').trim();

  // HTML-сущности, которые реально встречаются в тексте страниц (без полного
  // декодера — это единственные, что расходятся с тем, как модель пишет цитату).
  const decodeEntities = s => s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–').replace(/&hellip;/g, '…');

  const stripTags = html => decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();

  // Один URL может цитироваться несколько раз (BLOCK 07 + BLOCK 07A) —
  // грузим страницу один раз, проверяем на ней все её цитаты.
  const byUrl = new Map();
  for (const it of items) {
    const url = String((it && it.url) || '').trim();
    const quote = String((it && it.quote) || '').trim();
    if (!url || !quote) continue;
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(quote);
  }

  const CONCURRENCY = 8;
  const urls = [...byUrl.keys()];
  const pageTextByUrl = new Map();
  const failedUrls = new Set();

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async url => {
      try {
        const r = await fetch(url, {
          signal: AbortSignal.timeout(6000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CAResearchVerifier/1.0)' },
        });
        if (!r.ok) { failedUrls.add(url); return; }
        const html = await r.text();
        pageTextByUrl.set(url, stripTags(html));
      } catch {
        failedUrls.add(url);
      }
    }));
  }

  const results = [];
  for (const [url, quotes] of byUrl) {
    const failed = failedUrls.has(url);
    const pageText = pageTextByUrl.get(url) || '';
    for (const quote of quotes) {
      if (failed) {
        results.push({ url, quote, verified: false, reason: 'fetch_failed' });
        continue;
      }
      const verified = pageText.includes(normalize(quote));
      results.push({ url, quote, verified, reason: verified ? 'matched' : 'not_found' });
    }
  }

  res.status(200).json({ results });
}
