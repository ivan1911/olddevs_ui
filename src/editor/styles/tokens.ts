/**
 * Сопоставление переменных shadcn и minimal-tiptap с токенами кита — в одном
 * месте (ADR-0050, контракт «токены»).
 *
 * КАК ЭТО РАБОТАЕТ. Перенесённый код говорит на языке shadcn: `--primary`,
 * `--muted-foreground`, `--border`, а оформление minimal-tiptap — ещё и своими
 * `--mt-hr`, `--mt-code-background`, `--mt-secondary`, у которых значения
 * литеральные и раздельные для `.dark`. Здесь каждая такая роль получает
 * переменную с префиксом `--rte-`, а значение — переменную кита. Классы
 * Документа ссылаются только на `--rte-*` (`bg-(--rte-hr)`), литеральных цветов и
 * радиусов в них нет.
 *
 * ПОЧЕМУ ПРЕФИКС, А НЕ СОБСТВЕННЫЕ ИМЕНА shadcn. Приложение потребителя вполне
 * может само стоять на shadcn и объявлять `--primary` в своём формате (HSL без
 * обёртки). Переобъявление на корне Редактора перекрасило бы чужие компоненты,
 * оказавшиеся внутри него, а чужое значение — наш.
 *
 * ПОЧЕМУ КЛАССАМИ, А НЕ `style`. Произвольные свойства Tailwind
 * (`[--rte-hr:var(--line)]`) работают и в серверном рендере `RichTextView`, и
 * без единого инлайн-стиля в разметке. Каждое имя записано целиком — Tailwind
 * читает исходник как текст и склейку имени не увидел бы.
 *
 * ТЕМЫ. Значения — переменные кита, а не цвета, поэтому `dark`, `light` и `dim`
 * переключаются сами, без второй таблицы под `.dark`, как было в оригинале.
 *
 * | Роль (`--rte-*`)          | Где в Документе                        | Токен кита         | Лист (`paper`)     |
 * | ------------------------- | -------------------------------------- | ------------------ | ------------------ |
 * | `background`              | фон листа, мерка цвета автора          | `--bg-2`           | `--od-cloud-12`    |
 * | `foreground`              | основной текст, курсор-щель            | `--fg-0`           | `--od-cloud-1`     |
 * | `secondary`               | цитата, шапка блока кода (язык, копия) | `--fg-1`           | `--od-cloud-2`     |
 * | `muted`                   | подпись картинки, выполненный пункт    | `--fg-2`           | `--od-cloud-3`     |
 * | `muted-foreground`        | плейсхолдеры                           | `--fg-3`           | `--od-cloud-4`     |
 * | `primary`                 | флажок, контур и ручка картинки        | `--accent`         | `--accent`         |
 * | `ring`                    | фокус контролов внутри Документа       | `--accent-strong`  | `--accent` ¹       |
 * | `link`                    | ссылка                                 | `--accent-strong`  | `--accent` ¹       |
 * | `text-accent`             | цвет текста `accent`                   | `--accent-strong`  | `--accent` ¹       |
 * | `text-success`            | цвет текста `success`                  | `--success-strong` | `--od-green-1`     |
 * | `text-warning`            | цвет текста `warning`                  | `--warning-strong` | `--od-amber-1`     |
 * | `text-danger`             | цвет текста `danger`                   | `--danger-strong`  | `--od-red-1`       |
 * | `text-lime`               | цвет текста `lime`                     | `--draft-strong`   | `--od-lime-1`      |
 * | `text-muted`              | цвет текста `muted`                    | `--fg-2`           | `--od-cloud-3`     |
 * | `selection`               | выделение текста и ячеек               | `--selection`      | `--selection-light` ¹ |
 * | `selection-marker`        | выделение поверх яркого маркера ²      | `--accent` 38 %    | `--accent` 38 %    |
 * | `control-hover`           | наведение на кнопку внутри Документа   | `--bg-2`           | `--od-cloud-9`     |
 * | `quote`                   | полоса цитаты                          | `--line`           | `--od-cloud-6`     |
 * | `hr`                      | черта, рамки ячеек                     | `--line`           | `--od-cloud-6`     |
 * | `code-background`         | строчный код, шапка таблицы            | `--bg-3`           | `--od-cloud-11`    |
 * | `code-border`             | рамка кода                             | `--line-soft`      | `--od-cloud-8`     |
 * | `radius`                  | скругления                             | `--r-xs`           | `--r-xs`           |
 * | `tone-neutral-background` | подложка Обёртки «Важно» ³             | `--bg-3`           | `--od-cloud-11`    |
 * | `tone-neutral-border`     | полоса Обёртки «Важно» ³               | `--fg-3`           | `--od-cloud-4`     |
 * | `tone-accent-background`  | подложка Обёртки «Заметка»             | `--accent-soft`    | `--accent-soft`    |
 * | `tone-accent-border`      | полоса Обёртки «Заметка»               | `--accent-strong`  | `--accent` ¹       |
 * | `tone-success-background` | подложка Обёртки «Совет»               | `--success-soft`   | `--od-green-2-a12` |
 * | `tone-success-border`     | полоса Обёртки «Совет»                 | `--success-strong` | `--od-green-1`     |
 * | `tone-warning-background` | подложка Обёртки «Внимание»            | `--warning-soft`   | `--od-amber-2-a14` |
 * | `tone-warning-border`     | полоса Обёртки «Внимание»              | `--warning-strong` | `--od-amber-1`     |
 * | `tone-danger-background`  | подложка Обёртки «Осторожно»           | `--danger-soft`    | `--od-red-3-a12`   |
 * | `tone-danger-border`      | полоса Обёртки «Осторожно»             | `--danger-strong`  | `--od-red-1`       |
 * | `tone-link`               | ссылка в Обёртке с тоном ⁴             | `--fg-0`           | `--od-cloud-1`     |
 * | `tone-secondary`          | цитата и шапка кода в Обёртке с тоном ⁴ | `--fg-0`          | `--od-cloud-2`     |
 * | `tone-muted`              | подпись, пункт, серый текст в тоне ⁴   | `--fg-0`           | `--od-cloud-3`     |
 * | `tone-muted-foreground`   | подсказки в Обёртке с тоном ⁴          | `--fg-0`           | `--od-cloud-3`     |
 *
 * Модуль серверно-безопасен: строки классов, без React и без движка.
 */
