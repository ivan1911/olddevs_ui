---
component: Feedback primitives
exports: [Alert, Banner, Progress, Spinner, Toaster, toast, StatusBadge]
category: actions
status: stable
source: src/components/actions/Alert.tsx
story: src/components/actions/Alert.stories.tsx
---

# Alert, Banner, Progress, Spinner, Toaster, toast и StatusBadge

## Кратко для AI

Выбирайте по типу информации:

- `Alert` — постоянное состояние **места**;
- `Banner` — состояние **приложения**;
- `toast` — краткое завершившееся событие;
- `Progress` — известная доля работы;
- `Spinner` — неизвестное ожидание;
- `StatusBadge` — статус объекта рядом с его именем.

## Когда использовать

- `Alert`: важное состояние на странице, которое не должно исчезнуть само.
- `Banner`: деградация сервиса, работы на сервере, истёкшая подписка — то, что касается всего приложения и переживает навигацию.
- `toast`: «сохранено», «не удалось отправить»; один `Toaster` ставится у корня приложения.
- `Progress`: известен процент/доля; `value={null}` означает неопределённый прогресс.
- `Spinner`: неизвестны и длительность, и будущая форма контента.
- `StatusBadge`: компактный доменный статус, например публикация или канал.

## Когда не использовать

- Не используйте `toast` для постоянной ошибки — это `Alert`.
- Не используйте `Banner` для сообщения об одном блоке страницы — это `Alert`. Граница проходит по месту и времени жизни: `toast` сообщает о событии, `Alert` — о состоянии места, `Banner` — о состоянии приложения.
- Не показывайте `Progress` с нулём, когда величина неизвестна: передайте `null`.
- Не заменяйте `Skeleton` компонентом `Spinner`, когда форма результата известна.
- Не используйте `StatusBadge` как кликабельный фильтр — это `Chip`.

## Минимальный пример

```tsx
<Alert tone="danger" title="Публикация недоступна">Подключите канал.</Alert>
<Progress label="Загрузка файлов" value={64} showValue />
<StatusBadge tone="success">Опубликовано</StatusBadge>

// Рядом с app root:
<Toaster />
// В обработчике:
toast.success("Сохранено");
```

## Public API

- `Alert`: `tone`, `variant` (`soft`/`outline`), `title`, `icon`, `action`, `onDismiss`, `closeLabel`; `danger` получает `role="alert"`, остальные тона — `role="status"`.
- `Banner`: `tone`, `title`, `icon`, `action`, `onDismiss`, `closeLabel`. Вида (`variant`) нет — баннер всегда полоса во всю ширину без скруглений. Роль по тону та же, что у `Alert`. Стопка — это просто соседние баннеры: очереди у компонента нет.
- `Progress`: обязательный `label`, `value: number | null`, `showValue`; `null` не выставляет `aria-valuenow`.
- `Spinner`: `size`, `tone`, `label` (из каталога сообщений: «Загрузка» с `@olddevs/ui/locales/ru`, «Loading» без провайдера) и `role="status"`.
- `Toaster`: `position`, `duration` (по умолчанию 4000 мс), `theme`, `offsetVar`. `offsetVar` — имя переменной с высотой нижней панели, по умолчанию `--bottombar-h`. У нижнего края тосты встают над `MobileTabBar` в слоте `bottomBar` у `AppShell`, а не под ним; если панели нет, отступ прежний. У `toast` только `success`, `error`, `warning`, `info`, `promise`, `dismiss`.
- **У `toast` четыре тона, и сверх них ничего нет.** `toast.custom` и тост с произвольной раскладкой, которые есть у `sonner`, в кит не входят намеренно: тост, умеющий всё, перестаёт быть частью системы, и через полгода в приложении оказывается пять разных тостов. Тон, вид и раскладка принадлежат киту, а не месту вызова; вызывающий задаёт только содержимое — сообщение, `description` (вторая строка), `duration` и одно `action` с подписью и обработчиком. Нужно больше — это `Alert` или диалог. Разбор ошибки сервера кит не делает: текст для `description` готовит вызывающий, например `toast.error("Не удалось сохранить", { description: extractErrorMessage(error) })`.
- `StatusBadge`: неинтерактивный `span` с `tone`, `size`, необязательной точкой статуса; используйте понятную текстовую подпись.

## Доступность и семантика

- Тон `danger` у `Alert` и `Banner` прерывает речь скринридера; не ставьте его для обычного успеха.
- `Banner` не липкий, и шапка под ним остаётся на `top: 0`: контракт `--topbar-h` (ADR-0016) не трогается. Разбор — ADR-0027.
- У `Progress` и `Spinner` имя обязательно или имеет осмысленное умолчание.
- Источники: `src/components/actions/Alert.tsx`, `src/components/actions/Progress.tsx`, `src/components/actions/Spinner.tsx`, `src/components/actions/Toaster.tsx`, `src/components/actions/StatusBadge.tsx`; истории этих же компонентов.
