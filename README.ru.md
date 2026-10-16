# <img src="https://ivan1911.github.io/olddevs_ui/logo.svg" alt="" width="44" height="56" align="absmiddle"> @olddevs/ui

[English](README.md) · Русский

[![npm version](https://img.shields.io/npm/v/@olddevs/ui)](https://www.npmjs.com/package/@olddevs/ui)
[![license](https://img.shields.io/npm/l/@olddevs/ui)](LICENSE)

Olddevs UI — дизайн-система для React: токены, темы и доступные компоненты для админок и других продуктов с большим объёмом данных. Поведение берётся из [React Aria Components](https://react-aria.adobe.com/) и [Radix UI](https://www.radix-ui.com/), оформление — на [Tailwind CSS](https://tailwindcss.com/) 4. Классы компонентов компилирует Tailwind вашего приложения.

Документация: **[ui.olddevs.ru](https://ui.olddevs.ru)** · Витрина: **[Storybook](https://ivan1911.github.io/olddevs_ui/)**

## Требования

- React 19
- Tailwind CSS 4, уже подключённый в приложении

## Установка

```bash
npm install @olddevs/ui react
```

React — единственная peer-зависимость: его версию выбирает приложение. Остальное кит
приносит сам, и в `package.json` приложения эти пакеты держать не нужно:

| Пакет                                                                      | Для чего                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `react-aria-components`                                                    | Поведение и доступность большинства контролов                  |
| `@radix-ui/react-dialog`, `-popover`, `-tooltip`, `-context-menu`, `-slot` | Окна, панели, поповеры, подсказки, контекстные меню, `asChild` |
| `lucide-react`                                                             | Набор иконок за `@olddevs/ui/icons`                            |
| `sonner`                                                                   | `Toaster` и `toast`                                            |
| `clsx`, `tailwind-merge`                                                   | Сборка классов                                                 |
| `@internationalized/date`                                                  | Типы компонентов даты и времени                                |

Движка Редактора (Tiptap) в списке нет: его ставит только приложение, которое импортирует `@olddevs/ui/editor`. Команда — на [странице Редактора](docs/components/inputs/rich-text-editor.md#установка).

## Подключение стилей

В CSS приложения нужны все три строки:

```css
@import "tailwindcss";
@import "@olddevs/ui/styles.css";
@source "./node_modules/@olddevs/ui/dist";
```

`@import "tailwindcss"` принадлежит приложению, а не пакету: не импортируйте Tailwind второй раз. `@source` обязателен. Tailwind 4 сам не сканирует `node_modules`, поэтому без этой строки сборка проходит, но классов компонентов в итоговом CSS нет.

Если Редактор не используется, добавьте четвёртую строку, чтобы его классы не попали в CSS:

```css
@source not "./node_modules/@olddevs/ui/dist/editor";
```

В приложении Next.js (App Router) добавьте в `next.config.mjs` ещё и это: иначе импорт одной `Button` тянет в клиентский бандл весь кит.

```js
export default { experimental: { optimizePackageImports: ["@olddevs/ui"] } };
```

Подробности — в [docs/getting-started.md](docs/getting-started.md).

## Использование

Компоненты импортируются из корня пакета, иконки — из `@olddevs/ui/icons`. Используйте только публичные входы из `exports` в `package.json` и [словаре](docs/glossary.md); из `src/` не импортируйте.

```tsx
import { useState } from "react";
import { Button, Form, FormField, Select, TextControl, type SelectId } from "@olddevs/ui";

export function CreateProject() {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<SelectId | null>(null);

  return (
    <Form onSubmit={() => save({ name, status })}>
      <FormField label="Название" htmlFor="name" required>
        <TextControl id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <Select
        aria-label="Статус"
        placeholder="Статус"
        items={[
          { id: "draft", label: "Черновик" },
          { id: "live", label: "Опубликован" },
        ]}
        value={status}
        onChange={setStatus}
        clearable
      />
      <Button type="submit" tone="accent" variant="solid">
        Создать
      </Button>
    </Form>
  );
}
```

Внешний вид во всём ките задают три общие оси: `size` (`sm`, `md`, `lg`), `tone` (`neutral`, `accent`, `success`, `warning`, `danger`) и `variant` (`solid`, `soft`, `outline`, `ghost`).

### Тема и язык

Тема — атрибут на `<html>`: `data-theme` принимает `dark` (по умолчанию), `light` или `dim`, `data-accent` — `blue` (по умолчанию) или `violet`.

```html
<html data-theme="light" data-accent="violet"></html>
```

Язык интерфейса по умолчанию — английский. Русские подписи подключаются одним провайдером:

```tsx
import { UiProvider } from "@olddevs/ui";
import ru from "@olddevs/ui/locales/ru";

<UiProvider locale="ru-RU" messages={ru}>
  <App />
</UiProvider>;
```

См. [«Темы, токены и бренды»](docs/theming.md) и [«Локализацию»](docs/i18n.md).

## Документация

- [ui.olddevs.ru](https://ui.olddevs.ru) — сайт документации
- [Storybook](https://ivan1911.github.io/olddevs_ui/) — витрина: истории каждого компонента во всех темах, собранные из последнего выпуска
- [docs/index.md](docs/index.md) — Справочник: страница на каждый компонент с разделами «Когда использовать» и «Когда не использовать»
- [docs/components/index.md](docs/components/index.md) — каталог компонентов
- [docs/accessibility.md](docs/accessibility.md) — контракт доступности

Справочник написан по-русски; у большинства страниц рядом лежит английский перевод `*.en.md`.

Вместе с пакетом едут `docs/` и указатель `llms.txt`, поэтому Справочник нужной версии лежит в `node_modules/@olddevs/ui/`. Направьте ИИ-ассистента по коду на `llms.txt`.

## Участие и поддержка

- [CONTRIBUTING.md](CONTRIBUTING.md) — как предложить и внести изменение
- [SECURITY.md](SECURITY.md) — как сообщить об уязвимости
- [CHANGELOG.md](CHANGELOG.md) — история выпусков
- [Issues](https://github.com/ivan1911/olddevs_ui/issues) — ошибки и идеи
- [Discussions](https://github.com/ivan1911/olddevs_ui/discussions) — вопросы

## Лицензия

[MIT](LICENSE)
