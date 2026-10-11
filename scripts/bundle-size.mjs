/**
 * Бюджет размера: сколько пакет стоит потребителю.
 *
 * МЕТОД — ЧАСТЬ ПРОВЕРКИ, поэтому он зафиксирован здесь, а не подразумевается.
 *
 * - Меряется собранный `dist`, а не `src`: потребитель ставит именно его.
 * - Сборка — rollup внутри vite, тот же сборщик, что у большинства потребителей.
 * - React и все peer-зависимости объявлены внешними. Иначе в числе оказался бы
 *   react-aria, а не кит, и бюджет реагировал бы на чужие релизы.
 * - Минификация включена, метрика — **gzip**: по сети едет именно он.
 *
 * Числа этого скрипта отвечают за деревотряску внутри пакета. Они НЕ отвечают
 * за то, сколько получит пользователь Next.js: там граница клиентского графа
 * добавляет своё, и импорт одной кнопки умеет стоить 306 кБ при 6 кБ по этому
 * замеру (ADR-0029). Ту, вторую, величину меряет `npm run check:consumer` — по
 * бюджетам из того же файла, что и здесь.
 */

import { Buffer } from "node:buffer";
import { gzipSync } from "node:zlib";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "vite";
import { BUDGETS, PACKAGE_SCENARIOS } from "./bundle-size.budgets.mjs";
import { EDITOR_ENGINE } from "./editor-engine.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");

if (!existsSync(join(DIST, "index.js"))) {
  console.error(
    "✗ The dist directory is missing or empty. Run `npm run build` — there is nothing to measure."
  );
  process.exit(1);
}

/**
 * Внешние: всё, что потребитель ставит сам. Список выведен из `package.json`,
 * а не выписан руками, — иначе новая peer-зависимость молча попала бы в замер.
 * Движок Редактора в манифесте не объявлен (OLDSUI-195), его список — в
 * `editor-engine.mjs`.
 */
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const EXTERNAL = [
  ...Object.keys(manifest.peerDependencies ?? {}),
  ...Object.keys(manifest.dependencies ?? {}),
  ...EDITOR_ENGINE,
  "react/jsx-runtime",
  "react-dom",
];

// Временная папка внутри пакета: резолвинг peer-зависимостей идёт от входного
// файла, а в системном tmp никакого node_modules нет.
const tmp = mkdtempSync(join(ROOT, ".tmp-size-"));

/**
 * Входы пакета — точными именами, а не префиксом. Строковый алиас vite
 * срабатывает и на подпуть: `@olddevs/ui/editor` превратился бы в
 * `dist/index.js/editor`. Поэтому каждое имя — регулярным выражением целиком.
 */
const ENTRIES = [
  {
    find: /^@olddevs\/ui\/editor\/highlight$/,
    replacement: join(DIST, "editor", "highlight-entry.js"),
  },
  {
    find: /^@olddevs\/ui\/editor\/schema$/,
    replacement: join(DIST, "editor", "schema-entry.js"),
  },
  { find: /^@olddevs\/ui\/editor$/, replacement: join(DIST, "editor", "index.js") },
  { find: /^@olddevs\/ui$/, replacement: join(DIST, "index.js") },
];

