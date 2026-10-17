"use client";

import { Button } from "@olddevs/ui";
import { useState } from "react";

/** The consumer's client component: state and a handler on top of the kit. */
export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Button variant="outline" onClick={() => setCount(count + 1)}>
      Нажатий: {count}
    </Button>
  );
}