export const EDITOR_TOKENS_CLASS =
  "[--rte-background:var(--bg-2)] [--rte-foreground:var(--fg-0)] " +
  "[--rte-secondary:var(--fg-1)] [--rte-muted:var(--fg-2)] [--rte-muted-foreground:var(--fg-3)] " +
  "[--rte-primary:var(--accent)] [--rte-ring:var(--accent-strong)] [--rte-link:var(--accent-strong)] " +
  "[--rte-text-accent:var(--accent-strong)] [--rte-text-success:var(--success-strong)] " +
  "[--rte-text-warning:var(--warning-strong)] [--rte-text-danger:var(--danger-strong)] " +
  "[--rte-text-lime:var(--draft-strong)] [--rte-text-muted:var(--fg-2)] [--rte-selection:var(--selection)] [--rte-selection-marker:color-mix(in_srgb,var(--accent)_38%,transparent)] " +
  "[--rte-control-hover:var(--bg-2)] [--rte-quote:var(--line)] [--rte-hr:var(--line)] " +
  "[--rte-code-background:var(--bg-3)] [--rte-code-border:var(--line-soft)] " +
  "[--rte-radius:var(--r-xs)] " +
  "[--rte-tone-neutral-background:var(--bg-3)] [--rte-tone-neutral-border:var(--fg-3)] " +
  "[--rte-tone-accent-background:var(--accent-soft)] [--rte-tone-accent-border:var(--accent-strong)] " +
  "[--rte-tone-success-background:var(--success-soft)] [--rte-tone-success-border:var(--success-strong)] " +
  "[--rte-tone-warning-background:var(--warning-soft)] [--rte-tone-warning-border:var(--warning-strong)] " +
  "[--rte-tone-danger-background:var(--danger-soft)] [--rte-tone-danger-border:var(--danger-strong)] " +
  "[--rte-tone-link:var(--fg-0)] [--rte-tone-secondary:var(--fg-0)] " +
  "[--rte-tone-muted:var(--fg-0)] [--rte-tone-muted-foreground:var(--fg-0)]";

