import { Alert, Button, cn, DEFAULT_TABLE_STATE, tableStateToParams } from "@olddevs/ui";
import { AddIcon } from "@olddevs/ui/icons";
import { Counter } from "./counter";

/**
 * A Server Component. This is where the package's main promise is verified.
 *
 * `Button` is imported right here, without a wrapper with "use client": the
 * directive is carried by the package itself. `cn` and `tableStateToParams` are
 * computed on the server and do not go into the client graph. `Counter` is a
 * client boundary declared by the consumer.
 *
 * `Alert` is here not for completeness but as a probe for a lost directive. It
 * calls `useMessages`, that is `useContext`, right in the body. If the component
 * file loses `"use client"`, the build fails at that spot. `Button` has no hooks,
 * and without the directive it would silently render on the server, so one
 * button is not enough for such a probe.
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
