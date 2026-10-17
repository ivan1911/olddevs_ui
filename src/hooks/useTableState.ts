"use client";

import { useCallback, useMemo, useState } from "react";
import { useUiConfig } from "../i18n/useMessages.js";
import { DEFAULT_TABLE_STATE, type TableState } from "../lib/table-state.js";

export interface TableStateApi {
  state: TableState;
  /**
   * Changes part of the state. One updater rather than ten named handlers: the invariants
   * below have to hold no matter which field was changed, and spread across ten functions
   * they would drift apart.
   */
  set: (patch: Partial<TableState>) => void;
  /** Restores the entire initial state. */
  reset: () => void;
}

/**
 * Table state: the shape of the table and the links between its parts.
 *
 * The hook **stores nothing outside React** and subscribes to nothing: neither to the router
 * nor to storage. The kit describes the shape, and the consumer owns it (ADR-0023). Moving it
 * into the address is done with `tableStateToParams` / `tableStateFromParams`; applying them
 * to the address is also the application's job.
 *
 * INVARIANTS, the reason this hook exists at all:
 *
 * - changing the filters, the sorting or the PAGE SIZE **resets the page to the first one**.
 *   Otherwise the user lands on page four of ten filtered rows, sees an empty table, and
 *   takes it for "nothing found";
 * - the selection is **not reset** in that case. The opposite looks tidier, but it breaks a
 *   bulk action exactly when that action is needed most: the user ticks rows, turns the page,
 *   and loses everything.
 *
 * The initial density is taken from `UiProvider` unless it is set explicitly: an admin screen
 * with five tables declares it once.
 */
export function useTableState(initial: Partial<TableState> = {}): TableStateApi {
  const { density: providerDensity } = useUiConfig();

  const start = useMemo<TableState>(
    () => ({ ...DEFAULT_TABLE_STATE, density: providerDensity, ...initial }),
    // The initial value is the initial value: rebuilding it on every prop change would
    // reset the user's state underneath.
    []
  );

  const [state, setState] = useState<TableState>(start);

  const set = useCallback((patch: Partial<TableState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };

      // Only a change of the filtered rows resets the page, not every change: changing the
      // density or the column visibility leaves the user where they were.
      const narrowed =
        ("filters" in patch && patch.filters !== prev.filters) ||
        ("sort" in patch && patch.sort !== prev.sort) ||
        // `pageSize` changes the NUMBER OF PAGES directly, and without it the invariant held
        // only halfway: 200 rows, size 25 → 100 from page 8 gives `slice(700, 800)`, which is
        // empty, so the table draws "nothing found". This does not fix itself: `Pagination`
        // clamps the page only on its own side and keeps highlighting "2" while the table is empty.
        ("pageSize" in patch && patch.pageSize !== prev.pageSize);

      if (narrowed && !("page" in patch)) next.page = 1;
      return next;
    });
  }, []);

  const reset = useCallback(() => setState(start), [start]);

  return { state, set, reset };
}
