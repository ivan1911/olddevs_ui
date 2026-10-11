"use client";

import { Button } from "@olddevs/ui";
import { useState } from "react";

/** Клиентский компонент потребителя: состояние и обработчик поверх кита. */
export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Button variant="outline" onClick={() => setCount(count + 1)}>
      Нажатий: {count}
    </Button>
  );
}
