// Declaration for side-effect CSS imports: `import "./preview.css"` in `preview.tsx`.
//
// Without it, the editor reports `TS2882` ("Cannot find module or type declarations
// for side-effect import"). The cause is not the import itself: CSS has no types and
// cannot have them, so TypeScript has to learn about such a module from a declaration.
//
// Why `npm run typecheck` stayed silent is a separate and more unpleasant story:
// `tsconfig.json` had `include: [".storybook"]`, and TypeScript skips directories whose
// names start with a dot in include patterns. So ZERO files from `.storybook` ended up
// in the program: `preview.tsx` and `main.ts` were not checked at all, and the error had
// nowhere to surface. The editor, however, takes the file outside any program, applies
// its own defaults, and finds it. Fixed in `tsconfig.json`: `include` now lists the
// directory with an explicit glob.
//
// This comment is line-by-line on purpose: a block comment would have to mention that
// same glob, and it contains a sequence that closes a block comment early. The first
// version of the file broke on exactly that.
//
// It sits next to the only place where CSS is imported (there are no such imports in
// `src/`) and outside `tsconfig.build.json`, which compiles only `src`, so the file does
// not end up in `dist` or in the published package.
//
// The body is intentionally empty (a shorthand ambient module): the module gets type
// `any`, and that is correct, since the import is for its side effect and nothing is read
// from it. Declaring `export default string` would invite `import styles from "./x.css"`,
// which the project does not use.
declare module "*.css";
