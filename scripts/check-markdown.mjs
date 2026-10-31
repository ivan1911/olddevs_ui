/** Consumer import isolation for the optional Markdown entry (ADR-0085). Build first. */
import { Buffer } from "node:buffer";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const ROOT = resolve(import.meta.dirname, "..");
if (!existsSync(join(ROOT, "dist/markdown.js"))) throw new Error("Run npm run build first.");
const temporary = mkdtempSync(join(tmpdir(), "olddevs-markdown-"));
const forbidden =
  /node_modules\/(?:react-markdown|remark[^/]*|micromark[^/]*|mdast[^/]*|unified|rehype[^/]*|marked|streamdown|remend|lowlight|highlight\.js|shiki|katex|mermaid|livekit[^/]*|@livekit\/[^/]*|speechkit)\//;
const heavy =
  /node_modules\/(?:lowlight|highlight\.js|shiki|katex|mermaid|livekit[^/]*|@livekit\/[^/]*|speechkit)\//;
try {
  for (const [name, file, exported] of [
    ["Button", "index.js", "Button"],
    ["MarkdownView", "markdown.js", "MarkdownView"],
  ]) {
    const entry = join(temporary, `${name}.js`);
    writeFileSync(
      entry,
      `export {${exported}} from ${JSON.stringify(join(ROOT, "dist", file))};\n`
    );
    const visited = new Set();
    const result = await build({
      plugins: [
        {
          name: "count-consumer-modules",
          moduleParsed(info) {
            visited.add(info.id);
          },
        },
      ],
      configFile: false,
      root: ROOT,
      logLevel: "error",
      define: { "process.env.NODE_ENV": '"production"' },
      build: {
        write: false,
        minify: "esbuild",
        target: "es2022",
        lib: { entry, formats: ["es"] },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
    const chunks = outputs.filter((item) => item.type === "chunk");
    const modules = chunks.flatMap((chunk) => Object.entries(chunk.modules));
    const retained = modules.filter(([, module]) => module.renderedLength > 0).map(([id]) => id);
    const disallowed = retained.filter((id) => (name === "Button" ? forbidden : heavy).test(id));
    if (disallowed.length)
      throw new Error(`${name} retained forbidden modules: ${disallowed.join(", ")}`);
    if (
      name === "MarkdownView" &&
      !retained.some((id) => /node_modules\/react-markdown\//.test(id))
    ) {
      throw new Error(
        "The Markdown consumer did not retain its renderer: the probe is ineffective."
      );
    }
    const code = chunks.map((chunk) => chunk.code).join("\n");
    console.log(
      JSON.stringify({
        consumer: name,
        bytes: Buffer.byteLength(code),
        gzip: gzipSync(code).length,
        visitedModules: visited.size,
        retainedModules: retained.length,
        forbiddenRetained: disallowed,
        note: "Visited modules include zero-byte modules; only retained modules contribute output. React bundled; no CSS. No production budget asserted.",
      })
    );
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
