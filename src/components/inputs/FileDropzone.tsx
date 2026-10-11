"use client";

import { useState, type ReactNode } from "react";
import {
  Button as AriaButton,
  DropZone,
  FileTrigger,
  Text as AriaText,
} from "react-aria-components";
import { UploadIcon } from "../../icons.js";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";

/** Файл, который не приняли, и причина отказа. */
export interface RejectedFile {
  /** Имя отклонённого файла. */
  name: string;
  /**
   * Причина отказа, уже готовая к показу пользователю: неподходящий тип или
   * слишком большой размер.
   */
  reason: string;
}

export interface FileDropzoneProps {
  /** Принятые типы в формате `accept` у `<input type="file">`: `image/*`, `.jpg,.png`. */
  accept?: string;
  /** Разрешает несколько файлов за раз. По умолчанию включено. */
  multiple?: boolean;
  /** Предел размера одного файла в байтах. */
  maxSize?: number;
  /** Вызывается с файлами, прошедшими проверку типа и размера. */
  onFiles: (files: File[]) => void;
  /**
   * Вызывается с файлами, которые не прошли проверку, и причинами отказа.
   *
   * Отклонённые файлы. Не колбэк-уведомление, а часть возврата: показать их
   * обязан сам компонент — см. докстроку.
   */
  onReject?: (rejected: RejectedFile[]) => void;
  /** Подпись внутри области. */
  label?: string;
  /** Пояснение под подписью: допустимые форматы, предел размера. */
  hint?: ReactNode;
  /** Выключает область: файлы не принимаются ни перетаскиванием, ни кнопкой. */
  disabled?: boolean;
  /** Классы на корневой элемент. */
  className?: string;
}

/*
  Размер файла — ФОРМАТИРОВАНИЕ, а не перевод: «МБ» и «MB» это одна и та же
  единица, записанная по правилам локали. Поэтому единица берётся у
  `Intl.NumberFormat`, а не из каталога сообщений — иначе каждый новый язык
  требовал бы переводить сокращения СИ вручную и ошибаться в них.
*/
function formatSize(bytes: number, locale: string): string {
  const mega = bytes >= 1024 * 1024;
  const value = Math.round(mega ? bytes / 1024 / 1024 : bytes / 1024);
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: mega ? "megabyte" : "kilobyte",
    unitDisplay: "short",
  }).format(value);
}

/**
 * Область для перетаскивания файлов.
 *
 * **Отклонённые файлы показываются с причиной, а не пропадают молча.** Это
 * единственное решение компонента, и оно из опыта: область, которая на десять
 * брошенных файлов принимает семь и ничего не говорит про три, читается как
 * «загрузка сломалась». Причина пишется рядом с именем — «слишком большой,
 * 14 МБ», — потому что «файл не принят» не даёт пользователю ничего исправить.
 *
 * Мышь и клавиатура равноправны: перетаскивание даёт `DropZone`, кнопка выбора —
 * `FileTrigger`. Область без кнопки была бы недоступна с клавиатуры вовсе, а
 * это не «менее удобно», а «нельзя пользоваться».
 */
