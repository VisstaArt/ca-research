-- ДВЕ МИГРАЦИИ ОДНИМ ФАЙЛОМ. Применять целиком, порядок важен.
--
-- 003 — ключ должен подходить выбранному провайдеру: поймано на живом
--       заведении, ключ OpenRouter лежал в строке OpenAI и получал 401, а
--       человек читал «ключ не годится» и шёл перевыпускать рабочий ключ.
-- 004 — владелец проекта видит картинки своих слайдов сам, без обхода RLS
--       сервисным ключом.
--
-- Проверка, что встало: должно вернуть true и не упасть.
--   select public.key_fits_provider('openrouter', 'sk-or-v1-abc');
--   select policyname from pg_policies
--    where tablename = 'objects' and policyname = 'content_owner_reads';

-- Ключ должен подходить выбранному провайдеру.
--
-- Поймано на живом заведении 14.09.2026: в строку «OpenAI» вставлен ключ
-- OpenRouter (`sk-or-v1…`). База приняла, интерфейс показал «ключ подключён»,
-- и ошибка всплыла только при проверке — отказом 401 от OpenAI, куда этот ключ
-- ушёл. Человек при этом видел правильный хвост своего ключа и был уверен, что
-- всё верно.
--
-- Ошибка дорогая не деньгами, а временем: «ключ не годится» читается как
-- «ключ испорчен», и человек идёт перевыпускать рабочий ключ вместо того, чтобы
-- поменять провайдера в списке.
--
-- Проверяем ЗДЕСЬ, а не только в коде: строка заводится браузером напрямую в
-- базу, и наш код в этот момент не участвует. Проверка по началу ключа —
-- дешёвая и точная: префиксы у провайдеров устойчивые и публично задокументированы.
-- Она НЕ заменяет тестовый вызов: ключ может быть правильной формы и отозван.

create or replace function public.key_fits_provider(p_provider text, p_secret text)
returns boolean language sql immutable as $$
    select case p_provider
        -- У OpenRouter ключ начинается с sk-or-, у OpenAI — с sk-, но НЕ с sk-or-.
        -- Порядок проверок важен: sk-or-v1… подходит под «начинается с sk-».
        when 'openai'     then p_secret like 'sk-%' and p_secret not like 'sk-or-%'
                               and p_secret not like 'sk-ant-%'
        when 'openrouter' then p_secret like 'sk-or-%'
        when 'anthropic'  then p_secret like 'sk-ant-%'
        -- У Telegram это не ключ, а токен бота: «числа:буквы».
        when 'telegram'   then p_secret ~ '^[0-9]{6,}:[A-Za-z0-9_-]{20,}$'
        -- Google и Tavily устойчивого префикса не обещают — не выдумываем правило,
        -- которое завтра отвергнет рабочий ключ. Их проверит тестовый вызов.
        else true
    end
$$;

create or replace function public.set_provider_key(
    p_client uuid, p_name text, p_provider text, p_secret text,
    p_purpose text default '')
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
    v_name text := btrim(p_name);
    v_slot text;
    v_ref  uuid;
    v_hint text;
