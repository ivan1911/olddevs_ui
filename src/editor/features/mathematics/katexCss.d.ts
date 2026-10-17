/**
 * KaTeX styles are imported for their side effect (`katexEngine.ts`). The `katex` package
 * has no types for `.css`, and the kit builds with plain `tsc` without `vite/client`, so in
 * strict mode the import would fail with TS2882. An empty declaration is enough: the import
 * yields no value. It is not needed in `dist`, and no types leak out.
 */
declare module "katex/dist/katex.min.css";
