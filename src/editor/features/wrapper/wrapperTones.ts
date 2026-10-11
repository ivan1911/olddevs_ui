import type { EditorWrapperTone } from "../../../i18n/messages.js";

/**
 * Тоны Обёртки — ДАННЫМИ: их читают Схема-данные и очистка на
 * сервере (`schema.ts`), узел Обёртки и Markdown Редактора (`wrapper.ts`,
 * `markdown.ts`), меню ручки и гейт контраста (`scripts/contrast.mjs`).
 *
 * ИМЕНА — СЛОВАРЬ `Tone` КИТА, а не слова меню. В Документ уходит
 * `data-tone="warning"`: имя переживает смену подписи и языка интерфейса, а
 * значение цвета подставляет тема, как у `data-color` (`palette.ts`). Подписи
 * меню — словами GitHub alerts («Заметка», «Совет», «Важно», «Внимание»,
 * «Осторожно»): тон выбирают по смыслу заметки, а не по цвету.
 *
 * Порядок — порядок меню и GitHub alerts: NOTE, TIP, IMPORTANT, WARNING,
 * CAUTION.
 *
 * Модуль серверно-безопасен: данные и чистые функции, без движка.
 */
export const EDITOR_WRAPPER_TONES = [
  "accent",
  "success",
  "neutral",
  "warning",
  "danger",
] as const satisfies readonly EditorWrapperTone[];

const known: ReadonlySet<string> = new Set(EDITOR_WRAPPER_TONES);

/**
 * Тон из атрибута `data-tone` или `null`. Значение — точно, как его пишет
 * Редактор: `Accent`, ` accent` и имена вне словаря отбрасываются, Обёртка
 * остаётся без тона.
 */
export function wrapperToneFrom(value: unknown): EditorWrapperTone | null {
  return typeof value === "string" && known.has(value) ? (value as EditorWrapperTone) : null;
}

/**
 * Метка GitHub alert для тона: Обёртка с тоном в Markdown — цитата с этой
 * меткой первой строкой (`> [!NOTE]`). Соответствие — по смыслу метки, как в
 * меню: NOTE — акцент, TIP — успех, IMPORTANT — нейтральный (у GitHub он
 * фиолетовый, но такого тона у кита нет), WARNING — предупреждение, CAUTION —
 * опасность.
 */
export const WRAPPER_TONE_ALERTS = {
  accent: "NOTE",
  success: "TIP",
  neutral: "IMPORTANT",
  warning: "WARNING",
  danger: "CAUTION",
} as const satisfies Record<EditorWrapperTone, string>;
