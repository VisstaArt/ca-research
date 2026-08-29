export const config = { api: { bodyParser: true } };

// Реальная частотность запросов для M7 (SEO) вне России — Google Ads API
// (Keyword Planner). Yandex Wordstat (api/wordstat.js) работает только для
// RU/KZ/BY; для остальных исследуемых рынков (Турция, ОАЭ, англоязычные —
// REQ-025) M7 до этого честно писал «не замерено» по всей таблице SEO-02,
// единственный источник частотности не подходил. Маршрутизация Yandex/Google
// по рынку — в index.html (keywordSourceForMarket), не здесь.
// Тот же стиль, что api/wordstat.js: голый fetch, без SDK.
import { requireUser, setCorsHeaders } from './_auth.js';

// Короткий список — только языки, в которых уверена (Google Ads criteria ID
// стабильны и хорошо задокументированы). В отличие от гео (много стран, риск
// ошибиться и молча утащить не туда) язык не резолвим динамически.
const LANGUAGE_CONSTANTS = {
  english: 1000, английский: 1000,
  turkish: 1049, турецкий: 1049,
  arabic: 1019, арабский: 1019,
  russian: 1031, русский: 1031,
  spanish: 1003, испанский: 1003,
  german: 1001, немецкий: 1001,
  french: 1002, французский: 1002,
};
// Google отдаёт месяц названием (MonthOfYear enum), Wordstat — датой. Приводим к общему виду.
const MONTHS = {
  JANUARY:'01', FEBRUARY:'02', MARCH:'03', APRIL:'04', MAY:'05', JUNE:'06',
  JULY:'07', AUGUST:'08', SEPTEMBER:'09', OCTOBER:'10', NOVEMBER:'11', DECEMBER:'12',
};
function languageConstant(lang) {
  const key = String(lang || '').toLowerCase().trim();
  const id = LANGUAGE_CONSTANTS[key] || 1000; // по умолчанию английский
  return 'languageConstants/' + id;
}

export default async function handler(req, res) {
  setCorsHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req, res);
  if (!auth) return;

  const DEV_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || LOGIN_CUSTOMER_ID;
  if (!DEV_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !LOGIN_CUSTOMER_ID) {
    // M7 трактует это как «данных нет» и продолжает честно писать «не замерено» — как у Wordstat.
    return res.status(503).json({ error: { message: 'Google Ads is not configured', code: 'google_ads_unconfigured' } });
  }

  // siteUrl — «дай ключи, по которым работает вот этот сайт»: GenerateKeywordIdeas
  // принимает URL как затравку вместо фразы. У Yandex Wordstat такого нет вообще,
  // и это ровно то, ради чего покупают сервисы вроде key.so.
  const { phrase, siteUrl, market, lang } = req.body || {};
  if (!phrase && !siteUrl) {
    return res.status(400).json({ error: { message: 'phrase or siteUrl is required' } });
  }

  try {
    // Шаг 1 — обменять refresh_token на access_token. Fresh на каждый вызов
    // (без кеша между холодными стартами serverless) — тот же принцип
    // простоты, что и у остальных функций проекта.
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[google-ads/oauth]', tokenRes.status, JSON.stringify(tokenData));
      return res.status(502).json({ error: { message: 'Google OAuth failed' } });
    }
    const accessToken = tokenData.access_token;
    const gHeaders = {
      'Content-Type': 'application/json',
      'developer-token': DEV_TOKEN,
      'login-customer-id': String(LOGIN_CUSTOMER_ID).replace(/-/g, ''),
      'Authorization': 'Bearer ' + accessToken,
    };

    // Шаг 2 — резолвим гео по названию рынка (не храним таблицу ID вручную —
    // много стран, риск ошибиться и молча уйти не в ту страну). Без совпадения
    // просто не таргетируем по гео (глобальный запрос), не падаем.
    let geoTargetConstants = [];
    if (market) {
      try {
        const geoRes = await fetch('https://googleads.googleapis.com/v18/geoTargetConstants:suggest', {
          method: 'POST', headers: gHeaders,
          body: JSON.stringify({ locale: 'en', locationNames: { names: [market] } }),
        });
        const geoData = await geoRes.json();
        const suggestion = geoRes.ok && Array.isArray(geoData.geoTargetConstantSuggestions)
          ? geoData.geoTargetConstantSuggestions[0] : null;
        const resourceName = suggestion && suggestion.geoTargetConstant && suggestion.geoTargetConstant.resourceName;
        if (resourceName) geoTargetConstants = [resourceName];
      } catch { /* без гео-таргетинга — не блокирует остальной запрос */ }
    }

    // Шаг 3 — сами идеи по ключевым словам с реальной частотностью.
    const customerId = String(CUSTOMER_ID).replace(/-/g, '');
    const ideaRes = await fetch('https://googleads.googleapis.com/v18/customers/' + customerId + ':generateKeywordIdeas', {
      method: 'POST', headers: gHeaders,
      body: JSON.stringify({
        language: languageConstant(lang),
        ...(geoTargetConstants.length ? { geoTargetConstants } : {}),
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        // Затравка: фраза, сайт, либо и то и другое (Google допускает все три варианта).
        ...(phrase && siteUrl
          ? { keywordAndUrlSeed: { keywords: [String(phrase).slice(0, 400)], url: String(siteUrl).slice(0, 2000) } }
          : siteUrl
            ? { urlSeed: { url: String(siteUrl).slice(0, 2000) } }
            : { keywordSeed: { keywords: [String(phrase).slice(0, 400)] } }),
      }),
    });
    const ideaData = await ideaRes.json();
    if (!ideaRes.ok) {
      console.error('[google-ads/generateKeywordIdeas]', ideaRes.status, phrase || siteUrl, JSON.stringify(ideaData));
      return res.status(ideaRes.status).json({ error: { message: ideaData?.error?.message || 'Google Ads error' } });
    }

    // Та же форма ответа, что api/wordstat.js (topRequests) — fetchKeywordFrequencyData
    // в index.html переиспользует один и тот же код для обоих источников.
    // Дополнительно к частоте забираем то, чего у Яндекса нет вообще:
    //  - monthlySearchVolumes: помесячная история за 12 месяцев В ТОМ ЖЕ ответе,
    //    то есть сезонность по Google не требует отдельного вызова;
    //  - competition/competitionIndex: реальная метрика конкуренции по ключу
    //    (в отчёте эту колонку до сих пор заполняла оценка модели, то есть догадка).
    const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    const results = (ideaData.results || [])
      .filter(r => r.text && r.keywordMetrics && r.keywordMetrics.avgMonthlySearches != null)
      .map(r => {
        const km = r.keywordMetrics;
        // month у Google — enum названием месяца («JANUARY»), не число. Приводим к
        // «YYYY-MM», как в ответе Wordstat/dynamics, чтобы дальше по коду был один формат.
        const monthly = (km.monthlySearchVolumes || [])
          .map(m => {
            const mi = MONTHS[String(m.month || '').toUpperCase()];
            if (!mi || !m.year) return null;
            return { date: m.year + '-' + mi, count: num(m.monthlySearches) };
          })
          .filter(m => m && m.count != null);
        return {
          phrase: r.text,
          count: Number(km.avgMonthlySearches),
          ...(km.competition ? { competition: km.competition } : {}),
          ...(km.competitionIndex != null ? { competitionIndex: num(km.competitionIndex) } : {}),
          ...(monthly.length ? { monthly } : {}),
        };
      });
    res.status(200).json({ results });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
