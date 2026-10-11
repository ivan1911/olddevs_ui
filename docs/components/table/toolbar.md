---
component: TableToolbar
exports: [TableToolbar, TablePreferences]
category: table
status: stable
source: src/components/table/TableToolbar.tsx, src/components/table/TablePreferences.tsx
story: src/components/table/TableToolbar.stories.tsx
---

# TableToolbar и TablePreferences

## Кратко для AI

`TableToolbar` — полоса над таблицей: заголовок, счётчик, действия, слот
фильтров и слот настроек. `TablePreferences` — содержимое поповера у кнопки-шестерёнки: видимость
и порядок колонок, плотность. Ни один из них состояния не хранит: всё приходит сверху,
обычно из `useTableState`.

## Когда использовать

- Над списком, у которого есть заголовок, счётчик или действия над всем списком (например, экспорт).
- Работает и без `DataTable` — над обычной `Table` тоже.

## Когда не использовать

- Для действий над **выбранными** строками — это `SelectionBar`.
- Для заголовка страницы с описанием — это `PageHeader`.

## Минимальный пример

```tsx
import { Popover, PopoverContent, PopoverTrigger } from "@olddevs/ui";
import { TablePreferences, TableToolbar, useTableState } from "@olddevs/ui";

const { state, set } = useTableState();

<TableToolbar
  title="Документы"
  count={total}
  actions={<Button tone="accent">Загрузить</Button>}
  preferences={
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" iconOnly icon={<SettingsIcon />} aria-label="Настройки" />
      </PopoverTrigger>
      <PopoverContent className="p-3">
        <TablePreferences
          columns={columns}
          hiddenColumns={state.hiddenColumns}
          onHiddenColumnsChange={(hiddenColumns) => set({ hiddenColumns })}
          columnOrder={state.columnOrder}
          onColumnOrderChange={(columnOrder) => set({ columnOrder })}
          density={state.density}
          onDensityChange={(density) => set({ density })}
        />
      </PopoverContent>
    </Popover>
  }
/>;
```

## Решения, которые видно в API

**Роли `toolbar` у полосы нет.** Роль требует навигации по элементам
стрелками, а ARIA сама её не даёт: объявив роль и не
реализовав поведение, кит пообещал бы скринридеру то, чего нет.

**Счётчик — число, а не готовая строка.** Склонение делает каталог по локали;
`countLabel` переопределяет подпись, когда нужно назвать сущность
(«12 документов»). Тот же приём, что у `SelectionBar`.

**`TablePreferences` — панель, а не меню.** Пункт меню не контейнер для кнопок:
вложенные в него кнопки «Выше» и «Ниже» ломают клавиатурную семантику меню, где
стрелки принадлежат самому меню. Контейнер — `Popover`, `Drawer` или `Dialog` —
выбирает потребитель.

**Порядок меняется кнопками, а не перетаскиванием.** Перетаскивание без
клавиатурной альтернативы недоступно вовсе, а альтернатива к нему — эти же
кнопки; заводить оба способа ради одного экрана несоразмерно. Подписи кнопок
называют колонку: иначе в списке из десяти колонок десять кнопок «Выше» и десять «Ниже».

**`PopoverTrigger` требует `asChild`.** Без него Radix рисует свою кнопку вокруг
вашей, получается кнопка в кнопке, и аудит проваливает прогон как `nested-interactive`
— это поймал axe на первой же истории.

**Последнюю видимую колонку скрыть нельзя.** Таблица без колонок — не состояние
интерфейса, а поломка: скрывать станет нечего, и пользователю из неё не
выбраться. Запрет односторонний — скрытую колонку вернуть можно всегда.

## Связанные исходники и проверка

- Реализация: `src/components/table/TableToolbar.tsx`,
  `src/components/table/TablePreferences.tsx`.
- Тесты: `tests/table-toolbar.test.tsx` (слоты, склонение счётчика, отсутствие
  роли `toolbar`), `tests/table-preferences.test.tsx` (запрет на последнюю
  колонку, порядок с клавиатуры, плотность).
- Состояние: [`useTableState`](../../api/utilities.md).
