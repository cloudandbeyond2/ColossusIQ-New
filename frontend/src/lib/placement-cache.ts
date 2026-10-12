import type { QueryClient } from "@tanstack/react-query";

/*
 * Every placement screen is built from the same two sources, the readiness board and the placement drives. Saving or
 * deleting a drive changes all of them, so the screens that show it are refreshed together.
 */
export const PLACEMENT_KEYS = {
  drives: ["drives"],
  board: ["placement-board"],
  analytics: ["module", "placement-analytics"],
  home: ["home", "placement"],
} as const;

/** Modules whose numbers move while the page is open (new quiz attempts, drive updates), so they re-check on their own. */
export const LIVE_MODULES: ReadonlySet<string> = new Set(["placement-analytics"]);

export const LIVE_REFRESH_MS = 30_000;

export function refreshPlacement(qc: QueryClient): void {
  for (const queryKey of Object.values(PLACEMENT_KEYS)) void qc.invalidateQueries({ queryKey });
}
