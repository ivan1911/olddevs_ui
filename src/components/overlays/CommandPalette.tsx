"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Autocomplete,
  Collection,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  SearchField,
  useFilter,
} from "react-aria-components";
import { SearchIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useOpenerFocus } from "../../hooks/useOpenerFocus.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { useOverlayLayer } from "../../hooks/useOverlayLayer.js";
import { LISTBOX_ITEM_CLASS } from "../../lib/menu.js";
import { useMessages } from "../../i18n/useMessages.js";
import { Kbd } from "../content/Kbd.js";
import { Spinner } from "../actions/Spinner.js";
import { VisuallyHidden } from "../content/VisuallyHidden.js";

export interface CommandItem {
  /** Идентификатор пункта: он приходит в `onSelect` палитры, когда пункт выбран. */
  id: string;
  /** Название пункта: показывается в списке и участвует в поиске. */
  label: string;
  /** Горячие клавиши пункта: `["⌘", "K"]`. Показываются справа. */
  shortcut?: string[];
  /** Дополнительные слова для поиска — синонимы, английское название. */
  keywords?: string;
  /** Иконка слева от названия пункта. */
  icon?: ReactNode;
}

export interface CommandSection {
  /** Идентификатор раздела: ключ списка и признак для `prefiltered`. */
  id: string;
  /** Заголовок раздела. */
  label: string;
  /** Пункты раздела. */
  items: CommandItem[];
  /**
   * Раздел уже отфильтрован снаружи — показывать как есть, не просеивая
   * локально и не пересортировывая.
   *
   * ЗАЧЕМ ОТКЛЮЧАТЬ СОБСТВЕННЫЙ ПОИСК ПАЛИТРЫ. Для действий приложения он
   * правильный: набор известен заранее и лежит целиком в памяти. Для находок
   * сервера — разрушительный: они уже отобраны, причём по другим правилам, и
   * второе просеивание подстрокой выбрасывает верные.
   *
   * Заявка потребителя показывает это на морфологии: поиск по `tsvector` с
   * русским словарём находит «Подписать договор» по запросу «договоры», а
   * `contains` такую пару не сматчит никогда — подстроки в заголовке нет.
   * Обойти через `keywords` нельзя в принципе: сколько слов туда ни клади,
   * фильтр по подстроке не станет морфологическим. Это не про объём данных, а
   * про правила сравнения.
   *
   * Порядок пунктов тоже сохраняется как передан: ранжирование сделал тот, кто
   * искал, и пересортировка сломала бы его.
   */
  prefiltered?: boolean;
}

export interface CommandPaletteProps {
  /** Показана ли палитра. */
  open: boolean;
  /** Палитра просит закрыться: Escape, клик мимо и сразу после выбора пункта. */
  onClose: () => void;
  /** Разделы с пунктами; каждый показан под своим заголовком, сворачиваться разделы не умеют. */
  sections: CommandSection[];
  /** Пункт выбран; приходит его `id`. Закрывать палитру отдельно не нужно: `onClose` зовётся следом. */
  onSelect: (id: string) => void;
  /** Плейсхолдер в пустом поле поиска. Не задан — строка из каталога сообщений. */
  placeholder?: string;
  /**
   * Что показывать на пустом запросе.
   *
   * `all` — весь список разделами: палитра работает как оглавление, и её
   * открывают не только чтобы найти, но и чтобы вспомнить, что вообще есть.
   * `hint` — одна строка подсказки: когда действий сотни и список сам по себе
   * ничего не сообщает.
   *
   * Умолчание `all`: у приложения с двумя десятками действий пустая палитра —
   * это выброшенная возможность показать их все.
   */
  emptyBehaviour?: "all" | "hint";
  /** Строка подсказки на пустом запросе при `emptyBehaviour="hint"`. Не задана — текст из каталога сообщений. */
  emptyHint?: ReactNode;
  /** Текст, когда запрос ничего не нашёл. Не задан — «Ничего не найдено» из каталога сообщений. */
  notFoundText?: string;
  /** Доступное имя палитры и её списка; видимого заголовка нет. Не задано — строка из каталога сообщений. */
  title?: string;
  /**
   * Набранный запрос — наружу, на каждое изменение поля.
   *
   * Уведомление, а не управление: поле остаётся за компонентом. Этого хватает,
   * чтобы запустить поиск на сервере, и не заводит второй контракт, который
   * пришлось бы поддерживать.
   *
   * Зовётся и на очистку поля кнопкой, и на сброс при закрытии палитры: потребитель
   * иначе остался бы с запросом, которого в поле уже нет, и продолжил бы по нему
   * ходить в сеть.
   *
   * Дребезг — забота потребителя: его величина зависит от цены запроса, а она
   * киту неизвестна.
   */
  onQueryChange?: (query: string) => void;
  /**
   * Идёт поиск на стороне потребителя.
   *
   * Показанные результаты не прячутся: список, мигающий на каждый символ, хуже
   * списка, отстающего на полсекунды. Меняются два места — иконка поля и текст
   * пустого состояния.
   */
  loading?: boolean;
  /** Чем заменить «ничего не найдено», пока идёт поиск. Умолчание — «Загрузка». */
  loadingText?: ReactNode;
}

