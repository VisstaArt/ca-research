// Контракт с контент-машиной: сборка agent_package и разбор markdown-таблиц.
//
// Вынесено из index.html 29.08.2026 по предложению агента контент-машины.
// Его довод: buildAgentPackage — это ГРАНИЦА между двумя модулями, а пока она
// лежала внутри файла на пять тысяч строк вперемешку с React, любая правка
// интерфейса могла её задеть, и узнавали бы об этом на их стороне — сломанной
// генерацией. Отдельным файлом это проверяемая граница, а не кусок общего файла.
//
// Здесь НЕТ React, DOM и JSX — только чистые функции. Файл подключается обычным
// <script> перед Babel-скриптом, поэтому сборка по-прежнему не нужна. При
// переезде на Next.js обёртка IIFE снизу меняется на export — больше ничего.
(function (root) {
  'use strict';

  // Глобальные модули — один результат на проект (M1.1 ёмкость, M1.2 карта ниш).
  // Остальные (M2–M7) — свой отдельный сфокусированный проход на КАЖДУЮ выбранную нишу.
  const GLOBAL_MODS = ['M1', 'M1_1', 'M1_2'];
  const isPerNiche = id => !GLOBAL_MODS.includes(id);
  // Результаты M2–M7 без ниши — «сироты» с прогонов ДО введения модели «по нишам»
  // (M2–M7 раньше были глобальными). Без этого фильтра они молча попадают в «глобальные»
  // в каждом месте, где читаются results (карточки, HTML/MD отчёты, JSON-пакет для агента) —
  // показываются как отдельный набор без подписи «Ниша: …», перед реальными по-нишевыми.
  const dropOrphans = rs => (rs || []).filter(r => !isPerNiche(r.id) || r.niche);
  const nichesOf = b => ((b && b.selectedNiche) || '').split(',').map(s => s.trim()).filter(Boolean);
  // Идентичность результата теперь = модуль + ниша (у глобальных ниша пустая).
  const resKey = r => r.id + (r && r.niche ? '@@' + r.niche : '');

  // ── КОНТРАКТ С КОНТЕНТ-МАШИНОЙ ───────────────────────────────────────────
  // Разбираем markdown-таблицы, которые модули и так генерируют, в структурированный вид.
  // Так контент-машина получает данные объектами, а промпты трогать не нужно —
  // ни лишних токенов, ни риска обрезки вывода.
  function splitMdRow(line) {
    return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  }
  function isMdSeparator(s) {
    return /^[\s|:-]+$/.test(s) && s.includes('-') && s.includes('|');
  }

  function parseMdTables(md) {
    const lines = String(md || '').split('\n');
    const out = [];
    let heading = '';
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      // Заголовком таблицы считаем ближайшую строку-заголовок выше неё
      if (/^#{1,6}\s+/.test(t)) { heading = t.replace(/^#+\s*/, '').trim(); continue; }
      if (/^BLOCK\s/i.test(t) || /^SEO-\d/i.test(t)) { heading = t.replace(/\s*[:—-]\s*$/, '').trim(); continue; }
      if (t.startsWith('|') && i + 1 < lines.length && isMdSeparator(lines[i + 1].trim())) {
        const headers = splitMdRow(t);
        const rows = [];
        let j = i + 2;
        for (; j < lines.length; j++) {
          const rt = lines[j].trim();
          if (!rt.startsWith('|')) break;
          const cells = splitMdRow(rt);
          const obj = {};
          headers.forEach((h, k) => { if (h) obj[h] = cells[k] === undefined ? '' : cells[k]; });
          rows.push(obj);
        }
        if (rows.length) out.push({ heading: heading, rows: rows });
        i = j - 1;
      }
    }
    return out;
  }

  // Разбирает один результат модуля в {title, generated_at, tables, markdown}.
  // titleOf — функция id→название. Раньше здесь был прямой доступ к MODULES,
  // то есть к конфигу ИНТЕРФЕЙСА: из-за этого сборщик контракта нельзя было
  // ни вынести, ни проверить отдельно от React-части.
  function buildModuleEntry(r, titleOf) {
    const tables = {};
    parseMdTables(r.content).forEach((t, idx) => {
      let key = t.heading || ('table_' + (idx + 1));
      if (tables[key]) key = key + ' (' + (idx + 1) + ')';   // одинаковые заголовки не затираем
      tables[key] = t.rows;
    });
    // status — чтобы потребитель контракта отличал «модуль отработал, данных в
    // нише не нашлось» от «модуль вообще не выполнился». Без этого провал выглядел
    // как пустой результат: 26.08 M3 упал с «Error: API 429», контент-машина
    // увидела пустые VOICE_OF_CUSTOMER/PAIN_BANK и приняла это за дефект промпта.
    const failed = !!r.failed || /^Error:/.test(String(r.content || '').trim());
    return {
      title: titleOf ? titleOf(r.id) : r.id,
      generated_at: r.at || null,
      status: failed ? 'failed' : 'ok',
      ...(failed ? { error: r.error || String(r.content || '').trim() } : {}),
      tables: tables,
      markdown: r.content || '',
      chartData: r.chartData || null,
    };
  }
  const pickTable = (modulesObj, modId, needle) => {
    const mod = modulesObj[modId];
    if (!mod) return [];
    const key = Object.keys(mod.tables).find(k => k.toLowerCase().includes(needle.toLowerCase()));
    return key ? mod.tables[key] : [];
  };
  // Одна колонка из строк таблицы (например SEO_KEYWORDS — просто список фраз,
  // не целые строки SEO-02) — ищет заголовок колонки тем же приёмом, что pickTable
  // ищет заголовок блока: по вхождению подстроки, без учёта регистра.
  const pickColumn = (rows, needle) => rows.map(row => {
    const k = Object.keys(row).find(k => k.toLowerCase().includes(needle.toLowerCase()));
    return k ? row[k] : '';
  }).filter(Boolean);
  // Стабильный id для строк без него в исходной таблице (контент-машина в
  // client-pipeline-template дедуплицирует использованные боли/возражения по id
  // между прогонами — см. ТЗ-ИССЛЕДОВАНИЕ-ПОД-КОНТЕНТ.md п.4.2-4.3). Не трогаем
  // остальные колонки — те, что уже написала модель, передаём как есть.
  const withStableIds = (rows, prefix) => rows.map((row, i) => ({ [prefix + '_id']: prefix + '-' + (i + 1), ...row }));

  // Пакет для внешнего агента. Данные — на ЯЗЫКЕ ИССЛЕДОВАНИЯ, без перевода:
  // подлинные формулировки аудитории теряются при переводе туда-обратно (ПОЖЕЛАНИЯ п.4).
  // schema_version 2: по-нишевые модули (M2–M7) вложены под своей нишей в research_by_niche.
  // БЫЛО (v1): modules[r.id] = {...} — один и тот же id ('M2','M3'...) у каждой выбранной
  // ниши, объект-словарь держит только ПОСЛЕДНЮЮ записанную нишу, остальные молча терялись
  // (обнаружено на реальном прогоне с 2 нишами: JSON содержал только одну из двух).
  function buildAgentPackage(brief, lang, results, report, opts) {
    const titleOf = (opts && opts.titleOf) || null;
    const all = dropOrphans(results);
    const globalModules = {};       // M1_2 и другие модули без ниши — один результат на проект
    const byNiche = {};              // niche name -> { modId -> result }
    for (const r of all) {
      if (isPerNiche(r.id)) {
        (byNiche[r.niche] || (byNiche[r.niche] = {}))[r.id] = r;
      } else {
        globalModules[r.id] = buildModuleEntry(r, titleOf);
      }
    }
    const m12 = all.find(r => r.id === 'M1_2');
    // AUDIENCE_SEGMENTS — проектный уровень (одна карта сегментов на весь проект,
    // M1.2 не по-нишевой), но нужна КАЖДОЙ нише в её собственном key_data — иначе
    // потребителю (import_research.py) пришлось бы знать про две разные секции
    // пакета вместо одной. Дублируем ссылку на один и тот же массив, не копируем
    // данные — дешёво по памяти, дёшево для чтения потребителем.
    const audienceSegments = pickTable(globalModules, 'M1_2', 'BLOCK 04');
    const research_by_niche = {};
    for (const nicheName of Object.keys(byNiche)) {
      const modulesForNiche = {};
      for (const r of Object.values(byNiche[nicheName])) modulesForNiche[r.id] = buildModuleEntry(r, titleOf);
      const m4 = modulesForNiche.M4, m3 = modulesForNiche.M3;
      research_by_niche[nicheName] = {
        // Поля названы ТОЧНО как в контракте с контент-машиной
        // (ТЗ-ИССЛЕДОВАНИЕ-ПОД-КОНТЕНТ.md разд.3) — так import_research.py
        // на стороне client-pipeline-template подставляет их в ONBOARDING-INTAKE.md
        // без переименования один в один, без риска рассинхрона имён полей.
        key_data: {
          NICHE_DESCRIPTION: (brief.niche || brief.name || '') + (nicheName ? ' — ' + nicheName : ''),
          CHANNEL_FRAME: brief.extra || '',
          AUDIENCE_PERSONAS: pickTable(modulesForNiche, 'M4', 'BLOCK 09'),
          AUDIENCE_SEGMENTS: audienceSegments,
          VOICE_OF_CUSTOMER: pickTable(modulesForNiche, 'M3', 'BLOCK 07'),
          GUARDRAILS: (m4 && m4.chartData && m4.chartData.guardrails) || [],
          TOPIC_FOCUS: brief.result || '',
          PAIN_BANK: withStableIds(pickTable(modulesForNiche, 'M3', 'BLOCK 07'), 'pain'),
          SEO_KEYWORDS: pickColumn(pickTable(modulesForNiche, 'M7', 'SEO-02'), 'кластер'),
          // Запрос от контент-машины (24.08, через владелицу): чем контент клиента
          // может отличаться от конкурентов — это уже посчитано в M2 BLOCK 06_1
          // (гэп-анализ: «В чём гэп» + «Действие» на каждый критерий), отдельного
          // замера не требует. Needle 'BLOCK 06_1' не путается с 'BLOCK 06' —
          // подстрока 'BLOCK 06_1' не встречается в заголовке BLOCK 06.
          SEO_COMPETITIVE_ANGLE: pickTable(modulesForNiche, 'M2', 'BLOCK 06_1'),
          AWARENESS_MIX: (m4 && m4.chartData && m4.chartData.awarenessLevels) || [],
          OBJECTIONS: withStableIds(pickTable(modulesForNiche, 'M4', 'BLOCK 12'), 'objection'),
          HOOK_BANK: (m3 && m3.chartData && m3.chartData.hookBank) || [],
          // Задача 2 от контент-машины: BLOCK 15 M4. В их промпте планирования уже
          // стоит плейсхолдер {{COGNITIVE_TACTICS}} с пометкой, что это сильнее
          // универсальных копирайтинг-формул — потому что подтверждено исследованием
          // ЭТОЙ аудитории, а не общей теорией. Считалось и никуда не отдавалось.
          COGNITIVE_TACTICS: pickTable(modulesForNiche, 'M4', 'BLOCK 15'),
          // Задача 3 от контент-машины: «где сидит аудитория» — отвечает на вопросы
          // «где публиковать» и «с кем сотрудничать». Раньше каналы были парой слов
          // внутри персон, теперь отдельный блок M3 с URL и ссылками [n].
          AUDIENCE_CHANNELS: pickTable(modulesForNiche, 'M3', 'BLOCK 08A'),
          // Задача 1 от контент-машины: M6 не экспортировался ЦЕЛИКОМ, хотя это
          // самый «контентный» модуль — за него уже платят, а данные лежали мёртвым
          // грузом. Блоки 18-22 идут в контент-план, дизайн-систему каруселей,
          // генерацию баннеров и модуль лендингов.
          PERSONA_ARCHETYPES: pickTable(modulesForNiche, 'M6', 'BLOCK 18'),
          // По контракту это ОДНО поле из ДВУХ блоков (19 Visual Strategy + 19A
          // Archetype Map). pickTable ищет по вхождению подстроки и вернул бы
          // только первый; берём оба и склеиваем, защищаясь от случая, когда
          // «BLOCK 19» совпало с тем же «BLOCK 19A» (модель пропустила 19).
          VISUAL_STRATEGY: (() => {
            const a = pickTable(modulesForNiche, 'M6', 'BLOCK 19');
            const b = pickTable(modulesForNiche, 'M6', 'BLOCK 19A');
            return a === b ? a : [...a, ...b];
          })(),
          CONTENT_SYSTEM: pickTable(modulesForNiche, 'M6', 'BLOCK 20'),
          CREATIVE_BRIEFS: pickTable(modulesForNiche, 'M6', 'BLOCK 21'),
          LANDING_TZ: pickTable(modulesForNiche, 'M6', 'BLOCK 22'),
          // Не входит в контракт генерации, но полезно потребителю как справка:
          competitors: pickTable(modulesForNiche, 'M2', 'BLOCK 06'),
          hypotheses: pickTable(modulesForNiche, 'M5', 'BLOCK 16'),
        },
        modules: modulesForNiche,
      };
    }
    // Сводка провалившихся модулей на верхнем уровне — чтобы потребителю контракта
    // не приходилось обходить все ниши, проверяя status у каждого модуля. Пустой
    // массив = все модули отработали.
    const failedModules = [];
    for (const r of all) {
      if (r.failed || /^Error:/.test(String(r.content || '').trim())) {
        failedModules.push({ module: r.id, niche: r.niche || null, error: r.error || String(r.content || '').trim(), at: r.at || null });
      }
    }
    return {
      schema_version: 3,
      generated_at: new Date().toISOString(),
      research_language: lang,
      failed_modules: failedModules,
      project: brief,
      niches: (m12 && m12.nicheData && m12.nicheData.niches) || [],   // полная карта разведки (M1.2)
      selected_niches: nichesOf(brief),                                // какие из них реально исследованы в этом прогоне
      key_data: { AUDIENCE_SEGMENTS: audienceSegments },  // проектный уровень, не по нише — та же ссылка, что и в каждой нише выше
      global_modules: globalModules,
      research_by_niche: research_by_niche,
      executive_summary: report || '',
    };
  }

  root.CAContract = {
    GLOBAL_MODS: GLOBAL_MODS, isPerNiche: isPerNiche, dropOrphans: dropOrphans,
    nichesOf: nichesOf, resKey: resKey,
    splitMdRow: splitMdRow, isMdSeparator: isMdSeparator, parseMdTables: parseMdTables,
    buildModuleEntry: buildModuleEntry, pickTable: pickTable, pickColumn: pickColumn,
    withStableIds: withStableIds, buildAgentPackage: buildAgentPackage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
