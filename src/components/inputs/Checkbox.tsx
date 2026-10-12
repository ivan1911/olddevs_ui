"use client";

import {
  createContext,
  forwardRef,
  useContext,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from "react";
import { CheckboxButton, CheckboxField, Text } from "react-aria-components";
import { CheckIcon, MinusIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { STATE_BORDER, TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface CheckboxProps {
  /** Видимая подпись справа от коробки. */
  children?: ReactNode;
  /**
   * Доступное имя для флажка без видимой подписи — в шапке таблицы, в строке
   * списка. Когда подпись есть, задавать не нужно: её и объявит скринридер.
   *
   * Компилятор наличия имени не требует, и это осознанно. Союзный тип
   * («либо `children`, либо `label`») ломается в двух местах сразу: третий
   * аргумент `createElement` в проверку союза не сворачивается, а `Omit` по
   * союзу схлопывает его — то есть падают и матрица класс-покрытия, и любая
   * обёртка в историях. Ровно этот компромисс уже описан у `Button.iconOnly`,
   * и он там разрешён так же: имя сторожит не компилятор, а аудит axe —
   * безымянный флажок роняет его как `critical`. Проверка есть в
   * `tests-visual/a11y.spec.ts`.
   */
  label?: string;
  /** Отмечен ли флажок — управляемое значение; обновлять его нужно в `onCheckedChange`. */
  checked?: boolean;
  /** Начальное состояние неуправляемого флажка: отмечен ли он при первом показе. */
  defaultChecked?: boolean;
  /**
   * Третье состояние — «часть выбрана».
   *
   * Перекрывает `checked` при отрисовке и не снимается кликом: пользователь
   * переводит флажок в да/нет, а «частично» ставит только вызывающий, пересчитав
   * набор. Это поведение RAC, и оно же — единственно осмысленное: снять
   * «частично» кликом означало бы выдумать за пользователя, что он имел в виду.
   */
  indeterminate?: boolean;
  /** Вызывается при смене отметки и получает новое состояние. */
  onCheckedChange?: (checked: boolean) => void;
  /** Пояснение под подписью. */
  description?: ReactNode;
  /**
   * Иконка пункта. Декоративная: из доступного имени исключена, имя несёт
   * подпись. В карточке стоит в её начале, в обычном виде — между коробкой и
   * подписью.
   */
  icon?: ReactNode;
  /** Размер флажка: `sm` — меньшая коробка, `md` — большая. По умолчанию `md`. */
  size?: Extract<Size, "sm" | "md">;
  /**
   * Слот react-aria: `selection` — флажок выделения в таблице или списке.
   *
   * Через него компонент забирает состояние у контекста коллекции — включая
   * «выделено не всё» у флажка в шапке. Без слота такой флажок пришлось бы
   * связывать с выделением руками, повторяя работу библиотеки, и он молча
   * оставался бы немым: ни отметки, ни третьего состояния.
   */
  slot?: string;
  /**
   * Тон отмеченного флажка; неотмеченный всегда нейтрален.
   *
   * Цвет отмеченного состояния (в карточке — ещё и рамки отмеченной карточки).
   * На неотмеченный флажок не влияет — он всегда нейтрален, как невыбранный
   * `Chip`: тон здесь означает «что значит согласие», а не «какого цвета рамка».
   *
   * Внутри `CheckboxGroup` с заданным `tone` игнорируется: тон набора один на
   * всех. У группы без `tone` и вне группы работает как раньше.
   */
  tone?: Tone;
  /** Выключает флажок: отметить или снять его нельзя. */
  disabled?: boolean;
  /** Показывает флажок в состоянии ошибки. */
  invalid?: boolean;
  /** Имя и значение для нативной отправки формы. */
  name?: string;
  /**
   * Значение для нативной отправки формы; внутри `CheckboxGroup` — ключ пункта
   * в массиве группы.
   */
  value?: string;
  /** Классы на корневой элемент. */
  className?: string;
}

/**
 * Карточка, которую `CheckboxGroup appearance="card"` рисует вместо строки.
 *
 * Получает все пропы флажка и уже решённый `tone` — итог выбора между тоном
 * набора и собственным. Раскладку набора она берёт из своего контекста, а не
 * отсюда: обычному флажку она ни к чему, а каждое лишнее поле в этом файле
 * оплачивает и `DataTable`.
 */
export type CheckboxCardComponent = ForwardRefExoticComponent<
  CheckboxProps & { tone: Tone } & RefAttributes<HTMLDivElement>
>;

/**
 * Контекст набора флажков: тон и, у карточек, рисовальщик карточки.
 *
 * `Card` лежит в контексте, а не импортируется в этот файл, и это не вкус, а
 * размер бандла. Голый `Checkbox` живёт без группы — в шапке и строках
 * `DataTable`, — и импорт карточной ветки отсюда тащил её код в каждый такой
 * бандл (`DataTable` вырос с 5,4 до 5,9 кБ gzip ради кода, который он не
 * показывает). Теперь карточку знает только `CheckboxGroup`: он кладёт её в
 * контекст, а флажок использует лишь то, что пришло.
 *
 * `tone` у набора необязателен, и «не задан» — отдельное значение, а не
 * `accent`: именно оно оставляет флажкам их собственные тона. У `RadioGroup`
 * тон есть всегда, потому что у `Radio` собственного нет.
 */
export const CheckboxGroupStyleContext = createContext<{
  tone?: Tone;
  Card?: CheckboxCardComponent;
}>({});

/** Размеры коробки флажка: общие для обычного вида и для карточки. */
export const CHECKBOX_SIZES: Record<"sm" | "md", { box: string; label: string; icon: number }> = {
  sm: { box: "size-4 rounded-xs", label: "text-xs", icon: 11 },
  md: { box: "size-[18px] rounded-xs", label: "text-[13px]", icon: 13 },
};

/**
 * Флажок.
 *
 * Здесь `checked`, а не `selected` из общего словаря: у флажка есть родное
 * ARIA-понятие (`aria-checked`), и подменять его своим термином — значит
 * расходиться со стандартом. То же решение, что у `Toggle`.
 *
 * Собран на `CheckboxField` + `CheckboxButton`, а НЕ на `Checkbox` из
 * react-aria-components: последний в 1.19 помечен `@deprecated` в пользу этой
 * пары. Первый же компонент волны, построенный на устаревшем экспорте, стал бы
 * долгом миграции на весь пакет.
 *
 * ВИД КОРОБКИ ЗАДАЁТСЯ ЧЕРЕЗ РЕНДЕР-ПРОП, а не вариантами `selected:`/`invalid:`.
 * Причина не стилистическая: коробка — дочерний `span`, а атрибуты состояния
 * (`data-selected`, `data-invalid`) висят на `<label>` снаружи. Достать их
 * оттуда можно было бы только формой `group-selected:`, а её пришлось бы
 * склеивать из префикса и атома тона — ровно то, чего словарь не допускает:
 * Tailwind сканирует исходники как текст, и класс, собранный в рантайме, молча
 * не попадёт в CSS. Рендер-проп отдаёт состояние прямо в JS, и из таблицы
 * берётся готовая литеральная строка.
 *
 * На самой `<label>` состояния, наоборот, заданы вариантами — `hover:` и
 * `disabled:` там срабатывают на RAC-элементе благодаря двойному селектору
 * плагина (см. `styles.css`).
 */
export const Checkbox = forwardRef<HTMLDivElement, CheckboxProps>(function Checkbox(props, ref) {
  const {
    checked,
    defaultChecked,
    indeterminate,
    onCheckedChange,
    children,
    label,
    description,
    icon,
    size = "md",
    tone: ownTone = "accent",
    disabled,
    invalid,
    name,
    value,
    slot,
    className,
  } = props;
  const { tone: groupTone, Card } = useContext(CheckboxGroupStyleContext);
  // Тон набора, если он задан, перекрывает собственный: набор не может разъехаться
  // по виду — правило `RadioGroup`. Не задан — у каждого флажка свой, как и вне группы.
  const tone = groupTone ?? ownTone;
  const t = TONE_TOKENS[tone];
  const s = CHECKBOX_SIZES[size];

  // Все пропы уходят карточке одним объектом, а не перечнем по полям: перечень из
  // семнадцати имён в минифицированном бандле не сжимается (имена свойств
  // остаются) и ложится в каждый `DataTable`, где карточек нет вовсе.
  if (Card) return <Card {...props} ref={ref} tone={tone} />;

  return (
    <CheckboxField
      ref={ref}
      slot={slot}
      isSelected={checked}
      defaultSelected={defaultChecked}
      isIndeterminate={indeterminate}
      onChange={onCheckedChange}
      isDisabled={disabled}
      isInvalid={invalid}
      name={name}
      value={value}
      aria-label={label}
      className={cn("flex flex-col gap-1", className)}
    >
      {/*
        ЗОНА НАЖАТИЯ РАСШИРЕНА ДВУМЯ ПОЛОСКАМИ ВЫШЕ И НИЖЕ КОНТРОЛА.

        Замер на 3.12.0: у флажка `md` без видимой подписи цель 26×22, у `sm`
        с подписью — 20 по высоте. То есть из четырёх сочетаний размера и
        подписи порог WCAG 2.5.8 (24×24) проходило ровно одно — `md` с
        подписью, и то за счёт строчного бокса текста, а не собственной
        геометрии.

        Формально нарушения у потребителя может и не быть: у критерия есть
        исключение Spacing, и строка списка его проходит, когда соседние цели
        достаточно разнесены. Но проходит она РАССТОЯНИЕМ ДО СОСЕДЕЙ, то есть
        тем, чем кит не управляет: поставь рядом ещё один элемент управления —
        и исключение исчезает, а флажок не менялся. Опираться на чужую
        раскладку нельзя, поэтому цель дотянута здесь.

        Псевдоэлементами, а не отступами: отступы подняли бы и высоту в
        раскладке, а её держит строка списка — 32 пикселя, и флажок в неё
        обязан помещаться. В раскладке контрол остаётся прежним, пальцем и
        мышью ловится минимум на 24.

        Две полоски ПО КРАЯМ, а не один слой поверх всего контрола, и это не
        придирка к форме. Слой поверх перехватывал указатель у собственной
        подписи: клик по тексту доходил до метки (псевдоэлемент ей и
        принадлежит), но всё, что проверяет перекрытие — от Playwright до
        выделения текста, — упиралось в него. Увести слой под содержимое
        `-z-10` тоже нельзя: отрицательный слой уходит за фон предка, и
        расширенная зона перестаёт ловить клики вовсе. Проверено обоими
        способами в живом браузере.

        По 2 пикселя с каждой стороны, а не ровно столько, сколько не хватает:
        высота контрола зависит и от размера, и от наличия видимой подписи —
        от 20 до 24. Одна и та же пара полосок доводит любое из них до 24 и
        больше, а вычислять недостачу классом, собранным в рантайме, нельзя:
        Tailwind сканирует исходники как текст.
      */}
      <CheckboxButton
        className={
          "hover:bg-bg-2 relative flex w-fit cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 " +
          "transition-colors disabled:cursor-default disabled:opacity-50 " +
          // `disabled:` ловит только `data-disabled` самой метки, то есть собственный
          // `isDisabled`. Выключенность от `<fieldset disabled>` (так гасит поля
          // `Form` с `pending`) RAC не знает — её видит лишь скрытый `input` внутри.
          "has-disabled:cursor-default has-disabled:opacity-50 " +
          "before:absolute before:inset-x-0 before:bottom-full before:h-0.5 before:content-[''] after:absolute after:inset-x-0 after:top-full after:h-0.5 after:content-['']"
        }
      >
        {({ isSelected, isIndeterminate, isInvalid, isFocusVisible }) => {
          const on = isSelected || isIndeterminate;
          return (
            <>
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center border transition-colors",
                  s.box,
                  // Рамка отмеченной коробки — `STATE_BORDER`, а не цвет по умолчанию
                  // (`currentcolor` = цвет галочки): заливка против подложки не
                  // дотягивает до 3:1, и границу коробки держит рамка.
                  on ? cn(t.solid, STATE_BORDER[tone]) : "border-line bg-bg-2",
                  isInvalid && "border-danger-strong",
                  isFocusVisible && "ring-accent-strong ring-offset-bg-1 ring-2 ring-offset-1"
                )}
              >
                {isIndeterminate ? (
                  <MinusIcon size={s.icon} strokeWidth={3} />
                ) : isSelected ? (
                  <CheckIcon size={s.icon} strokeWidth={3} />
                ) : null}
              </span>
              {hasContent(icon) && (
                <span aria-hidden="true" className="text-fg-2 flex shrink-0">
                  {icon}
                </span>
              )}
              {children != null && <span className={s.label}>{children}</span>}
            </>
          );
        }}
      </CheckboxButton>
      {description != null && (
        <Text slot="description" className="text-fg-3 pl-[26px] text-[11px]">
          {description}
        </Text>
      )}
    </CheckboxField>
  );
});