/**
 * Те же роли для листа `surface="paper"`: значения СВЕТЛОЙ темы в
 * любой теме приложения.
 *
 * ПОЧЕМУ ПРИМИТИВЫ, А НЕ ВЛОЖЕННЫЙ `data-theme="light"`. Семантические токены
 * кита (`--fg-0`, `--bg-2`, `--accent-strong`) объявлены только на
 * `:root[data-theme]` и на вложенную тему не отзываются; мост `@theme`
 * (`text-fg-0` → `--color-fg-0`) подставляет значение корня. Менять это —
 * решение уровня кита (ADR-0003, ADR-0020), а не Редактора. Поэтому лист
 * назначает ролям `--rte-*` те же примитивы `--od-*`, что светлая тема
 * назначает своим токенам: примитивы объявлены на `:root` без темы и видны
 * везде. Совпадение со светлой темой сторожит `tests/rich-text-paper.test.tsx`
 * — разбором `styles.css`, а не копией значений.
 *
 * Вложенный `data-theme="light"` на листе всё равно стоит — для того, что
 * объявлено на `[data-theme]` любого элемента: маркеры (`--marker-*`) и тема
 * подсветки (`--rte-hl-*`, `--rte-code-block-*`, `styles.css`).
 *
 * ¹ АКЦЕНТ — ЗАЛИВКА ТЕМЫ ПРИЛОЖЕНИЯ, А НЕ СВЕТЛАЯ `accent-strong`. Светлый
 * `accent-strong` у бренда и у фиолетового акцента объявлен только парным
 * блоком `:root[data-theme="light"][data-…]` и в тёмном приложении не
 * существует ни в одной переменной. `--accent` же рассчитан под белый текст
 * поверх (4.5:1 с `--text-on-accent`, гейт контраста) — значит, и как текст на
 * белом листе держит 4.5:1, у любого бренда и акцента. В светлом приложении
 * лист берёт ровно светлый `accent-strong` — вариантом по корню.
 *
 * `primary` и подложка тона «Заметка» не меняются: полупрозрачная `accent-soft`
 * ложится и на белый лист, а заливка флажка — тот же `--accent`. Выделение —
 * `--selection-light`: `--selection` тёмного приложения — светлая
 * ступень акцента под тёмную подложку, и на белом листе она почти не видна;
 * светлый вариант объявлен при любой теме ровно для листа.
 * Полоса «Заметки» — как текст акцентом: `--accent`, в светлом приложении —
 * светлый `accent-strong`.
 *
 * ² ВЫДЕЛЕНИЕ НА МАРКЕРЕ. Обычное выделение полупрозрачно и рассчитано на фон
 * документа; поверх яркого маркера (`#ffea80`) прежнее `accent-soft` (14–16 %
 * альфы) пропадало, и казалось, что помеченный текст не выделен. Маркер один во всех темах, поэтому
 * и роль одна: `--accent` на 38 % — жёлтый под ним уходит в заметный
 * серо-зелёный, а тёмный текст маркера остаётся читаемым. Акцент, а не
 * фиксированный синий: выделение следует бренду, как и везде.
 *
 * ³ ТОН ОБЁРТКИ — статусные токены кита: мягкая ступень тона —
 * подложка, сильная — полоса слева, как `soft` у `Alert`. Нейтральный тон
 * отступает от `TONE_TOKENS.neutral` в обоих местах. Подложка — `bg-3`
 * (ступень выбранного нейтрального), а не `bg-2`: на `bg-2` стоит само поле
 * Редактора, и Обёртка «Важно» в нём была бы без подложки. Не `bg-4`: `bg-3` —
 * подложка приложения, под которую откалиброваны ВСЕ текстовые токены, и
 * ссылка, цитата, подпись и цвет текста внутри «Важно» держат 4.5:1, а на
 * `bg-4` приглушённый текст падает до 3.7. Цена — в светлой теме подложка
 * почти белая на белой панели, тон там держит полоса. Полоса — `fg-3`, а не
 * `line`: полоса тона несёт смысл и держит 3:1 (WCAG 1.4.11), а `line` —
 * декоративная черта (так же рамка признака состояния, `STATE_BORDER`).
 * Контраст — `npm run contrast`, пары тонов.
 *
 * ⁴ ВТОРИЧНЫЙ ТЕКСТ НА ПОДЛОЖКЕ ТОНА. Ступени `fg-1`–`fg-3` и `accent-strong`
 * откалиброваны под 4.5:1 на подложках приложения, а не на цветных подложках
 * тонов: на них цитата падала до 4.23, ссылка — до 3.97, подпись и серый текст
 * — до 3.59, подсказка — до 3.61. Поэтому в Обёртке с тоном `prose.ts` подменяет
 * роли `link`, `secondary`, `muted`, `text-muted` и `muted-foreground` этими. В
 * теме приложения 4.5:1 на всех пяти подложках держит только `fg-0` — промежуточной
 * ступени нет (`fg-1` даёт 4.23 на «Заметке» и 4.27 на «Внимании»), поэтому
 * внутри тона весь вторичный текст — основной; иерархию держат форма (полоса
 * цитаты, зачёркивание, кегль подписи), а ссылку — подчёркивание. На листе
 * `cloud-2` и `cloud-3` проходят и на подложках тона — цитата и подпись остаются
 * своей ступенью, поднимаются только ссылка (акцент давал 3.68) и подсказка
 * (`cloud-4` давал 4.25).
 */
