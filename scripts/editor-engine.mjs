/**
 * The Editor engine: the packages that only a consumer who imports
 * `@olddevs/ui/editor` installs (ADR-0050).
 *
 * WHY THE LIST LIVES HERE AND NOT IN `peerDependenciesMeta`. Before OLDSUI-195 the engine
 * was a set of optional peer dependencies. But the GitLab registry returns only the fields
 * of its allowlist from `package.json`, and `peerDependenciesMeta` is not on it
 * (`PACKAGE_JSON_ALLOWED_FIELDS` in `generate_metadata_service.rb`). npm then installed all
 * 21 packages for every consumer, whether or not they import the Editor (OLDSUI-195).
 * So the package manifest has no engine entry at all: `devDependencies` pins the versions
 * (the kit builds and tests against them), and the Editor's page gives the install command.
 *
 * The size measurement reads this list (the engine is external to it, like a peer), and so
 * do the tests: every package is in `devDependencies`, none is in `peerDependencies` or
 * `dependencies`, the command on the Editor's page names exactly these packages, and
 * `src/editor` imports nothing beyond them and the kit's declared packages.
 */
export const EDITOR_ENGINE = [
  "@tiptap/core",
  "@tiptap/extension-blockquote",
  "@tiptap/extension-code-block-lowlight",
  "@tiptap/extension-details",
  "@tiptap/extension-highlight",
  "@tiptap/extension-horizontal-rule",
  "@tiptap/extension-invisible-characters",
  "@tiptap/extension-link",
  "@tiptap/extension-list",
  "@tiptap/extension-mathematics",
  "@tiptap/extension-subscript",
  "@tiptap/extension-superscript",
  "@tiptap/extension-table",
  "@tiptap/extension-text-align",
  "@tiptap/extension-text-style",
  "@tiptap/extension-typography",
  "@tiptap/extensions",
  "@tiptap/markdown",
  "@tiptap/pm",
  "@tiptap/react",
  "@tiptap/starter-kit",
  "@tiptap/suggestion",
  "highlight.js",
  "katex",
  "lowlight",
  "marked",
];
