/**
 * Собирает `llms.txt` — индекс справочника для агента, работающего в чужом
 * репозитории (ADR-0044).
 *
 * ЗАЧЕМ ИНДЕКС, ЕСЛИ СТРАНИЦЫ И ТАК В ПАКЕТЕ. Агент не перечисляет файлы, он
 * читает то, на что ему указали. Восемьдесят пять страниц без указателя — это
 * либо «прочитай всё» (565 кБ контекста), либо «угадай имя файла».
 *
 * ЧЕГО ЗДЕСЬ НЕТ. `llms-full.txt` — склейки всего текста в один файл. Она нужна
 * сайтам, где файлов не перечислить; у кита страницы лежат рядом, в
 * `node_modules/@olddevs/ui/docs/`, и склейка была бы второй копией тех же
 * 565 кБ, расходящейся с первой молча.
 *
 * ПОЧЕМУ ГЕНЕРАТОР, А НЕ ФАЙЛ РУКАМИ. Индекс, написанный руками, протухает на
 * первой же добавленной странице, и заметить это нечем: он не компилируется и
 * не тестируется сам по себе. Здесь он выводится из `docs/`, а `llms:check`
 * роняет сборку, если вывод разошёлся с файлом в репозитории.
 *
 * ПОРЯДОК РАЗДЕЛОВ берётся у кураторских индексов — `docs/index.md` и
 * `docs/components/index.md`: это тот порядок, в котором страницы читает
 * человек, и придумывать второй незачем. Страница, не попавшая ни в один из
 * них, не теряется — она уходит в последний раздел. Потерять страницу индекс не
 * может по устройству.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, dirname, normalize } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS = join(ROOT, "docs");
const OUT = join(ROOT, "llms.txt");

/** Все страницы справочника, путями от корня пакета: `docs/…`. */
function pages(dir = DOCS) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    // Перевод (`X.en.md`, ADR-0062) — не своя страница, а английская сторона
    // Оригинала: индекс ведёт на Оригинал, и Перевод лежит рядом с ним.
    return name.endsWith(".md") && !name.endsWith(".en.md") ? [relative(ROOT, full)] : [];
  });
}

/**
 * Заголовок и первая фраза страницы.
 *
 * Отсутствие `# ` — отказ, а не пропуск: страница без заголовка попала бы в
 * индекс безымянной строкой, и агент не понял бы, что за ней. Молчаливый
 * пропуск здесь хуже падения: он оставляет дыру, которую никто не ищет.
 */
function describe(page) {
  const text = readFileSync(join(ROOT, page), "utf8");
  const title = /^#\s+(.+)$/m.exec(text);
  if (!title) throw new Error(`${page} has no "# " heading — cannot be indexed`);

  const body = text.slice(text.indexOf(title[0]) + title[0].length);
  const paragraph = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    /*
      Заголовки, цитаты, списки, таблицы и блоки кода описанием не служат:
      первым абзацем `getting-started.md` идёт пример импорта, и в индексе он
      выглядел как строка кода вместо фразы о странице.

      А вот ОДИНОЧНАЯ обратная кавычка — это имя компонента в начале фразы
      («`TextControl` — базовое текстовое поле…»), и отбрасывать такой абзац
      нельзя: ровно так начинается «Кратко для AI» у половины страниц, и в
      индексе они оставались вовсе без описания. Исключается только ограда
      блока кода — три кавычки подряд.
    */
    .find((block) => block && !/^(?:[#>|\-*\d]|```)/.test(block));

  const sentence = (paragraph ?? "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    // Ссылки разворачиваются в текст: в описании они вели бы относительно
    // страницы, а читают описание из корня пакета.
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .split(/(?<=\.)\s/)[0];

  return { title: title[1].trim(), sentence: sentence.slice(0, 200) };
}

/** Разделы кураторского индекса: `## Заголовок` и ссылки под ним. */
function sectionsOf(index) {
  const text = readFileSync(join(ROOT, index), "utf8");
  const out = [];
  let current = null;
  for (const line of text.split("\n")) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      current = { title: heading[1].trim(), pages: [] };
      out.push(current);
      continue;
    }
    const link = /\]\(([^)#]+\.md)\)/.exec(line);
    if (link && current) {
      const page = normalize(join(dirname(index), link[1]));
      // Только то, что уезжает в пакет. `docs/index.md` ссылается и наружу — на
      // макет в соседнем репозитории, на `CLAUDE.md` рядом с манифестом; ни
      // того, ни другого у потребителя нет, и строка индекса вела бы в пустоту.
      if (page.startsWith("docs/") && !current.pages.includes(page)) current.pages.push(page);
    }
  }
  return out.filter((section) => section.pages.length > 0);
}

const all = pages();
const indexes = ["docs/index.md", "docs/components/index.md"];
const sections = indexes.flatMap(sectionsOf);

// Корневой указатель ставится первой строкой первого раздела: сам он себя не
// перечисляет, а агенту нужен — там лежат правила обращения с китом.
if (sections[0] && !sections[0].pages.includes("docs/index.md"))
  sections[0].pages.unshift("docs/index.md");

const listed = new Set(sections.flatMap((section) => section.pages));
const rest = all.filter((page) => !listed.has(page));
if (rest.length > 0) sections.push({ title: "Остальные страницы", pages: rest });

const entry = (page) => {
  const { title, sentence } = describe(page);
  return `- [${title}](${page})${sentence ? `: ${sentence}` : ""}`;
};

const body = [
  "# @olddevs/ui",
  "",
  "> Дизайн-система: токены, темы и доступные UI-примитивы для React. Этот файл —",
  "> индекс справочника, который едет вместе с пакетом.",
  "",
  "Ссылки ниже относительные и ведут внутрь пакета: читать их надо от его корня, то",
  "есть от `node_modules/@olddevs/ui/`. Там лежит Справочник именно той версии, что",
  "установлена у вас. Сайт документации — https://ui.olddevs.ru.",
  "",
  "Файл собран скриптом `scripts/llms.mjs` из `docs/`. Править надо страницы, а не",
  "его: расхождение роняет `npm run llms:check`.",
  "",
  ...sections.flatMap((section) => [`## ${section.title}`, "", ...section.pages.map(entry), ""]),
]
  .join("\n")
  .replace(/\n{3,}/g, "\n\n");

const previous = (() => {
  try {
    return readFileSync(OUT, "utf8");
  } catch {
    return null;
  }
})();

if (process.argv.includes("--check")) {
  if (previous !== body) {
    console.error("✗ llms.txt is out of date. Run `npm run llms` and commit the result.");
    process.exit(1);
  }
  console.log(`✓ llms.txt matches docs/ — ${all.length} pages in ${sections.length} sections`);
} else {
  writeFileSync(OUT, body);
  console.log(`✓ llms.txt written — ${all.length} pages in ${sections.length} sections`);
}
