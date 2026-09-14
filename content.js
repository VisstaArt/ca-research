// Экраны контент-машины в оболочке.
//
// Договорённость 13.09.2026: контент-машина отдаёт ДАННЫЕ, а не разметку —
// эталон оформления один на две стороны, и кусок чужого HTML отстал бы от него
// при первой же правке. Здесь живёт только отрисовка; что показывать и в каком
// состоянии — решено на той стороне и перенесено как есть (ПЕРЕДАЧА-ЭКРАНОВ.md).
//
// Источник данных пока СНИМОК: `данные/*.json`, собранный их выгрузкой. Живой
// экран обязан читать базу — запросы запрошены у контент-агента 15.09. Пока
// снимок, на каждом экране об этом написано: цифра, за которой человек
// принимает решение, не должна молча стареть.
(function () {
  'use strict';

  var Д = { экраны: null, стык: null, ключи: null, когда: null };
  var загружено = false;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (с) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[с];
    });
  }
  function деньги(ц) {
    if (ц == null) return '';
    return ц >= 100 ? '$' + (ц / 100).toFixed(2) : Math.round(ц) + ' ¢';
  }
  function скл(n, a, b, c) {
    var h = Math.abs(n) % 100, t = h % 10;
    return (h > 10 && h < 20) || t === 0 || t >= 5 ? c : t === 1 ? a : b;
  }

  // Жемчужная плашка-заголовок — та же, что на экранах исследования: метка
  // раздела, имя экрана, одна фраза и факты. Бровь убрана 14.09 (владелица:
  // «слишком много заголовков»).
  function шапка(имя, подпись, факты, добавка) {
    var дл = (факты || []).filter(function (ф) { return ф && String(ф[1] || '').trim(); })
      .map(function (ф) { return '<div><dt>' + esc(ф[0]) + '</dt><dd>' + esc(ф[1]) + '</dd></div>'; })
      .join('');
    return '<div class="card nacre cover" style="margin-bottom:22px">'
      + '<div class="chead"><div>'
      + '<span class="kchip kchip-go rpt-mark"><span class="d"></span>Контент</span>'
      + '<h1 class="covername">' + esc(имя) + '</h1>'
      + (подпись ? '<p class="coversub">' + esc(подпись) + '</p>' : '')
      + (добавка || '')
      + '</div></div>'
      + (дл ? '<dl class="coverdl">' + дл + '</dl>' : '')
      + '</div>';
  }

  function пусто(заголовок, текст) {
    return '<div class="card"><h2>' + esc(заголовок) + '</h2>'
      + '<p class="lede" style="margin-bottom:0">' + esc(текст) + '</p></div>';
  }

  // Пометка остаётся навсегда, а не на время переноса: молчаливый откат на
  // снимок и есть тот случай, когда человек решает по устаревшему и не знает
  // об этом (согласовано с контент-агентом 15.09).
  function приписка() {
    if (Д.живое) return '';
    return '<p class="note" style="margin-top:18px">Данные показаны из выгрузки '
      + 'контент-машины, а не из живой базы: проект ещё не выбран или база не '
      + 'ответила. Цифры могут отставать — решение по ним сверьте на её стороне.</p>';
  }

  // ── Согласование ───────────────────────────────────────────────────────────
  // Решение Р2 переносится как есть: можно ли одобрить, считает контент-машина
  // (поле can_approve), интерфейс только показывает. При блокировке кнопка
  // недоступна — брак до публикации не доходит.
  var фильтрСогласования = 'all';

  function карточкаМатериала(м, i) {
    var сл = (Д.экраны.slides || []).filter(function (s) {
      return м.topic_id && s.storage_key && s.storage_key.indexOf(String(м.topic_id).slice(0, 8)) >= 0;
    });
    var находки = (м.findings || []).map(function (ф) {
      return '<li><b>' + esc(ф.message) + '</b>'
        + (ф.sample ? '<em>' + esc(ф.sample) + '</em>' : '') + '</li>';
    }).join('');
    var состояние = м.can_approve
      ? '<span class="kchip kchip-go"><span class="d"></span>можно одобрить</span>'
      : '<span class="kchip kchip-stop"><span class="d"></span>' + (м.blocking || 0) + ' '
        + скл(м.blocking || 0, 'блокировка', 'блокировки', 'блокировок') + '</span>';
    // Карусель показывается ЛЕНТОЙ СЛАЙДОВ, а не списком полей: человек
    // согласует то, что увидит читатель. Картинки лежат в закрытом ведре и
    // требуют подписанной ссылки — пока её нет, показываем ленту подписей.
    var лента = сл.length
      ? '<div class="mslides">' + сл.map(function (s, n) {
          return '<div class="mslide"><span>' + (n + 1) + '</span>' + esc(s.alt || 'Слайд') + '</div>';
        }).join('') + '</div>'
      : '';
    return '<div class="card mcard" data-ok="' + (м.can_approve ? '1' : '0') + '">'
      + '<div class="mhead"><div>'
      + '<span class="mfmt">' + esc(м.format || 'материал') + '</span>'
      + '<h3>' + esc((м.title || 'Материал ' + (i + 1))) + '</h3></div>' + состояние + '</div>'
      + (лента || '')
      + (м.body ? '<div class="mbody">' + esc(м.body).replace(/\n/g, '<br>') + '</div>' : '')
      + (находки ? '<div class="mfind"><span>что мешает выпустить</span><ul>' + находки + '</ul></div>' : '')
      + '<div class="mact">'
      + '<button class="kbtn kbtn-acc"' + (м.can_approve ? '' : ' disabled') + '>Одобрить</button>'
      + '<button class="kbtn">Отправить на доработку</button>'
      + '<span class="mprice">' + (м.cost_cents != null
          ? 'выпуск обойдётся в ' + деньги(м.cost_cents)
          : 'выпуск не тратит модель — текст уже написан') + '</span>'
      + '</div></div>';
  }

  function экранСогласования() {
    var все = Д.экраны.materials || [];
    if (!все.length) {
      return шапка('Согласование', 'Материалы, которые ждут вашего решения.')
        + пусто('Материалов нет', 'Контент-машина ещё ничего не подготовила по этому проекту. '
          + 'Материалы появятся здесь после первого запуска генерации.') + приписка();
    }
    var ждут = все.filter(function (м) { return м.can_approve; }).length;
    var блок = все.length - ждут;
    // Переключатель — ФИЛЬТР, а не подпись: по этим числам человек отбирает,
    // что смотреть. Вес 500: под крупным именем экрана 600 спорит с заголовком.
    var кнопки = [['all', 'Все', все.length], ['ok', 'Ждут решения', ждут], ['bad', 'С блокировкой', блок]]
      .map(function (к) {
        return '<button class="mseg' + (фильтрСогласования === к[0] ? ' on' : '') + '" data-ф="' + к[0] + '">'
          + к[1] + '<b>' + к[2] + '</b></button>';
      }).join('');
    var видимые = все.filter(function (м) {
      return фильтрСогласования === 'all' || (фильтрСогласования === 'ok' ? м.can_approve : !м.can_approve);
    });
    return шапка('Согласование', 'Человек согласует то, что увидит читатель.',
        [['Всего материалов', все.length], ['Ждут решения', ждут], ['С блокировкой', блок]],
        '<div class="mfilter">' + кнопки + '</div>')
      + видимые.map(карточкаМатериала).join('')
      + приписка();
  }

  // ── Темы ───────────────────────────────────────────────────────────────────
  // Одна тема даёт несколько материалов разных форматов: пост знакомит,
  // карусель разбирает, статья закрывает вопрос. В одну строку не сводим.
  function экранТем() {
    var темы = Д.экраны.topics || [];
    if (!темы.length) {
      return шапка('Темы', 'О чём говорим с аудиторией и почему именно об этом.')
        + пусто('Тем пока нет', 'Темы приходят из исследования: боли и запросы аудитории '
          + 'превращаются в темы после первого прогона.') + приписка();
    }
    var карточки = темы.map(function (т) {
      var свои = (Д.экраны.materials || []).filter(function (м) { return м.topic_id === т.id; });
      var форматы = свои.map(function (м) {
        return '<span class="tfmt">' + esc(м.format) + '</span>';
      }).join('');
      return '<div class="card tcard">'
        + '<div class="trub">' + esc(т.rubric || 'без рубрики') + '</div>'
        + '<h3>' + esc(т.title) + '</h3>'
        + (т.why ? '<p class="twhy">' + esc(т.why) + '</p>' : '')
        + (форматы ? '<div class="tfmts"><span>материалы по теме</span>' + форматы + '</div>'
                   : '<p class="note" style="margin:10px 0 0">Материалы по теме ещё не собраны.</p>')
        + '</div>';
    }).join('');
    return шапка('Темы', 'О чём говорим с аудиторией и почему именно об этом.',
        [['Тем', темы.length], ['Материалов', (Д.экраны.materials || []).length]])
      + карточки + приписка();
  }

  // ── Опубликовано ───────────────────────────────────────────────────────────
  // «Вручную» равноправно автомату: человек может взять текст и выложить сам,
  // и такой выход обязан учитываться — иначе аналитика врёт в меньшую сторону.
  function экранОпубликовано() {
    var п = Д.экраны.publications || [];
    if (!п.length) {
      var естьГотовые = (Д.экраны.materials || []).some(function (м) { return м.can_approve; });
      return шапка('Опубликовано', 'Что вышло — и автоматом, и вручную.')
        + пусто('Публикаций пока нет', естьГотовые
            ? 'Материалы согласованы, но ещё не выпущены. Выпустите их на экране «Согласование» — '
              + 'или выложите сами: выложенное вручную тоже попадёт сюда.'
            : 'Материалы ждут решения на экране «Согласование». Пока ни один не одобрен, публиковать нечего.')
        + приписка();
    }
    var строки = п.map(function (х) {
      return '<div class="tr"><div class="nm">' + esc(х.title || х.topic || 'Материал') + '</div>'
        + '<div>' + esc(х.channel || '—') + '</div>'
        + '<div>' + esc(х.manual ? 'вручную' : 'автоматом') + '</div>'
        + '<div>' + esc(х.published_at || '') + '</div></div>';
    }).join('');
    return шапка('Опубликовано', 'Что вышло — и автоматом, и вручную.', [['Публикаций', п.length]])
      + '<div class="card"><div class="dtbl" style="--cols:1fr 160px 120px 140px">'
      + '<div class="th"><span>Материал</span><span>Площадка</span><span>Как вышло</span><span>Когда</span></div>'
      + строки + '</div></div>' + приписка();
  }

  // ── Расход ─────────────────────────────────────────────────────────────────
  // Знаменателя «осталось из…» НЕТ и рисовать его нельзя: кредиты в тарифе не
  // назначены. Показываем потраченное — оно измерено. quota: null об этом.
  function экранРасхода() {
    var р = Д.экраны.spend || {};
    var строки = [
      ['Обращений к модели', р.llm_calls],
      ['Токенов на вход', р.tokens_in],
      ['Токенов на выход', р.tokens_out],
      ['Картинок', р.image_calls],
      ['Поисковых запросов', р.search_calls],
    ].filter(function (с) { return с[1]; })
      .map(function (с) {
        return '<div class="tr"><div class="nm">' + esc(с[0]) + '</div><div>'
          + String(с[1]).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '</div></div>';
      }).join('');
    var шапочка = шапка('Расход', 'Сколько потрачено на контент за период.',
      [['Потрачено', деньги(р.cost_cents)], ['С', р.period_from || '']]);
    return шапочка
      + '<div class="card"><h2>Из чего сложилось</h2>'
      + (строки ? '<div class="dtbl" style="--cols:1fr 160px">' + строки + '</div>'
                : '<p class="lede">За период ничего не потрачено.</p>')
      + '<p class="note">Показано только потраченное. Запаса «осталось из…» здесь нет '
      + 'намеренно: кредиты в тарифе не назначены, и знаменатель пришлось бы выдумать.</p>'
      + '</div>' + приписка();
  }

  // ── Ключи ──────────────────────────────────────────────────────────────────
  // Вопрос про ключ задаётся в настройке блока и ТОЛЬКО в режиме собственных
  // ключей; на подписке не показывается вовсе. Две строки с одним провайдером —
  // норма: отдельный счёт на тексты, отдельный на картинки.
  function экранКлючей() {
    var к = Д.ключи || {};
    var шаги = (к.steps || []).map(function (ш) {
      var модели = (ш.models || []).map(function (м) { return '<li>' + esc(м) + '</li>'; }).join('');
      return '<div class="card kcard">'
        + '<div class="kwhere">' + esc((к.purposes && к.purposes[ш.purpose]) || ш.purpose) + '</div>'
        + '<h3>' + esc(ш.title) + '</h3>'
        + (модели ? '<div class="kmod"><span>чем можно</span><ul>' + модели + '</ul></div>' : '')
        + (ш.without ? '<p class="note" style="margin:10px 0 0">' + esc(ш.without) + '</p>' : '')
        + '</div>';
    }).join('');
    return шапка('Ключи и оплата', 'Где спрашивается ключ и что будет без него.',
        [['Мест, где нужен ключ', (к.steps || []).length]])
      + (шаги || пусто('Ключи не нужны', 'На подписке всё работает на ключах платформы.'))
      + (к.note ? '<p class="note">' + esc(к.note) + '</p>' : '')
      + приписка();
  }

  // ── Что ушло в контент (стык) ──────────────────────────────────────────────
  function экранСтыка() {
    var с = Д.стык || {};
    var ниши = с.niches || [];
    if (!ниши.length) {
      return шапка('Что ушло в контент', 'Какие поля исследования доехали до контент-машины.')
        + пусто('Пока пусто — и это законное состояние',
            с.note || 'Ниш ещё нет: таблица заполнится после первого прогона исследования. '
            + 'Тогда здесь будет видно, какие поля пришли, каких не хватает и что без каждого не соберётся.')
        + приписка();
    }
    var карточки = ниши.map(function (н) {
      var нет = (н.missing || []).map(function (п) {
        return '<li><b>' + esc(п.field || п) + '</b>'
          + (п.blocks ? '<em>без него не соберётся: ' + esc(п.blocks) + '</em>' : '') + '</li>';
      }).join('');
      return '<div class="card"><h3>' + esc(н.niche || 'ниша') + '</h3>'
        + '<p class="lede" style="margin-bottom:10px">Пришло полей: <b>' + ((н.present || []).length) + '</b>'
        + ', не хватает: <b>' + ((н.missing || []).length) + '</b></p>'
        + (нет ? '<div class="mfind"><span>чего не хватает</span><ul>' + нет + '</ul></div>' : '')
        + '</div>';
    }).join('');
    return шапка('Что ушло в контент', 'Какие поля исследования доехали до контент-машины.',
        [['Ниш', ниши.length]]) + карточки + приписка();
  }

  var ЭКРАНЫ = {
    inbox: экранСогласования,
    topics: экранТем,
    done: экранОпубликовано,
    spend: экранРасхода,
    keys: экранКлючей,
    nishi: экранСтыка,
  };

  function нарисовать(имя) {
    var секция = document.getElementById('s-' + имя);
    if (!секция || !ЭКРАНЫ[имя]) return;
    if (!загружено) {
      секция.innerHTML = '<div class="card"><p class="lede">Загружаю данные контент-машины…</p></div>';
      return;
    }
    try { секция.innerHTML = ЭКРАНЫ[имя](); }
    catch (e) {
      секция.innerHTML = '<div class="card"><p class="lede">Экран не собрался: ' + esc(e.message)
        + '. Данные контент-машины на месте, дело в отрисовке — это наша сторона.</p></div>';
      if (window.console) console.error('Экран ' + имя + ':', e);
    }
  }

  function нарисоватьВсе() {
    Object.keys(ЭКРАНЫ).forEach(нарисовать);
  }

  // Переключатель на «Согласовании» — фильтр, поэтому перерисовывает список.
  document.addEventListener('click', function (соб) {
    var к = соб.target.closest && соб.target.closest('.mseg');
    if (!к) return;
    фильтрСогласования = к.getAttribute('data-ф') || 'all';
    нарисовать('inbox');
  });

  function снимок(имя) {
    return fetch('данные/' + имя + '.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  // ── Живая база ─────────────────────────────────────────────────────────────
  // Запросы — от контент-агента (15.09), под токеном вошедшего: политики RLS
  // пускают только владельца клиента. secret_ref в ключах НЕ берём никогда.
  function таблица(запрос) {
    var A = window.CAAuth;
    if (!A || !A.getAccessToken || !A.getAccessToken()) return Promise.resolve(null);
    return fetch(A.SUPABASE_URL + '/rest/v1/' + запрос, {
      headers: { apikey: A.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + A.getAccessToken() },
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  // Заголовка как поля у поста и статьи нет: разбор под него не заведён.
  // У карусели он есть — parsed.cover_headline. Иначе берём первую строку
  // текста, сняв разметку: это и есть то, что читатель увидит первым.
  function заголовок(м) {
    var п = м.parsed || {};
    if (п.cover_headline) return String(п.cover_headline).trim();
    var первая = String(м.body || '').split('\n')[0];
    return первая.replace(/<[^>]+>/g, '').replace(/[*_#`]/g, '').trim().slice(0, 120);
  }

  function изБазы(клиент) {
    var к = encodeURIComponent(клиент);
    var месяц = new Date().toISOString().slice(0, 7) + '-01';
    return Promise.all([
      таблица('content_items?select=id,topic_id,lang,format,status,body,parsed,findings,updated_at&client_id=eq.' + к + '&order=updated_at.desc'),
      таблица('topics?select=id,title,rubric,why,seo_cluster&client_id=eq.' + к + '&order=created_at.desc'),
      таблица('content_publications?select=item_id,platform,url,method,published_at&client_id=eq.' + к + '&order=published_at.desc'),
      таблица('usage_counters?select=*&client_id=eq.' + к + '&period=gte.' + месяц),
      таблица('assets?select=storage_key,kind,alt,created_at&client_id=eq.' + к + '&kind=eq.slide&order=created_at.desc'),
      таблица('audience_research?select=niche,research_lang,package,version,imported_at&client_id=eq.' + к + '&is_current=eq.true&order=niche'),
      таблица('provider_keys?select=name,provider,purpose,hint,verified,verified_at,updated_at&client_id=eq.' + к + '&order=name'),
    ]).then(function (р) {
      if (!р[0] && !р[1] && !р[3]) return null;     // база не ответила вовсе
      var расход = (р[3] || []).reduce(function (а, с) {
        Object.keys(с).forEach(function (k) { if (typeof с[k] === 'number') а[k] = (а[k] || 0) + с[k]; });
        return а;
      }, { period_from: месяц });
      return {
        живое: true,
        экраны: {
          materials: (р[0] || []).map(function (м) {
            var н = м.findings || [];
            var блок = н.filter(function (ф) { return ф.severity === 'block'; }).length;
            return {
              topic_id: м.topic_id, lang: м.lang, format: м.format, status: м.status,
              title: заголовок(м), body: м.body,
              findings: н, blocking: блок,
              // Правило целиком, слово в слово с контент-машиной: статус
              // «ждёт решения» И ноль блокирующих находок. Без проверки
              // статуса кнопка «Одобрить» оживала на том, что уже одобрено
              // или уже вышло, — а это вторая публикация (её разбор 15.09).
              can_approve: м.can_approve != null
                ? м.can_approve
                : (м.status === 'pending' && блок === 0),
            };
          }),
          topics: р[1] || [],
          publications: (р[2] || []).map(function (п) {
            return { title: п.item_id, channel: п.platform, url: п.url,
                     manual: п.method === 'manual', published_at: (п.published_at || '').slice(0, 10) };
          }),
          spend: расход,
          slides: р[4] || [],
        },
        стык: { niches: (р[5] || []).map(function (н) {
          var п = н.package || {};
          var есть = Object.keys(п).filter(function (k) {
            var v = п[k]; return v && !(Array.isArray(v) && !v.length);
          });
          var нет = Object.keys(п).filter(function (k) { return есть.indexOf(k) < 0; })
            .map(function (k) { return { field: k }; });
          return { niche: н.niche, present: есть, missing: нет };
        }) },
        ключи: р[6] || null,
      };
    });
  }

  // Какой проект открыт. Оболочка знает его сама (она рисует список проектов) и
  // кладёт в window.CAContentClient при переключении; запасной путь — адрес.
  function текущийКлиент() {
    if (window.CAContentClient) return window.CAContentClient;
    try { return new URLSearchParams(location.search).get('client') || ''; } catch (e) { return ''; }
  }

  function загрузить() {
    var клиент = текущийКлиент();
    return Promise.all([снимок('экраны'), снимок('стык'), снимок('ключи'),
                        клиент ? изБазы(клиент) : Promise.resolve(null)]).then(function (р) {
      var живое = р[3];
      Д.экраны = (живое && живое.экраны) || р[0] || { materials: [], topics: [], publications: [], spend: {}, slides: [] };
      Д.стык = (живое && живое.стык) || р[1] || { niches: [] };
      // Ключи: список мест, где спрашивать, — справочник контент-машины, он в
      // снимке. Из базы приходят ЗАВЕДЁННЫЕ ключи, а не места.
      Д.ключи = р[2] || { steps: [] };
      Д.заведённые = (живое && живое.ключи) || null;
      Д.живое = !!живое;
      загружено = true;
      нарисоватьВсе();
    });
  }
  загрузить();

  // Переключили проект — данные другие. Оболочка зовёт это после смены.
  window.CAContent = { нарисовать: нарисовать, нарисоватьВсе: нарисоватьВсе, обновить: загрузить };
})();