/**
 * Командная палитра: поиск по действиям приложения.
 *
 * СОБРАНА ИЗ ТРЁХ ГОТОВЫХ ЧАСТЕЙ, и ни одна не написана заново:
 * `Dialog` Radix даёт модальность (ловушка фокуса, возврат фокуса, портал),
 * `Autocomplete` react-aria — связку поля и списка (фильтрация, стрелки,
 * `aria-activedescendant`), `ListBox` — сам список с разделами.
 *
 * Своего здесь три решения: что показывать на пустом запросе, как выглядят
 * горячие клавиши пункта и то, что **разделы не сворачиваются**. Последнее
 * важно: палитра открывается на долю секунды, и элемент управления, который
 * надо сначала раскрыть, в этот сценарий не помещается.
 *
 * Поле поиска — `SearchField` без видимой подписи: подпись здесь была бы
 * шумом (что ещё делать в палитре, кроме как искать), но скринридеру имя
 * нужно, и оно даётся скрытой подписью.
 */
export function CommandPalette({
  open,
  onClose,
  sections,
  onSelect,
  placeholder,
  emptyBehaviour = "all",
  emptyHint,
  notFoundText,
  title,
  onQueryChange,
  loading = false,
  loadingText,
}: CommandPaletteProps) {
  const messages = useMessages();
  // `contains` из react-aria, а не `String.includes`: он знает про регистр и
  // диакритику в текущей локали — «ёлка» находится по «елка».
  const { contains } = useFilter({ sensitivity: "base" });

  /*
    Запрос держится своим состоянием, потому что `emptyBehaviour` — это про
    ПУСТОЙ запрос, а не про режим компонента. Без него условие ниже было
    константой: при `hint` список получал пустой набор навсегда, и палитра
    превращалась в поле поиска, которое ничего не может найти. Ловится только
    попыткой что-нибудь набрать — ни снимок, ни axe этого не видят.
  */
  const [query, setQuery] = useState("");
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { remember, restore } = useOpenerFocus(open, contentRef);
  // Слой состоит в общем стеке — ADR-0041 обещает это для ВСЕХ модальных
  // слоёв кита, а не только для подложки.
  useOverlayLayer(open, contentRef);

  /*
    Запрос не переживает закрытие.

    Он живёт состоянием компонента, а не содержимого диалога, и при `open=false`
    сохранялся: выбрав пункт, пользователь при следующем ⌘K видел прошлый запрос
    и отфильтрованный по нему список. Через Escape этого было не видно — там
    `SearchField` из react-aria чистит значение сам, — поэтому дефект
    воспроизводился только на выборе пункта и клике мимо.
  */
  useEffect(() => {
    if (open || query === "") return;
    setQuery("");
    onQueryChange?.("");
  }, [open, query, onQueryChange]);

  /*
    Разделы, которые не надо просеивать локально, — множеством `id`, а не
    поиском по массиву на каждый пункт: фильтр зовётся для каждой строки на
    каждый набранный символ.
  */
  const prefilteredIds = useMemo(
    () => new Set(sections.filter((section) => section.prefiltered).map((section) => section.id)),
    [sections]
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "animate-fadein data-[state=closed]:animate-fadeout fixed inset-0",
            OVERLAY_LAYER.modal
          )}
          style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(4px)" }}
        />
        <DialogPrimitive.Content
          ref={contentRef}
          onOpenAutoFocus={remember}
          onCloseAutoFocus={restore}
          className={cn(
            "border-line-soft bg-bg-1 fixed top-[12vh] left-1/2 flex max-h-[70vh] w-[min(560px,92vw)] -translate-x-1/2 flex-col overflow-hidden rounded-lg border shadow-[var(--shadow-2)] outline-none",
            OVERLAY_LAYER.modal
          )}
          aria-label={title ?? messages.commandPalette.title}
        >
          {/* Имя окна обязано быть в разметке: без `Dialog.Title` Radix ругается
              в консоль, а скринридер объявляет безымянный диалог. Видимого
              заголовка у палитры нет — она сама себя объясняет полем поиска. */}
          <DialogPrimitive.Title asChild>
            <VisuallyHidden>{title ?? messages.commandPalette.title}</VisuallyHidden>
          </DialogPrimitive.Title>

          {/*
            Фильтрация остаётся за react-aria, а раздел выводится из-под неё
            третьим аргументом — узлом коллекции. Пункт списка лежит внутри
            `ListBoxSection`, поэтому его `parentKey` и есть `id` раздела.

            Так, а не своим просеиванием `sections` до передачи в список: за
            фильтром висит ещё и фокус первого совпадения, и `aria-activedescendant`.
            Забрав фильтрацию себе, пришлось бы повторять и это.
          */}
          <Autocomplete
            filter={(textValue, inputValue, node) =>
              (node.parentKey != null && prefilteredIds.has(String(node.parentKey))) ||
              contains(textValue, inputValue)
            }
          >
            <SearchField
              aria-label={placeholder ?? messages.commandPalette.placeholder}
              value={query}
              onChange={(next) => {
                setQuery(next);
                onQueryChange?.(next);
              }}
              autoFocus
              className="border-line-soft flex items-center gap-2 border-b px-4 py-3"
            >
              {/*
                Спиннер на месте лупы, а не рядом: он же и объявляет занятость —
                у `Spinner` внутри `role="status"` со скрытой подписью, поэтому
                отдельная живая область была бы вторым голосом про то же самое.

                КОРОБКУ ПОД ИКОНКУ ДЕРЖИТ РАЗМЕТКА, А НЕ СОДЕРЖИМОЕ. Лупа — 16
                пикселей, крутилка ступени `sm` — 14, и пока место занимала сама
                иконка, поле вместе с набранным текстом уезжало на эти два
                пикселя туда и обратно на каждое включение загрузки. Поиск в
                палитре ходит на сервер, запрос уходит на каждое изменение поля — текст
                дёргался в такт паузам в наборе и читался не как «идёт
                загрузка», а как «экран перезагружается». Так показал замер
                потребителя.

                Тот же приём, что у места ручки в `EditableList`: слот держит
                раскладка, и содержимое может меняться, не двигая соседей.
              */}
              <span className="flex size-4 shrink-0 items-center justify-center">
                {loading ? (
                  <Spinner size="sm" tone="neutral" />
                ) : (
                  <SearchIcon size={16} aria-hidden className="text-fg-3" />
                )}
              </span>
              <Input
                placeholder={placeholder ?? messages.commandPalette.placeholder}
                data-disable-focus-ring="true"
                className="text-fg-0 placeholder:text-fg-2 text-md w-full border-0 bg-transparent outline-none"
              />
            </SearchField>

            <ListBox
              aria-label={title ?? messages.commandPalette.title}
              className="flex flex-col gap-1 overflow-y-auto p-2 outline-none"
              onAction={(key) => {
                onSelect(String(key));
                // Палитра закрывается сама: действие выбрано, и оставлять её
                // открытой поверх результата — значит требовать второго жеста
                // там, где пользователь уже всё сказал.
                onClose();
              }}
              renderEmptyState={() => (
                <div className="text-fg-2 px-3 py-6 text-center text-sm">
                  {/* Порядок ветвей важен: пока идёт поиск, пустое состояние не
                      имеет права утверждать, что ничего не нашлось. Именно это
                      и происходило на каждый набранный символ. */}
                  {loading
                    ? (loadingText ?? messages.common.loading)
                    : query === "" && emptyBehaviour === "hint"
                      ? (emptyHint ?? messages.commandPalette.emptyHint)
                      : (notFoundText ?? messages.common.notFound)}
                </div>
              )}
              items={query === "" && emptyBehaviour === "hint" ? [] : sections}
            >
              {(section: CommandSection) => (
                <ListBoxSection id={section.id}>
                  <Header className="text-fg-2 text-caption px-2 pt-2 pb-1 font-semibold">
                    {section.label}
                  </Header>
                  <Collection items={section.items}>
                    {(item: CommandItem) => (
                      <ListBoxItem
                        id={item.id}
                        textValue={`${item.label} ${item.keywords ?? ""}`}
                        className={cn(LISTBOX_ITEM_CLASS, "gap-2")}
                      >
                        {item.icon ? (
                          <span aria-hidden className="text-fg-3 flex shrink-0 items-center">
                            {item.icon}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.shortcut ? (
                          <span aria-hidden className="flex shrink-0 items-center gap-1">
                            {item.shortcut.map((key) => (
                              <Kbd key={key}>{key}</Kbd>
                            ))}
                          </span>
                        ) : null}
                      </ListBoxItem>
                    )}
                  </Collection>
                </ListBoxSection>
              )}
            </ListBox>
          </Autocomplete>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
