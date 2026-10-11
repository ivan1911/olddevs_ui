import { Alert, Button, cn, DEFAULT_TABLE_STATE, tableStateToParams } from "@olddevs/ui";
import { AddIcon } from "@olddevs/ui/icons";
import { Counter } from "./counter";

/**
 * Серверный компонент — здесь и проверяется главное обещание пакета.
 *
 * `Button` импортируется прямо сюда, без обёртки с "use client": директиву
 * несёт сам пакет. `cn` и `tableStateToParams` считаются на сервере и в
 * клиентский граф не уходят. `Counter` — граница клиента, объявленная
 * потребителем.
 *
 * `Alert` стоит здесь не для полноты картины, а как проба на потерю директивы.
 * Он зовёт `useMessages`, то есть `useContext`, прямо в теле — и если файл
 * компонента лишится `"use client"`, сборка упадёт на этом месте. У `Button`
 * хуков нет, и без директивы он молча отрендерился бы на сервере: одной кнопки
 * для такой пробы недостаточно.
 */
export default function Page() {
  const query = tableStateToParams(DEFAULT_TABLE_STATE).toString();

  return (
    <main className={cn("flex flex-col items-start gap-4 p-6")}>
      <p>Параметры таблицы с сервера: {query || "по умолчанию"}</p>
      <Button tone="accent" icon={<AddIcon aria-hidden />}>
        Кнопка из серверного компонента
      </Button>
      <Alert tone="warning" title="Сообщение из серверного компонента">
        Компонент зовёт useMessages: без директивы в пакете сборка упадёт здесь.
      </Alert>
      <Counter />
    </main>
  );
}
