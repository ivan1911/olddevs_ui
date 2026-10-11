---
component: FileDropzone
exports: [FileDropzone]
category: inputs
status: stable
source: src/components/inputs/FileDropzone.tsx
story: src/components/inputs/FileDropzone.stories.tsx
---

# FileDropzone

## Кратко для AI

`FileDropzone` принимает файлы через drag-and-drop или кнопку выбора. Он проверяет тип и размер, не принимает больше одного файла при `multiple={false}`, показывает причины отказа и возвращает принятые `File[]` потребителю.

## Когда использовать

- Нужна доступная область загрузки с поддержкой мыши и клавиатуры.
- Нужны клиентские ограничения `accept`, `maxSize`, `multiple` и объяснение отказов.

## Когда не использовать

- Не показывайте в области состояние загрузки уже выбранных файлов — это `UploadQueue`. Область даёт файлы, очередь показывает, что с ними стало.
- Не считайте `FileDropzone` реализацией загрузки: сеть, прогресс, повторные попытки и серверная проверка остаются у потребителя.
- Для единственного простого file input без зоны перетаскивания достаточно нативного `<input type="file">`.

## Минимальный пример

```tsx
<FileDropzone
  accept="image/*"
  maxSize={10 * 1024 * 1024}
  onFiles={enqueueFiles}
  onReject={showRejected}
  hint="PNG или JPEG до 10 МБ"
/>
```

## Public API

- `onFiles` обязателен и получает только принятые файлы; `onReject` получает `{ name, reason }[]`.
- `accept` использует синтаксис input accept (`image/*`, `.jpg,.png`), `multiple` по умолчанию true, `maxSize` — байты.
- `label` формирует доступное имя DropZone; `hint` задаёт пояснение под подписью, `disabled` выключает область, `className` меняет вид корневого элемента.
- Папки, неподходящий тип, слишком большой файл и лишние файлы при `multiple={false}` получают причину отказа.

## Доступность и форма

- Не убирайте кнопку «Выбрать файлы»: по ней выбирают файлы с клавиатуры.
- Отказ выводится в живой области `role="alert"`; не отбрасывайте файлы молча.
- См. `src/components/inputs/FileDropzone.tsx`, `src/components/inputs/FileDropzone.stories.tsx`, `tests/file-dropzone.test.tsx`.
