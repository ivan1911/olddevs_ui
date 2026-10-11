/**
 * Движок Редактора: пакеты, которые ставит только тот, кто импортирует
 * `@olddevs/ui/editor` (ADR-0050).
 *
 * ПОЧЕМУ СПИСОК ЗДЕСЬ, А НЕ В `peerDependenciesMeta`. До OLDSUI-195 движок был
 * опциональными peer-зависимостями. Но реестр GitLab отдаёт из `package.json`
 * только поля своего белого списка, `peerDependenciesMeta` в него не входит
 * (`PACKAGE_JSON_ALLOWED_FIELDS` в `generate_metadata_service.rb`), и npm
 * ставил все 21 пакет каждому потребителю, Редактор он импортирует или нет
 * (OLDSUI-195). Поэтому в манифесте пакета движка нет вовсе: версии держит
 * `devDependencies` (кит сам на них собирается и тестируется), а команду
 * установки — страница Редактора.
 *
 * Список читают замер размера (движок для него внешний, как peer) и тесты:
 * каждый пакет есть в `devDependencies`, ни одного нет в `peerDependencies` и
 * `dependencies`, команда на странице Редактора называет ровно их, а
 * `src/editor` не импортирует ничего сверх них и обязательных peer.
 */
export const EDITOR_ENGINE = [
  "@tiptap/core",
  "@tiptap/extension-blockquote",
  "@tiptap/extension-code-block-lowlight",
  "@tiptap/extension-highlight",
  "@tiptap/extension-horizontal-rule",
  "@tiptap/extension-link",
  "@tiptap/extension-list",
  "@tiptap/extension-subscript",
  "@tiptap/extension-superscript",
  "@tiptap/extension-table",
  "@tiptap/extension-text-align",
  "@tiptap/extension-text-style",
  "@tiptap/extensions",
  "@tiptap/markdown",
  "@tiptap/pm",
  "@tiptap/react",
  "@tiptap/starter-kit",
  "@tiptap/suggestion",
  "highlight.js",
  "lowlight",
  "marked",
];
