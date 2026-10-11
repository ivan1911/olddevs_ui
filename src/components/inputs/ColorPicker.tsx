"use client";

import type { ReactNode } from "react";
import {
  ColorArea,
  ColorPicker as AriaColorPicker,
  ColorField,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
  ColorThumb,
  parseColor,
  Input,
  Label,
  SliderTrack,
  type Color,
} from "react-aria-components";
import { useMessages } from "../../i18n/useMessages.js";
import { useDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { FIELD_SHELL_CLASS } from "../../lib/field.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";

export interface ColorPickerProps {
  /** Текущий цвет строкой: `#4f7df3`, `rgb(...)`, `hsl(...)`. */
  value: string;
  /** Вызывается при смене цвета и получает строку в формате `outputFormat`. */
  onChange: (value: string) => void;
  /** Подпись поля. Обязательна: безымянный контрол скринридер называет только по роли. */
  label: string;
  /**
   * Пресеты под областью выбора.
   *
   * Умолчания нет намеренно: набор «фирменных» цветов — это домен потребителя,
   * а не кита. Значения токенов темы сюда подставляет тот, кто знает, какие из
   * них применимы к его сущности.
   *
   * Нераспознанная заготовка **пропускается**, а не роняет рендер. Это не то же
   * самое, что молчаливая правка `value`: значение потребитель хранит и отдаёт
   * дальше, а заготовка — оформление, и падать из-за оформления компонент не
   * должен. Библиотека на нераспознанной строке бросает **в фазе рендера**, то есть
   * уносит поддерево потребителя целиком.
   */
  presets?: string[];
  /**
   * Формат строки, которую компонент отдаёт в `onChange`.
   *
   * Поле ввода под ползунками остаётся **шестнадцатеричным всегда**, и это
   * названо в имени пропа: `rgb` и `hsl` — это не одно поле, а три поля
   * каналов, то есть другой контрол, а не другой формат того же. Подпись поля
   * поэтому тоже всегда `HEX`: подписать его «HSL», принимая hex, значило бы
   * врать пользователю прямо на экране.
   */
  outputFormat?: "hex" | "rgb" | "hsl";
  /** Выключает кнопку-триггер: панель выбора цвета не открывается. */
  disabled?: boolean;
  /** Содержимое кнопки-триггера вместо образца с подписью. */
  children?: ReactNode;
  /** Классы на кнопку-триггер. */
  className?: string;
}

/**
 * Заготовки, которые библиотека действительно умеет разобрать.
 *
 * `parseColor` бросает на непонятой строке, и бросок этот происходит в фазе
 * рендера. Причём ломается не экзотика: `rebeccapurple` — законный CSS-цвет,
 * который библиотека не берёт, а фирменную палитру совершенно естественно
 * держать именами.
 */
function parsablePresets(presets: string[] | undefined): string[] {
  if (!presets) return [];
  /*
    Дубликаты снимаются заодно — ради React-ключа, а не ради картинки: сам
    `ColorSwatchPicker` одинаковые цвета схлопывает, так что на экране повтор и
    так не виден, а `key={preset}` на нём дал бы два узла с одним ключом.
    Отдельным тестом это не проверяется: наблюдаемой разницы нет.
  */
  return [...new Set(presets)].filter((preset) => {
    try {
      parseColor(preset);
      return true;
    } catch {
      return false;
    }
  });
}

const AREA_CLASS = "h-[132px] w-full rounded-md";
const THUMB_CLASS =
  "h-4 w-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]";

/**
 * Выбор произвольного цвета.
 *
 * ОБЁРТКА, А НЕ СВОЯ МАТЕМАТИКА ЦВЕТА. Преобразования пространств, разбор
 * строк, доступные описания оттенков для скринридера и клавиатура двумерной
 * области — всё это уже есть в `react-aria-components` (общедоступно с 1.4.0).
 * Здесь только словарь токенов сверху и раскладка.
 *
 * КОМПОНЕНТ ВЫДАЁТ ЦВЕТ МИМО СИСТЕМЫ ТОКЕНОВ, и это его назначение, а не
 * недосмотр. Всё остальное в ките берёт цвет из темы; здесь пользователь
 * называет свой — и результат по построению не подчиняется ни теме, ни бренду.
 * Отсюда же следует, что контраст выбранного цвета кит не проверяет и
 * проверить не может: он не знает, на чём этот цвет окажется.
 *
 * ЖИВЁТ ОТДЕЛЬНЫМ ВХОДОМ `@olddevs/ui/color`, а не в barrel: цветовая
 * подсистема RAC стоит 61 кБ gzip — столько же, сколько весь остальной кит.
 * Разбор в ADR-0038 и в
 * докстроке `src/color.ts`.
 *
 * НАРУЖУ И ВНУТРЬ — СТРОКА, а не объект `Color` библиотеки. Объект протащил бы
 * тип RAC в сигнатуры потребителя и в его состояние; строку он и так хранит,
 * ею же и отдаёт на сервер.
 *
 * НЕРАСПОЗНАННАЯ СТРОКА В `value` СТАНОВИТСЯ ЧЁРНОЙ. Это поведение
 * react-aria, и кит его не перехватывает: подменять чужое значение молча — то
 * же самое, что молча его чинить. Но последствие стоит знать: первое же
 * движение ползунка отдаст в `onChange` чёрный, то есть заменит нераспознанное
 * значение распознанным. Проверять строку — обязанность потребителя, он же её и
 * сформировал.
 */
export function ColorPicker({
  value,
  onChange,
  label,
  presets,
  outputFormat = "hex",
  disabled = false,
  children,
  className,
}: ColorPickerProps) {
  const messages = useMessages();
  const describedBy = useDescribedBy(undefined);
  const swatches = parsablePresets(presets);

  return (
    <AriaColorPicker
      value={value}
      onChange={(color: Color) => onChange(color.toString(outputFormat))}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            /*
              Имя стоит на кнопке безусловно, а не рисуется подписью внутри:
              с `children` подпись не попадает никуда, и кнопка остаётся
              безымянной — ровно то, что докстрока `label` объявляет
              недопустимым.
            */
            aria-label={label}
            {...(describedBy ? { "aria-describedby": describedBy } : {})}
            className={cn(
              FIELD_SHELL_CLASS,
              "flex cursor-pointer items-center gap-2 px-2.5 py-1.5",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
          >
            {children ?? (
              <>
                <ColorSwatch className="border-line h-[18px] w-[18px] shrink-0 rounded border" />
                <span className="text-fg-0 text-[13px]">{label}</span>
              </>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[268px] p-3">
          <div className="flex flex-col gap-2.5">
            <ColorArea
              colorSpace="hsb"
              xChannel="saturation"
              yChannel="brightness"
              className={AREA_CLASS}
            >
              <ColorThumb className={THUMB_CLASS} />
            </ColorArea>

            <ColorSlider colorSpace="hsb" channel="hue">
              <SliderTrack className="h-3 w-full rounded-full">
                <ColorThumb className={cn(THUMB_CLASS, "top-1/2")} />
              </SliderTrack>
            </ColorSlider>

            <ColorField className="flex items-center gap-2">
              <Label className="text-fg-2 text-caption">{messages.colorPicker.hex}</Label>
              <Input
                data-disable-focus-ring="true"
                className={cn(
                  FIELD_SHELL_CLASS,
                  "text-fg-0 min-w-0 flex-1 px-2 py-1 text-[13px] outline-none"
                )}
              />
            </ColorField>

            {swatches.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-fg-2 text-caption">{messages.colorPicker.presets}</span>
                <ColorSwatchPicker className="flex flex-wrap gap-1.5">
                  {swatches.map((preset) => (
                    <ColorSwatchPickerItem
                      key={preset}
                      color={preset}
                      className="focus-visible:outline-accent-strong selected:ring-accent-strong selected:ring-2 selected:ring-offset-1 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <ColorSwatch className="border-line h-[22px] w-[22px] rounded border" />
                    </ColorSwatchPickerItem>
                  ))}
                </ColorSwatchPicker>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </AriaColorPicker>
  );
}