export function FileDropzone({
  accept,
  multiple = true,
  maxSize,
  onFiles,
  onReject,
  label,
  hint,
  disabled,
  className,
}: FileDropzoneProps) {
  const messages = useMessages();
  const locale = useUiLocale();
  const [rejected, setRejected] = useState<RejectedFile[]>([]);

  const accepts = (file: File) => {
    if (!accept) return true;
    return accept.split(",").some((rule) => {
      const r = rule.trim();
      if (r.endsWith("/*")) return file.type.startsWith(r.slice(0, -1));
      if (r.startsWith(".")) return file.name.toLowerCase().endsWith(r.toLowerCase());
      return file.type === r;
    });
  };

  const sort = (files: File[], extra: RejectedFile[] = []) => {
    const ok: File[] = [];
    const bad: RejectedFile[] = [...extra];

    for (const file of files) {
      // Через каталог, как и остальные три причины: строкой на месте она
      // читалась по-русски посреди английского интерфейса.
      if (!accepts(file)) bad.push({ name: file.name, reason: messages.fileDropzone.wrongType });
      else if (maxSize != null && file.size > maxSize)
        bad.push({
          name: file.name,
          reason: messages.fileDropzone.tooLarge({ size: formatSize(file.size, locale) }),
        });
      else ok.push(file);
    }

    /*
      Предел числа файлов держится ЗДЕСЬ, а не только у `FileTrigger`: его
      `allowsMultiple` управляет диалогом выбора, а перетаскиванию не указ.
      На однофайловую область можно было бросить пять файлов, и все пять
      уезжали вызывающему — молча, вопреки собственному пропу.
    */
    const accepted = multiple ? ok : ok.slice(0, 1);
    for (const file of ok.slice(accepted.length))
      bad.push({ name: file.name, reason: messages.fileDropzone.singleFileOnly });

    setRejected(bad);
    if (accepted.length) onFiles(accepted);
    if (bad.length) onReject?.(bad);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <DropZone
        isDisabled={disabled}
        onDrop={async (e) => {
          /*
            Каждый файл разрешается ОТДЕЛЬНО.

            `Promise.all` отбрасывал весь массив, если хоть один `getFile()`
            отклонился: пользователь бросал пять файлов, один из которых лежал на
            отключившемся сетевом диске или был удалён между началом
            перетаскивания и дропом, — и не получал ни одного файла, ни одной
            причины, а отказ уезжал в необработанный rejection. То самое «загрузка
            сломалась», которого докстрока обещает не допускать.
          */
          const dropped = e.items.filter(
            (item): item is Extract<typeof item, { kind: "file" }> => item.kind === "file"
          );
          const settled = await Promise.allSettled(dropped.map((item) => item.getFile()));
          const files = settled
            .filter((r): r is PromiseFulfilledResult<File> => r.status === "fulfilled")
            .map((r) => r.value);
          // Имя берётся у САМОГО ЭЛЕМЕНТА ПЕРЕНОСА, а не у файла: файла-то и
          // нет — он не прочитался. Порядок `allSettled` совпадает с порядком
          // входа, поэтому индекс ведёт к нужному элементу.
          const unreadable: RejectedFile[] = settled.flatMap((r, index) =>
            r.status === "rejected"
              ? [{ name: dropped[index]!.name, reason: messages.fileDropzone.unreadable }]
              : []
          );
          /*
            Папки отклоняются С ПРИЧИНОЙ, а не отфильтровываются молча.
            Перетащенная папка иначе не давала ни файлов, ни сообщения —
            область выглядела сломанной ровно так, как обещано не делать.
          */
          const folders = e.items
            .filter((item) => item.kind === "directory")
            .map((item) => ({
              name: "name" in item ? item.name : messages.fileDropzone.folderName,
              reason: messages.fileDropzone.foldersNotAccepted,
            }));
          sort(files, [...folders, ...unreadable]);
        }}
        className={cn(
          "border-line-soft bg-bg-1 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-8 transition-colors",
          // Состояние переноса берётся вариантом плагина: атрибут `data-drop-target`
          // висит на самой области, и красится она же.
          "drop-target:border-accent-strong drop-target:bg-accent-soft",
          "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
          // Выключенность выражена ТОНАМИ, а не `opacity-50`, и это не
          // вкусовщина: область — обычный div, а не поле формы, и аудит axe
          // меряет её контраст наравне с рабочей. Полупрозрачность роняла
          // подпись ниже 4.5 — то самое правило, которым уже поплатился `Alert`.
          disabled && "bg-bg-2 cursor-not-allowed"
        )}
      >
        <span aria-hidden className="text-fg-3">
          <UploadIcon size={24} strokeWidth={1.5} />
        </span>
        {/*
          `AriaText slot="label"` — не украшение: `DropZone` берёт отсюда своё
          доступное имя. Обычный `<span>` оставил бы область безымянной, и
          скринридер объявил бы «область перетаскивания» без единого слова о том,
          что сюда класть.
        */}
        <AriaText slot="label" className={cn("text-sm", disabled ? "text-fg-2" : "text-fg-1")}>
          {label ?? messages.fileDropzone.label}
        </AriaText>
        {hint ? <span className="text-fg-2 text-caption">{hint}</span> : null}

        <FileTrigger
          acceptedFileTypes={accept?.split(",")}
          allowsMultiple={multiple}
          onSelect={(list) => sort(Array.from(list ?? []))}
        >
          {/*
            Кнопка — `AriaButton`, а не наша. `FileTrigger` подключает потомка
            через `PressResponderContext` react-aria, и обычная `<button>` его
            не читает: диалог выбора файла не открывался ВООБЩЕ, а в консоли
            висело «A PressResponder was rendered without a pressable child».
            Проверено: с нашей кнопкой `input.click()` не звался ни разу, с
            этой — ровно один.

            Вид при этом общий, из `lib/button.ts`, — расходиться им нечем.
            Та же механика, что у `MenuButton` и у триггера `Combobox`.
          */}
          <AriaButton
            isDisabled={disabled}
            className={buttonClasses({ variant: "soft", tone: "neutral", size: "sm" })}
          >
            {messages.fileDropzone.browse}
          </AriaButton>
        </FileTrigger>
      </DropZone>

      {/*
        Область объявления смонтирована ВСЕГДА, а содержимое подменяется.
        Живая область, вставленная в документ вместе с текстом, объявляется
        ненадёжно — часть скринридеров успевает её пропустить.

        `role="alert"` висит на контейнере, а не на списке: роль перебила бы
        роль `ul`, и число отклонённых файлов потерялось бы.
      */}
      <div role="alert" className="empty:hidden">
        {rejected.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {rejected.map((file) => (
              <li key={file.name} className="text-danger-strong text-caption">
                {file.name} — {file.reason}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
