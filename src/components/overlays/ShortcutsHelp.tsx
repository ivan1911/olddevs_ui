"use client";

import { Fragment, useId, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { hasContent } from "../../lib/empty.js";
import { Dialog } from "./Dialog.js";
import { Kbd } from "../content/Kbd.js";
import { ScrollArea } from "../content/ScrollArea.js";

export interface ShortcutItem {
  /**
   * Клавиши сочетания по порядку: `["Ctrl", "K"]`.
   *
   * Одна строка на клавишу, а не «Ctrl+K» целиком: каждая рисуется своей `Kbd`,
   * а между ними встают разделитель для глаз и слово для слуха. Разбирать
   * строку по `+` кит не берётся — сама клавиша бывает плюсом.
   */
  keys: string[];
  /** Что делает сочетание: «Открыть поиск». */
  description: ReactNode;
}

export interface ShortcutGroup {
  /** Стабильный ключ группы для списка React; в разметку как `id` не попадает. */
  id: string;
  /** Подпись группы: «Навигация», «Редактирование». */
  label: ReactNode;
  /** Сочетания группы в порядке показа. */
  items: ShortcutItem[];
}

export interface ShortcutsHelpProps {
  /** Показано ли окно со сводом. */
  open: boolean;
  /** Окно просит сменить состояние: кнопка закрытия, Escape и клик мимо дают `false`. */
  onOpenChange: (open: boolean) => void;
  /** Заголовок окна. Не задан — «Горячие клавиши» из каталога сообщений. */
  title?: ReactNode;
  /** Группы сочетаний — уже собранные: что и под какой клавишей — знает приложение. */
  groups: ShortcutGroup[];
}

/**
 * Свод горячих клавиш в модальном окне.
 *
 * КИТ НЕ ЗНАЕТ СОЧЕТАНИЙ И НЕ ВЕШАЕТ ГЛОБАЛЬНЫХ КЛАВИШ. Какие клавиши есть у
 * экрана и по какой из них открывается свод («?», как у GitHub и Linear), решает
 * приложение: оно же сопоставляет нажатия, и с этим кит ничего сделать не может.
 * Буквенные сочетания («G, H») стоит сверять по положению клавиши (`event.code`),
 * иначе на русской раскладке они молчат; знак «?» — по символу (`event.key`). Обработчик глобальной
 * клавиши, поставленный здесь, срабатывал бы и в поле ввода, и поверх чужого
 * диалога — ровно там, где потребитель знает, что делать, а кит нет.
 *
 * СОЧЕТАНИЕ СОБИРАЕТ `Kbd`, А НЕ `Keyboard`. Одноимённый `Keyboard` — экранная
 * клавиатура для ввода текста, а не способ нарисовать «Ctrl+K»; формулировка
 * задачи путала их из-за имени.
 *
 * ЧТО УСЛЫШИТ СКРИНРИДЕР. Видимый «+» между клавишами убран из дерева
 * доступности, вместо него читается слово из каталога: «Ctrl плюс K». Знак
 * «+» озвучивается по настройкам пользователя — NVDA на умолчательном уровне
 * пунктуации его пропускает, и «Ctrl K» звучало бы как две клавиши подряд, а не
 * как сочетание. В отличие от `CommandPalette`, где сочетание у пункта целиком
 * `aria-hidden`: там это подсказка рядом с пунктом, который и так выбирается.
 * Здесь сочетание — единственное содержимое окна, скрыть его значило бы
 * показать слепому пустую шпаргалку.
 *
 * ПУНКТ — СТРОКА СПИСКА, А НЕ `dl`. Пары «термин — определение» выглядят точнее,
 * но их озвучка непоследовательна: часть пар скринридер/браузер читает без числа
 * элементов и без границ пары. Список читают везде — «список, 3 элемента» — и
 * порядок «описание, затем сочетание» в нём естественен.
 *
 * ГРУППА — ГРУППА С ИМЕНЕМ, а не заголовок. Уровень заголовка зависит от того,
 * куда окно встало; тот же довод и тот же разбор, что у `NotificationList`.
 *
 * ПРОКРУТКА — ВНУТРИ ОКНА, на `ScrollArea` кита. Длинный свод не выталкивает
 * шапку с крестиком за экран. Область получает остановку табуляции и имя: без
 * первой пользователь клавиатуры не прокрутит её стрелками, без второй
 * остановка безымянна.
 */
export function ShortcutsHelp({ open, onOpenChange, title, groups }: ShortcutsHelpProps) {
  const messages = useMessages();
  const baseId = useId();
  // `hasContent`, а не `??`: пустая строка оставила бы окно без заголовка, а
  // с ним — без доступного имени.
  const heading = hasContent(title) ? title : messages.shortcutsHelp.title;
  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={heading}
      className="w-full max-w-md"
    >
      <ScrollArea
        label={messages.shortcutsHelp.list}
        // Рамка фокуса внутри области: снаружи её срезало бы краем самой области.
        // `relative` — не косметика: слова-разделители под `sr-only` абсолютно
        // позиционированы, и без опорного предка они уезжали к подложке окна и
        // растягивали её прокрутку на всю длину списка (нашла ручная проверка).
        className="relative max-h-[min(70vh,32rem)] rounded-b-lg px-5 py-4 focus-visible:-outline-offset-2"
      >
        <div className="flex flex-col gap-5">
          {groups
            .filter((group) => group.items.length > 0)
            .map((group, groupIndex) => {
              // Номер, а не `group.id`: `aria-labelledby` — список идентификаторов
              // через пробел, и `id` с пробелом оставил бы группу без имени.
              const labelId = `${baseId}-${groupIndex}`;
              return (
                <div key={group.id} role="group" aria-labelledby={labelId}>
                  <div
                    id={labelId}
                    className="text-fg-2 pb-2 text-[11px] font-bold tracking-wide uppercase"
                  >
                    {group.label}
                  </div>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {group.items.map((item, index) => (
                      <li key={index} className="flex items-center justify-between gap-4">
                        <span className="text-fg-1 min-w-0 text-[13px]">{item.description}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {item.keys.map((key, keyIndex) => (
                            <Fragment key={keyIndex}>
                              {keyIndex > 0 && (
                                <>
                                  <span aria-hidden="true" className="text-fg-3 text-caption">
                                    +
                                  </span>
                                  <span className="sr-only">
                                    {messages.shortcutsHelp.keySeparator}
                                  </span>
                                </>
                              )}
                              <Kbd size="md">{key}</Kbd>
                            </Fragment>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </Dialog>
  );
}
