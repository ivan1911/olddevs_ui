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
  /**
   * Excel, desktop: the Office Excel namespace or the `Excel.Sheet` ProgId. Safari drops both (and the
   * `<style>` block), but keeps Excel's `xl65`-style class on each cell, with the values inlined.
   */
  excel: boolean;
  /** Google Docs: the `docs-internal-guid-…` wrapper of every copy. */
  googleDocs: boolean;
  /** Google Sheets: the `<google-sheets-html-origin>` marker and the `data-sheets-*` attributes. */
  googleSheets: boolean;
  /**
   * SharePoint and Word Online (Word in the browser): their own markup, with the `data-ccp-props`
   * attribute and the `OutlineElement`, `ListContainerWrapper` and `NormalTextRun` classes (as class
   * tokens, anywhere in the class list). No real capture yet: the step is checked on synthetic HTML
   * shaped after what public editors quote from real copies.
   */
  sharePoint: boolean;
}

/*
  Every sign is anchored to a tag: `<` followed by the tag's own attributes, with no `<` or `>` in
  between. Text cannot hold a literal `<`, so a blog post that quotes `class="MsoNormal"` as escaped
  text is not taken for Word, and its backgrounds are not turned into markers. `[^<>]*` also keeps
  each attempt inside one tag, so the scan stays linear on any input.
*/
const TAG = String.raw`<[a-z][\w:-]*\b[^<>]*`;
const WORD = new RegExp(
  `${TAG}(?:urn:schemas-microsoft-com:office:word|\\bcontent=["']?Word\\.Document|\\bclass=["']?Mso[A-Z])`,
  "i"
);
const EXCEL = new RegExp(
  `${TAG}(?:urn:schemas-microsoft-com:office:excel|\\bcontent=["']?Excel\\.Sheet)|<td\\b[^<>]*\\bclass=["']?xl\\d+\\b`,
  "i"
);
const GOOGLE_DOCS = new RegExp(`${TAG}\\bid=["']?docs-internal-guid-`);
const GOOGLE_SHEETS = new RegExp(`<google-sheets-html-origin|${TAG}\\bdata-sheets-`);
const SHARE_POINT = new RegExp(
  `${TAG}(?:\\bdata-ccp-props=|\\bclass=["']?(?:[^"'<>]*\\s)?(?:OutlineElement|ListContainerWrapper|NormalTextRun)(?=[\\s"'>]))`
);

/** The sources of a clipboard's HTML, read from the string: no parse is needed to tell them apart. */
export function detectPasteSources(html: string): PasteSources {
  return {
    word: WORD.test(html),
    excel: EXCEL.test(html),
    googleDocs: GOOGLE_DOCS.test(html),
    googleSheets: GOOGLE_SHEETS.test(html),
    sharePoint: SHARE_POINT.test(html),
  };
}
