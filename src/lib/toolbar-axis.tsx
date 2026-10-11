"use client";

import type { ComponentType } from "react";
import { SeparatorContext, ToggleButtonGroupContext } from "react-aria-components";

/**
 * Портал оверлея, через который ось `Toolbar` не проходит.
 *
 * `Toolbar` раздаёт ось через контексты react-aria (`SeparatorContext`,
 * `ToggleButtonGroupContext`), а контекст React идёт сквозь порталы: поповер или
 * окно, открытые из панели, лежат в DOM вне её, но в дереве React — внутри.
 * Без границы `ToggleGroup` в поповере из вертикальной панели вставал столбцом
 * и менял свои стрелки на вертикальные, а `Separator` в окне из горизонтальной
 * становился вертикальной чертой. Панель `Menu` react-aria обнуляет
 * `SeparatorContext` сама; оверлеи кита делают то же для обоих контекстов.
 *
 * Граница — СНАРУЖИ портала, а не внутри: Radix клонирует потомка портала с
 * `ref` (`Presence`, `asChild`), и обёртка на этом месте съела бы ссылку.
 */
export function withoutToolbarAxis<P extends object>(Portal: ComponentType<P>) {
  function AxisBoundaryPortal(props: P) {
    return (
      <ToggleButtonGroupContext.Provider value={null}>
        <SeparatorContext.Provider value={null}>
          <Portal {...props} />
        </SeparatorContext.Provider>
      </ToggleButtonGroupContext.Provider>
    );
  }
  return AxisBoundaryPortal;
}