async function measure(scenario) {
  const entry = join(tmp, `${scenario.key}.js`);
  writeFileSync(entry, scenario.source, "utf8");

  /*
    Сценарий вправе ВНЕСТИ в замер часть внешних пакетов — `bundled`, список
    префиксов имён. Так меряется цена движка редактора: Tiptap ставит
    потребитель, но выбор расширений принадлежит киту, и лишнее расширение стоит
    потребителю ровно столько же, сколько лишний код самого кита. Внешними
    остаются и подпути (`@tiptap/pm/state`): сравнение идёт по началу имени.
  */
  const bundled = scenario.bundled ?? [];
  const external = (id) =>
    !bundled.some((prefix) => id.startsWith(prefix)) &&
    EXTERNAL.some((name) => id === name || id.startsWith(`${name}/`));

  const result = await build({
    root: tmp,
    logLevel: "error",
    resolve: { alias: ENTRIES },
    build: {
      outDir: join(tmp, `out-${scenario.key}`),
      emptyOutDir: true,
      minify: "esbuild",
      target: "es2022",
      lib: { entry, formats: ["es"], fileName: "bundle" },
      rollupOptions: { external },
      // В память: чанки считаются ниже по признаку, а не по имени файла.
      write: false,
    },
  });

  /*
    Два числа на сценарий (ADR-0058, п. 11.7). «Старт» — то, что едет
    потребителю сразу: чанк входа и всё, что он импортирует статически.
    «Полный» — весь граф, вместе с чанками по `import()`: поповер своего цвета
    (OLDSUI-46, `ColorPicker`), ленивые `codeBlock` и `table` (OLDSUI-111),
    загрузчики своих Инструментов. Раньше ленивые чанки молча отбрасывались, и
    перенос кода за `import()` выглядел как чистая экономия; теперь их вес
    печатается у каждого сценария, а сценарий с `chunks: "all"` им и меряется.
    Без разбора на чанки сборщик оставлял бы в `bundle.js` заглушку, а код
    уходил в соседний файл — и замер показывал бы ноль на любом входе с
    динамическим импортом. Чанки склеиваются в одну строку: так же gzip видел
    один файл до разбора.
  */
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.output);
  const chunks = outputs.filter((file) => file.type === "chunk");
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  // Статические импорты от входа: `isDynamicEntry` не годится — общий чанк
  // ленивого и статического графа тоже бывает целью `import()`.
  const initial = new Set();
  const visit = (chunk) => {
    if (!chunk || initial.has(chunk)) return;
    initial.add(chunk);
    for (const name of chunk.imports) visit(byName.get(name));
  };
  for (const chunk of chunks) if (chunk.isEntry) visit(chunk);
  const size = (list) => {
    const bytes = Buffer.from(list.map((chunk) => chunk.code).join("\n"), "utf8");
    return { raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
  };
  const start = size([...initial]);
  const full = size(chunks);
  const modules = (list) => list.flatMap((chunk) => Object.keys(chunk.modules));
  return {
    ...(scenario.chunks === "all" ? full : start),
    lazy: full.gzip - start.gzip,
    startModules: modules([...initial]),
    allModules: modules(chunks),
  };
}

/**
 * Шов «старта» (ADR-0058, п. 11.1, 11.7): модулей ленивых встроенных нет в
 * статическом графе, но они есть в полном. Вторая половина проверки — против
 * вечно зелёного гейта: шаблон, который ничему не соответствует (модуль
 * переименован, путь сменился), обязан ронять проверку, а не проходить.
 */
