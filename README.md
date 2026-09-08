# ca-research

## Сборка

Страницы собираются заранее, а не в браузере. Без этого браузер качал
трёхмегабайтный Babel при каждом первом открытии и собирал страницу у себя —
владелица 07.09.2026: «загружается долго».

    osascript -l JavaScript tools/build.js    # shell.jsx → shell.js, app.jsx → app.js
    osascript -l JavaScript tools/check.js    # собранное соответствует исходному?

Node не нужен: Babel лежит файлом в `tools/`, запускается движком JS,
встроенным в macOS. Ставить нечего.

**Править только `.jsx`.** Файлы `app.js` и `shell.js` собраны автоматически,
правки в них затрутся следующей сборкой. `check.js` ловит забытую пересборку —
запускать перед выкладкой вместе с тестами:

    osascript -l JavaScript tests/contract.test.js
    osascript -l JavaScript tests/migrate.test.js
