import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, test } from "vitest";

/**
 * Ворота байтов: в исходниках нет управляющих символов, кроме перевода строки и
 * табуляции.
 *
 * Зачем отдельная проверка на то, что выглядит невозможным. Один такой символ в
 * репозитории уже жил: `FilterBarAdd.tsx` содержал три сырых нулевых байта —
 * разделитель составного ключа был записан самим символом, а не escape-
 * последовательностью. Компилятор, линтер и тесты этого не замечают вовсе:
 * значение строки правильное, поведение правильное.
 *
 * Замечают инструменты, работающие с файлом как с текстом. `file` называет такой
 * файл `data`, а `grep` считает бинарным и **молча пропускает** — выходит с
 * кодом 1, не напечатав ни строки. То есть любая проверка, построенная на
 * текстовом поиске, обходит файл стороной и сообщает об успехе. Волна 21
 * построила на текстовом сканировании ворота директив `"use client"`, и
 * пропущенный файл означал бы дыру ровно в них.
 *
 * Отсюда порядок: файлы читаются как БАЙТЫ и разбираются явно, без `grep` и без
 * предположения, что содержимое — текст.
 */

const SRC = resolve(import.meta.dirname, "..", "src");

/** Перевод строки, возврат каретки и табуляция — единственные разрешённые. */
const ALLOWED_CONTROL_BYTES = new Set([0x09, 0x0a, 0x0d]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [full] : [];
  });
}

test("sources carry no control bytes except newline and tab", () => {
  const offenders: string[] = [];

  for (const file of sourceFiles(SRC)) {
    const bytes = readFileSync(file);
    for (let i = 0; i < bytes.length; i += 1) {
      const byte = bytes[i]!;
      if (byte < 0x20 && !ALLOWED_CONTROL_BYTES.has(byte)) {
        const hex = `0x${byte.toString(16).padStart(2, "0")}`;
        // Смещение, а не строка: строк у такого файла может не быть вовсе.
        offenders.push(`${relative(SRC, file)}: byte ${hex} at offset ${i}`);
        break;
      }
    }
  }

  expect(
    offenders,
    `A control byte in a source file. Write the character as an escape sequence ` +
      `(for example "\\u0000"): a raw one makes the file binary for grep, and text-based ` +
      `checks silently skip it.\n${offenders.join("\n")}`
  ).toEqual([]);
});
