// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Button } from "../src/components/actions/Button.js";
import { DragHandleIcon } from "../src/icons.js";

afterEach(cleanup);

/*
  ИКОНКА ВНУТРИ КНОПКИ НЕ ДОЛЖНА БЫТЬ ОТДЕЛЬНОЙ ЦЕЛЬЮ ПОПАДАНИЯ.

  jsdom событий попадания не моделирует, поэтому здесь проверяется правило, а
  не поведение: сторож против того, чтобы класс сняли как «мёртвый». Живой
  дефект, ради которого правило заведено, воспроизводился на строке
  `EditableList` с действием — щелчок в рисунок иконки давал и кнопку, и
  действие строки, потому что `event.target` был `<svg>`, а react-aria
  проверяет цель щелчка, не обходя предков.
*/
test("the icon inside a button is not a hit target of its own", () => {
  render(<Button icon={<DragHandleIcon size={12} />} iconOnly aria-label="Drag" />);

  expect(screen.getByRole("button", { name: "Drag" }).className).toContain(
    "[&_svg]:pointer-events-none"
  );
});
