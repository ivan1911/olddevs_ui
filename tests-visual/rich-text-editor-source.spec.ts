import { expect, test } from "@playwright/test";

/**
 * HTML-режим Редактора в браузере (OLDSUI-76): то, чего jsdom не умеет, —
 * раскладка. Высота поля при входе не ниже Документа, дальше поле растёт по
 * содержимому без своего скролла; фокус на входе — в поле, на выходе — в
 * Документ. Вид режима в трёх темах и на листе снимает `stories.spec.ts`
 * (истории `SourceMode` и `SourceModePaper`).
 */

const STORY = (id: string) =>
  `/iframe.html?id=inputs-richtexteditor--${id}&globals=theme:dark;accent:blue`;

test("the HTML field is at least as tall as the document, grows with its text and hands the focus back", async ({
  page,
}) => {
  await page.goto(STORY("playground"));
  const document_ = page.getByRole("textbox", { name: "Document" });
  await expect(document_).toBeVisible();
  const documentHeight = (await document_.boundingBox())!.height;

  await page.getByRole("button", { name: "HTML", exact: true }).click();

  const field = page.getByRole("textbox", { name: "HTML source" });
  await expect(field).toBeFocused();
  await expect(document_).toBeHidden();
  expect(await field.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBe(0);
  const before = (await field.boundingBox())!.height;
  expect(before).toBeGreaterThanOrEqual(documentHeight - 1);
  // Своего скролла нет: всё содержимое видно.
  expect(await field.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(
    1
  );

  await field.evaluate((node: HTMLTextAreaElement) =>
    node.setSelectionRange(node.value.length, node.value.length)
  );
  for (let line = 0; line < 20; line++) await page.keyboard.type(`\n<p>Line ${line}</p>`);

  const after = (await field.boundingBox())!.height;
  expect(after).toBeGreaterThan(before);
  expect(await field.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(
    1
  );

  await page.getByRole("button", { name: "HTML", exact: true }).click();

  await expect(field).toBeHidden();
  await expect(document_).toBeFocused();
  await expect(document_).toContainText("Line 19");
});
