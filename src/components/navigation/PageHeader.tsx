"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface PageHeaderProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Page title. A `ReactNode`: in frontend code, markup with an icon goes here. */
  title: ReactNode;
  /** Explanation under the title. */
  subtitle?: ReactNode;
  /** Buttons on the right; on narrow screens they wrap under the title. */
  actions?: ReactNode;
}

/**
 * Page header: the title, the description and the actions.
 *
 * It has no size and never will: there is one page, so a second size has nowhere to come from. Adding a
 * `size` "for later" is exactly what this package avoids.
 */
export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader(
  { title, subtitle, actions, className, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className
      )}
      {...rest}
    >
      <div>
        <h1 className="m-0 text-[26px] font-bold tracking-tight">{title}</h1>
        {subtitle && <div className="text-fg-2 mt-1.5 text-[13px]">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
});
