import { describe, expect, test } from "vitest";
import {
  formatTime12,
  maskTime,
  maskTime12,
  normalizeTime,
  normalizeTime12,
} from "../src/lib/time.js";

describe("maskTime — inserts the colon as you type", () => {
  test.each([
    ["", ""],
    ["2", "2"],
    ["21", "21"],
    ["213", "21:3"],
    ["2130", "21:30"],
    // Лишние цифры отбрасываются: в сутках нет пятого разряда.
    ["213045", "21:30"],
    // Нецифры выкидываются, а не ломают маску — сюда попадает и вставка из буфера.
    ["21:30", "21:30"],
    ["ab21cd30", "21:30"],
  ])("%s → %s", (input, expected) => {
    expect(maskTime(input)).toBe(expected);
  });
});

describe("normalizeTime — completes partial input to HH:MM", () => {
  test.each([
    ["21", "21:00"],
    ["2", "02:00"],
    ["2130", "21:30"],
    ["213", "21:03"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTime(input)).toBe(expected);
  });

  test("it clamps to the day bounds instead of rejecting the input", () => {
    // Пользователь, набравший «99:99», ошибся в значении, а не в намерении:
    // показать ему пустое поле хуже, чем показать ближайшее возможное время.
    expect(normalizeTime("9999")).toBe("23:59");
    expect(normalizeTime("2599")).toBe("23:59");
  });

  test("empty input returns the fallback value instead of silently returning midnight", () => {
    expect(normalizeTime("", "16:00")).toBe("16:00");
    // Умолчание запасного — полночь, и это осознанно: время публикации
    // без указания часа — это начало суток.
    expect(normalizeTime("")).toBe("00:00");
  });
});

describe("formatTime12 — HH:MM to the 12-hour clock", () => {
  test.each([
    // Полночь и полдень — 12, а не 0: так их читает 12-часовые часы.
    ["00:00", "12:00 AM"],
    ["00:30", "12:30 AM"],
    ["09:05", "9:05 AM"],
    ["12:00", "12:00 PM"],
    ["14:30", "2:30 PM"],
    ["23:59", "11:59 PM"],
  ])("%s → %s", (input, expected) => {
    expect(formatTime12(input)).toBe(expected);
  });

  test("the period labels come from the caller (the message catalog)", () => {
    expect(formatTime12("14:30", { am: "a.m.", pm: "p.m." })).toBe("2:30 p.m.");
  });
});

describe("maskTime12 — colon and period as you type", () => {
  test.each([
    ["", ""],
    ["2", "2"],
    ["12", "12"],
    // Три цифры — `ч:мм`, четыре — `чч:мм`: разряд часов определяется с конца.
    ["230", "2:30"],
    ["1230", "12:30"],
    ["123045", "12:30"],
    ["2:30", "2:30"],
    // Буква периода достраивается до AM/PM; регистр и «m» не важны.
    ["2:30p", "2:30 PM"],
    ["230pm", "2:30 PM"],
    ["2:30 a", "2:30 AM"],
    // Период без цифр не ставится.
    ["p", ""],
  ])("%s → %s", (input, expected) => {
    expect(maskTime12(input)).toBe(expected);
  });
});

describe("normalizeTime12 — completes partial input to HH:MM", () => {
  test.each([
    ["2:30 PM", "00:00", "14:30"],
    ["2:30 AM", "00:00", "02:30"],
    ["12:00 AM", "10:00", "00:00"],
    ["12:15 PM", "10:00", "12:15"],
    ["230p", "10:00", "14:30"],
    // Без периода берётся период прежнего значения; без значения — AM.
    ["2:30", "10:00", "02:30"],
    ["2:30", "15:00", "14:30"],
    // Набрано 24-часовое время — период не нужен и не учитывается.
    ["14:30", "10:00", "14:30"],
    ["13", "10:00", "13:00"],
    ["", "10:00", "10:00"],
    ["2:75 PM", "10:00", "14:59"],
  ])("%s (was %s) → %s", (input, fallback, expected) => {
    expect(normalizeTime12(input, fallback)).toBe(expected);
  });
});

describe("12-hour input edge cases", () => {
  const L = { am: "AM", pm: "PM" };

  test("the last typed period letter wins", () => {
    expect(maskTime12("2:30 AMp")).toBe("2:30 PM");
    expect(maskTime12("2:30 PMa")).toBe("2:30 AM");
  });

  test("erasing does not re-complete the period, so Backspace is not stuck", () => {
    // Браузер отдаёт «2:30 P» после Backspace на «2:30 PM»: период не достраивается.
    expect(maskTime12("2:30 P", L, "2:30 PM")).toBe("2:30");
    expect(maskTime12("2:30 P", L)).toBe("2:30 PM");
    // Полная метка, оставшаяся после стирания цифры, сохраняется.
    expect(maskTime12("2:3 PM", L, "2:30 PM")).toBe("23 PM");
  });

  test("the period is recognised by the catalog labels, not by a stray letter", () => {
    const de = { am: "vorm.", pm: "nachm." };
    expect(normalizeTime12("2:30 nachm.", "10:00", de)).toBe("14:30");
    expect(normalizeTime12("2:30 vorm.", "15:00", de)).toBe("02:30");
    expect(maskTime12("2:30 nachm.", de, "2:30 nachm")).toBe("2:30 nachm.");
  });

  test("the last period letter wins in normalize as well", () => {
    expect(normalizeTime12("2:30 AMp", "10:00")).toBe("14:30");
  });
});
