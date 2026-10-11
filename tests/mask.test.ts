import { describe, expect, test } from "vitest";
import {
  caretAfter,
  formatMask,
  maskCapacity,
  maskRemainder,
  rawLengthBefore,
  unmask,
  unmaskOverflow,
} from "../src/lib/mask.js";

const PHONE = "+7 (999) 999-99-99";

describe("formatMask", () => {
  test("literals are inserted on their own", () => {
    expect(formatMask("9161234567", PHONE)).toBe("+7 (916) 123-45-67");
  });

  test("the mask tail is not shown ahead of time", () => {
    // Иначе пустое поле показывало бы «+7 (» до первого символа, а поле с
    // одной цифрой — хвост из скобок и дефисов.
    expect(formatMask("", PHONE)).toBe("");
    expect(formatMask("9", PHONE)).toBe("+7 (9");
  });

  test("extra characters are dropped", () => {
    expect(formatMask("91612345678888", PHONE)).toBe("+7 (916) 123-45-67");
  });

  test("letters and any-character are their own tokens", () => {
    expect(formatMask("AB12", "aa-**")).toBe("AB-12");
  });
});

describe("unmask", () => {
  test("a digit literal does not leak into the value", () => {
    // В маске `+7 (999)` литерал `7` — тоже цифра, и наивный фильтр «оставим
    // цифры» утащил бы его в значение.
    expect(unmask("+7 (916) 123-45-67", PHONE)).toBe("9161234567");
  });

  test("a paste with foreign separators is laid out", () => {
    expect(unmask("+7 916 123 45 67", PHONE)).toBe("9161234567");
  });

  test("unfinished input is parsed partially", () => {
    expect(unmask("+7 (916", PHONE)).toBe("916");
  });

  test("an erased literal does not eat a value character", () => {
    // Пользователь стёр `)` — цифры остаются на месте.
    expect(unmask("+7 (916", PHONE)).toBe("916");
    expect(unmask("+7 (916)", PHONE)).toBe("916");
  });
});

describe("caret", () => {
  test("counts value characters left of the position", () => {
    expect(rawLengthBefore(PHONE, 0)).toBe(0);
    expect(rawLengthBefore(PHONE, 5)).toBe(1);
    expect(rawLengthBefore(PHONE, 7)).toBe(3);
  });

  test("lands after literals, not before them", () => {
    // Иначе после третьей цифры каретка вставала перед `)`, и следующая цифра
    // уезжала за скобку.
    expect(caretAfter(PHONE, 3)).toBe(9);
    expect(caretAfter(PHONE, 0)).toBe(0);
    expect(caretAfter(PHONE, 10)).toBe(PHONE.length);
  });
});

test("mask capacity is counted by tokens", () => {
  expect(maskCapacity(PHONE)).toBe(10);
  expect(maskCapacity("99.99.9999")).toBe(8);
});

describe("maskRemainder", () => {
  test("an empty value yields a skeleton together with the literals", () => {
    // Литералы — половина подсказки: `+7 (` говорит о формате больше, чем
    // ряд подчёркиваний той же длины.
    expect(maskRemainder("", PHONE)).toBe("+7 (___) ___-__-__");
  });

  test("the remainder is eaten left to right", () => {
    expect(maskRemainder("9", PHONE)).toBe("__) ___-__-__");
    expect(maskRemainder("916", PHONE)).toBe(") ___-__-__");
    expect(maskRemainder("916123", PHONE)).toBe("-__-__");
  });

  test("a filled mask yields an empty tail", () => {
    expect(maskRemainder("9161234567", PHONE)).toBe("");
    // Переполнение — тоже пустой: лишнее `formatMask` отбрасывает.
    expect(maskRemainder("91612345678888", PHONE)).toBe("");
  });

  test("the placeholder is a parameter", () => {
    expect(maskRemainder("", "99.99", "·")).toBe("··.··");
  });

  test("the lengths add up for any value", () => {
    // Свойство, на котором стоит показ: набранное и остаток лежат друг за
    // другом и вместе занимают ровно ширину маски.
    for (const mask of [PHONE, "99.99.9999", "aa-**", "9"]) {
      for (const raw of ["", "9", "91", "916123", "9161234567", "91612345678888"]) {
        expect(formatMask(raw, mask).length + maskRemainder(raw, mask).length).toBe(mask.length);
      }
    }
  });
});

/**
 * Переполнение при вставке.
 *
 * `unmask` идёт по маске и молча останавливается на её конце — лишние подходящие
 * символы отбрасывались без следа. На самом частом входе, какой бывает у
 * телефонного поля, это давало не обрезанный, а ЧУЖОЙ номер: `89161234567` —
 * самая распространённая форма российского номера в буфере обмена — под маской
 * `+7 (999) 999-99-99` превращался в `+7 (891) 612-34-56`.
 *
 * Правдоподобный результат хуже пустого: ошибку не видно ни компоненту, ни
 * глазу. Отказ по несовпавшему токену модуль объявлять умел (`maskTokenAt` —
 * «сказать пользователю, ЧЕГО тут ждали»), а переполнение — нет.
 */
describe("overflow when pasting", () => {
  test("the most common Russian phone form does not become a different number", () => {
    // Ведущая «8» — не часть номера, но и молча съесть её с хвостом нельзя.
    expect(unmaskOverflow("89161234567", PHONE)).toBe(1);
  });

  test("a value that fits reports no overflow", () => {
    expect(unmaskOverflow("79161234567", PHONE)).toBe(0);
    expect(unmaskOverflow("+7 916 123-45-67", PHONE)).toBe(0);
    expect(unmaskOverflow("", PHONE)).toBe(0);
  });

  test("overflow counts every character that did not fit", () => {
    expect(unmaskOverflow("7916123456789", PHONE)).toBe(2);
  });

  test("characters that no token accepts are not overflow", () => {
    // Хвост из литералов и пробелов — не потерянное значение.
    expect(unmaskOverflow("79161234567   ", PHONE)).toBe(0);
  });

  test("unmask itself keeps returning what fits", () => {
    // Признак переполнения — отдельная функция, а не смена контракта `unmask`:
    // он публичный и возвращает строку.
    expect(unmask("89161234567", PHONE)).toBe("8916123456");
  });
});

/**
 * Потеря значения В СЕРЕДИНЕ прохода, а не только в хвосте.
 *
 * `walkMask` пропускает символы, не подошедшие текущему токену, — так вставка
 * «+7 916 123» раскладывается по цифровой маске. На однородной маске
 * пропускается только оформление, но на смешанной пропускается ЗНАЧЕНИЕ:
 * `123-456` под `999-aaa` отдаёт `123` и теряет вторую половину. Значение при
 * этом изменилось, поэтому отказ по токену эту потерю не видит.
 */
describe("value lost inside the walk", () => {
  test("digits falling where the mask wants letters count as overflow", () => {
    expect(unmask("123-456", "999-aaa")).toBe("123");
    expect(unmaskOverflow("123-456", "999-aaa")).toBe(3);
  });

  test("a well-formed value on a mixed mask reports nothing", () => {
    expect(unmask("123-abc", "999-aaa")).toBe("123abc");
    expect(unmaskOverflow("123-abc", "999-aaa")).toBe(0);
  });

  test("separators are not value and are not counted", () => {
    expect(unmaskOverflow("+7 916 123-45-67", PHONE)).toBe(0);
  });
});