begin
    if not exists (select 1 from public.clients c
                   where c.id = p_client and c.owner_id = auth.uid()) then
        raise exception 'Проект не ваш или не существует';
    end if;
    if v_name = '' then
        raise exception 'У ключа должно быть название — по нему вы его узнаете';
    end if;
    if not public.allowed_provider(p_provider) then
        raise exception 'Неизвестный провайдер: %', p_provider;
    end if;
    if not public.allowed_purpose(coalesce(p_purpose, '')) then
        raise exception 'Неизвестное назначение: %', p_purpose;
    end if;
    p_secret := btrim(p_secret);
    if length(p_secret) < 16 then
        raise exception 'Похоже, это не ключ: слишком коротко';
    end if;

    -- Сообщение называет, ЧТО человек вставил, и что с этим делать. «Неверный
    -- ключ» отправило бы его перевыпускать рабочий ключ.
    if not public.key_fits_provider(p_provider, p_secret) then
        raise exception 'Этот ключ не похож на ключ «%». %', p_provider,
            case
                when p_secret like 'sk-or-%'  then 'Похоже на ключ OpenRouter — выберите его в списке.'
                when p_secret like 'sk-ant-%' then 'Похоже на ключ Anthropic. Напрямую его пока не умеем: Claude берём через OpenRouter.'
                when p_secret like 'sk-%'     then 'Похоже на ключ OpenAI — выберите его в списке.'
                else 'Проверьте, у того ли провайдера он выпущен.'
            end;
    end if;

    v_hint := right(p_secret, 4);
    v_slot := p_client::text || ':' || v_name;

    select id into v_ref from vault.secrets where name = v_slot;
    if v_ref is null then
        v_ref := vault.create_secret(p_secret, v_slot,
                                     'Ключ провайдера, заведён владельцем проекта');
    else
        perform vault.update_secret(v_ref, p_secret, v_slot,
                                    'Ключ провайдера, заменён владельцем проекта');
    end if;

    insert into public.provider_keys as k
        (client_id, name, provider, purpose, secret_ref, hint,
         verified, verified_at, updated_at)
    values (p_client, v_name, p_provider, coalesce(p_purpose, ''),
            v_ref::text, v_hint, false, null, now())
    on conflict (client_id, name) do update
        set provider = excluded.provider,
            purpose = excluded.purpose,
            secret_ref = excluded.secret_ref,
            hint = excluded.hint,
            verified = false,
            verified_at = null,
            updated_at = now();

    return v_hint;
end $$;

revoke all on function public.set_provider_key(uuid, text, text, text, text) from public, anon;
grant execute on function public.set_provider_key(uuid, text, text, text, text) to authenticated;


-- ─── 004 ───────────────────────────────────────────────

-- Картинки слайдов: владелец проекта видит свои файлы сам.
--
-- Зачем. Панель согласования показывает колоду карусели, а файлы лежат в
-- закрытом ведре `content`. Сегодня подписать ссылку может только сервисный
-- ключ — то есть сервер, обходящий RLS. Это работает, но означает, что право
-- «показать файл» держится на аккуратности кода, а не на правиле базы: забытая
-- проверка владельца в одной функции — и человек получит чужую карусель.
--
-- Решение владелицы про изоляцию арендатора (Р4) было принято ровно против
-- этого: «забытый WHERE client_id перестаёт быть утечкой, потому что база сама
-- не отдаёт чужую строку». Файлы — последнее место, где это ещё не так.
--
-- Как устроено. Ключ файла ВСЕГДА начинается с идентификатора клиента:
-- `<client_id>/slides/<тема>/NN-раскладка.jpg` (`SupabaseStorage.upload`
-- собирает путь сам и без клиента файл не кладёт). Значит первая часть пути —
-- это и есть арендатор, и правило читается прямо из неё.
--
-- Что НЕ меняется: класть и удалять файлы по-прежнему может только сервисный
-- ключ (воркер). Человеку даётся ровно одно право — читать своё. Подписанная
-- ссылка после этого выдаётся его собственным токеном, и сервер в этом больше
-- не участвует.

-- Ведро остаётся закрытым: публичного доступа не появляется.
-- (Строка на случай, если ведро ещё не заведено; если есть — ничего не меняет.)
insert into storage.buckets (id, name, public)
values ('content', 'content', false)
on conflict (id) do nothing;

drop policy if exists content_owner_reads on storage.objects;
create policy content_owner_reads on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'content'
        and exists (
            select 1
              from public.clients c
             where c.owner_id = auth.uid()
               -- Первая часть пути — client_id. `storage.foldername` отдаёт
               -- путь массивом, `[1]` — первый каталог.
               and c.id::text = (storage.foldername(name))[1]
        )
    );

-- Записи людям не даём: файлы кладёт воркер сервисным ключом. Человек, который
-- может записать в чужую папку, ломает доказуемость происхождения слайда — а
-- панель показывает эти картинки как «то, что выйдет к читателю».
drop policy if exists content_owner_writes on storage.objects;