function startLeaks(scenario, { startModules, allModules }) {
  return (scenario.notInStart ?? []).flatMap((pattern) => {
    if (!allModules.some((id) => id.includes(pattern))) {
      return [`${scenario.key}: no module matches “${pattern}” at all — update the pattern`];
    }
    const leaked = startModules.filter((id) => id.includes(pattern));
    return leaked.length > 0
      ? [
          `${scenario.key}: the start graph contains ${leaked.map((id) => id.slice(ROOT.length)).join(", ")}`,
        ]
      : [];
  });
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

let exitCode = 0;

try {
  const rows = [];
  const measured = {};
  const leaks = [];
  let failed = false;

  for (const scenario of PACKAGE_SCENARIOS) {
    const budget = BUDGETS.package[scenario.key];
    if (budget === undefined) {
      console.error(`✗ Scenario “${scenario.key}” has no budget in bundle-size.budgets.mjs`);
      exitCode = 1;
      break;
    }

    const measurement = await measure(scenario);
    const { raw, gzip, lazy } = measurement;
    measured[scenario.key] = gzip;
    leaks.push(...startLeaks(scenario, measurement));
    const slack = budget - gzip;
    if (slack < 0) failed = true;

    rows.push(
      [
        scenario.title.padEnd(40),
        format(raw).padStart(10),
        format(gzip).padStart(10),
        (scenario.chunks === "all" ? "counted" : format(lazy)).padStart(10),
        format(budget).padStart(10),
        (slack < 0 ? `over by ${format(-slack)}` : `slack ${format(slack)}`).padStart(22),
      ].join(" ")
    );
  }

  console.log(
    [
      "Scenario".padEnd(40),
      "raw".padStart(10),
      "gzip".padStart(10),
      "lazy".padStart(10),
      "budget".padStart(10),
    ].join(" ")
  );
  console.log(rows.join("\n"));
  console.log(
    "\nlazy — gzip of the import() chunks on top of the start; a scenario marked “counted” " +
      "measures the whole graph (ADR-0058, 11.7)."
  );

  if (leaks.length > 0) {
    console.error(
      `\n✗ The start graph of the editor must not carry the lazy built-ins (ADR-0058, 11.1):\n` +
        leaks.map((line) => `  ${line}`).join("\n")
    );
    exitCode = 1;
  }

  if (failed) {
    console.error(
      "\n✗ The size budget is exceeded. Either an import pulled in too much, or the component " +
        "grew for a reason. In the latter case raise the budget in " +
        "scripts/bundle-size.budgets.mjs as a SEPARATE line in the MR — with an explanation of " +
        "what exactly grew."
    );
    exitCode = 1;
  }

  // Числа в документации — часть контракта с читателем, и устаревают они молча.
  // Поэтому таблица «Размер импорта» сверяется с замером: расхождение
  // больше десятой доли килобайта роняет проверку, а не остаётся на совести.
  const doc = readFileSync(join(ROOT, "docs", "getting-started.md"), "utf8");
  // Именно раздел, а не весь файл: на странице есть вторая таблица — про цену
  // границы клиентского графа, — и строки в ней называются почти так же.
  // Заголовок раздела и единица «кБ» — РУССКИЕ НАМЕРЕННО: скрипт разбирает
  // `docs/getting-started.md`, а документация остаётся русской (ADR-0034).
  // Перевести их значит разорвать сверку и получить вечно зелёный гейт.
  const section = doc.split("## Размер импорта")[1]?.split("\n## ")[0];

  if (!section) {
    console.error(
      "\n✗ docs/getting-started.md has no import-cost section — " +
        "there is nothing to compare the numbers with."
    );
    exitCode = 1;
  } else {
    const stale = [];

    for (const { key, documented } of PACKAGE_SCENARIOS) {
      const row = section.split("\n").find((line) => line.includes(`| ${documented}`));
      if (!row) {
        stale.push(
          `${key}: the row “${documented}” is missing from the table in docs/getting-started.md`
        );
        continue;
      }

      const written = Number(row.match(/([\d]+(?:[.,]\d+)?)\s*кБ/)?.[1]?.replace(",", "."));
      const actual = Number((measured[key] / 1024).toFixed(1));
      if (!Number.isFinite(written) || Math.abs(written - actual) > 0.1) {
        stale.push(`${key}: the docs say ${written} kB, the measurement says ${actual} kB`);
      }
    }

    if (stale.length > 0) {
      console.error(
        `\n✗ The import-cost table in docs/getting-started.md has diverged from the ` +
          `measurement:\n${stale.map((line) => `  ${line}`).join("\n")}`
      );
      exitCode = 1;
    }
  }

  if (exitCode === 0) {
    console.log(
      "\n✓ the package contribution is within budget; the documented numbers match the measurement"
    );
  }
} finally {
  // Уборка обязана случиться при любом исходе. Поэтому здесь нет ни одного
  // `process.exit` выше по течению: он обходит finally, и временная папка
  // остаётся в репозитории — линтер следующего прогона падает уже на ней.
  rmSync(tmp, { recursive: true, force: true });
}

process.exit(exitCode);