export const EDITOR_PAPER_TOKENS_CLASS =
  "[--rte-background:var(--od-cloud-12)] [--rte-foreground:var(--od-cloud-1)] " +
  "[--rte-secondary:var(--od-cloud-2)] [--rte-muted:var(--od-cloud-3)] " +
  "[--rte-muted-foreground:var(--od-cloud-4)] " +
  "[--rte-primary:var(--accent)] [--rte-ring:var(--accent)] [--rte-link:var(--accent)] " +
  "[--rte-text-accent:var(--accent)] [--rte-text-success:var(--od-green-1)] " +
  "[--rte-text-warning:var(--od-amber-1)] [--rte-text-danger:var(--od-red-1)] " +
  "[--rte-text-lime:var(--od-lime-1)] [--rte-text-muted:var(--od-cloud-3)] [--rte-selection:var(--selection-light)] [--rte-selection-marker:color-mix(in_srgb,var(--accent)_38%,transparent)] " +
  "[--rte-control-hover:var(--od-cloud-9)] [--rte-quote:var(--od-cloud-6)] [--rte-hr:var(--od-cloud-6)] " +
  "[--rte-code-background:var(--od-cloud-11)] [--rte-code-border:var(--od-cloud-8)] " +
  "[--rte-radius:var(--r-xs)] " +
  "[--rte-tone-neutral-background:var(--od-cloud-11)] [--rte-tone-neutral-border:var(--od-cloud-4)] " +
  "[--rte-tone-accent-background:var(--accent-soft)] [--rte-tone-accent-border:var(--accent)] " +
  "[--rte-tone-success-background:var(--od-green-2-a12)] [--rte-tone-success-border:var(--od-green-1)] " +
  "[--rte-tone-warning-background:var(--od-amber-2-a14)] [--rte-tone-warning-border:var(--od-amber-1)] " +
  "[--rte-tone-danger-background:var(--od-red-3-a12)] [--rte-tone-danger-border:var(--od-red-1)] " +
  "[--rte-tone-link:var(--od-cloud-1)] [--rte-tone-secondary:var(--od-cloud-2)] " +
  "[--rte-tone-muted:var(--od-cloud-3)] [--rte-tone-muted-foreground:var(--od-cloud-3)] " +
  "[:root[data-theme=light]_&]:[--rte-ring:var(--accent-strong)] " +
  "[:root[data-theme=light]_&]:[--rte-link:var(--accent-strong)] " +
  "[:root[data-theme=light]_&]:[--rte-text-accent:var(--accent-strong)] " +
  "[:root[data-theme=light]_&]:[--rte-tone-accent-border:var(--accent-strong)]";
