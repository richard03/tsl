import type { Condition } from "./screen";

export interface ConditionalNext {
  when?: Condition[];
  default?: boolean;
  goto: string;
}

export interface FlowNode {
  screenId: string;
  autoAdvanceMs?: number;
  next: string | ConditionalNext[] | null;
}

/**
 * How a screen is addressed in the URL.
 *
 * `path` gives the nicer `…/csob/00-intro-3`, but the server must serve `index.html` for paths that
 * don't exist on disk (the `.htaccess` rewrite). `query` gives `…/csob/?screen=00-intro-3`, which
 * needs no server configuration at all — use it wherever the rewrite can't be relied on.
 * Both are real URLs with real page loads and real history entries.
 */
export type RoutingMode = "path" | "query";

export interface FlowConfig {
  start: string;
  nodes: FlowNode[];
  routing?: RoutingMode;
}
