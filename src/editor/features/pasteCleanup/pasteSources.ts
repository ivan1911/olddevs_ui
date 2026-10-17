"use client";

/**
 * Which office application put the HTML on the clipboard. Each cleanup step runs only for its own
 * source: HTML from a web page or a code editor must reach the Schema untouched, otherwise a
 * code-highlighting background from a docs site would turn into a marker.
 *
 * The signs are the ones each application writes on every copy, checked on real captures in all
 * three browsers (`fixtures/paste/`). Safari shortens Word's `<style>` block, but keeps the Office
 * namespaces and the `Mso` classes, so the signs below survive it.
 */
export interface PasteSources {
  /** Word, desktop: the Office Word namespace, the `Word.Document` ProgId or the `Mso*` classes. */
  word: boolean;
  /** Excel, desktop: the Office Excel namespace or the `Excel.Sheet` ProgId. */
  excel: boolean;
  /** Google Docs: the `docs-internal-guid-…` wrapper of every copy. */
  googleDocs: boolean;
  /** Google Sheets: the `<google-sheets-html-origin>` marker and the `data-sheets-*` attributes. */
  googleSheets: boolean;
}

const WORD =
  /urn:schemas-microsoft-com:office:word|\bcontent=["']?Word\.Document|\bclass=["']?Mso[A-Z]/i;
const EXCEL = /urn:schemas-microsoft-com:office:excel|\bcontent=["']?Excel\.Sheet/i;
const GOOGLE_DOCS = /\bid=["']?docs-internal-guid-/;
const GOOGLE_SHEETS = /<google-sheets-html-origin|\bdata-sheets-/;

/** The sources of a clipboard's HTML, read from the string: no parse is needed to tell them apart. */
export function detectPasteSources(html: string): PasteSources {
  return {
    word: WORD.test(html),
    excel: EXCEL.test(html),
    googleDocs: GOOGLE_DOCS.test(html),
    googleSheets: GOOGLE_SHEETS.test(html),
  };
}
