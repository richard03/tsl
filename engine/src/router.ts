/**
 * Maps screens onto real URLs and navigates between them with genuine page loads.
 *
 * A single-page app changes screens without the browser ever navigating, which analytics and
 * usability-testing tools that measure per-page interactions cannot see. Doing real loads costs a
 * round trip per screen but makes every screen change a first-class navigation: a real history
 * entry, a working back button, and a page view every tool understands.
 *
 * Session state survives because it lives in `localStorage`, not in memory.
 *
 * Two URL shapes, chosen by `routing` in `flow.yaml`:
 *  - `path`  → `…/csob/00-intro-3` — needs the `.htaccess` rewrite, since that path isn't a real file.
 *  - `query` → `…/csob/?screen=00-intro-3` — works on any static host with no configuration.
 */
import type { RoutingMode } from "./types/flow";

/** Query parameter naming the screen in `query` mode. */
const SCREEN_PARAM = "screen";

/**
 * Marks the moderator's setup page. Screen changes are real page loads now, so "show setup" can't
 * live in memory — after the reload the mode is re-derived, and a stored respondent would send the
 * moderator straight back into the flow. It doubles as a stable address for opening setup any time.
 */
const SETUP_PARAM = "setup";

/** The last path segment of the current URL, or "" for a directory-style URL. */
function lastSegment(): string {
  const parts = window.location.pathname.split("/");
  return decodeURIComponent(parts[parts.length - 1]);
}

/**
 * The screen the current URL points at, or null when the URL addresses the app itself
 * (`…/`, `…/index.html`) rather than a screen.
 *
 * Both shapes are always recognised, whichever mode is configured, so switching `routing` doesn't
 * strand a respondent who already has a link in the other form.
 */
export function screenIdFromUrl(knownScreenIds: Set<string>): string | null {
  const fromQuery = new URLSearchParams(window.location.search).get(SCREEN_PARAM);
  if (fromQuery && knownScreenIds.has(fromQuery)) return fromQuery;
  const segment = lastSegment();
  return knownScreenIds.has(segment) ? segment : null;
}

/** The directory the app is served from, with any screen segment stripped. Always ends in "/". */
function appDirectory(knownScreenIds: Set<string>): string {
  const parts = window.location.pathname.split("/");
  const last = decodeURIComponent(parts[parts.length - 1]);
  if (last === "" || last.endsWith(".html") || knownScreenIds.has(last)) {
    parts[parts.length - 1] = "";
  } else {
    parts.push("");
  }
  return parts.join("/");
}

/** Query string carried across navigations, minus the parameters the router owns. */
function preservedSearch(): URLSearchParams {
  const params = new URLSearchParams(window.location.search);
  params.delete(SCREEN_PARAM);
  params.delete(SETUP_PARAM);
  return params;
}

/** Whether the current URL asks for the moderator's setup page. */
export function isSetupRequested(): boolean {
  return new URLSearchParams(window.location.search).has(SETUP_PARAM);
}

/** URL of the moderator's setup page — where a run is configured, restarted or ended. */
export function setupUrl(knownScreenIds: Set<string>): string {
  const params = preservedSearch();
  params.set(SETUP_PARAM, "1");
  return `${appDirectory(knownScreenIds)}?${params.toString()}`;
}

/** Drops the setup marker once a run starts, so the address bar reflects the flow instead. */
export function clearSetupFromUrl(): void {
  if (!isSetupRequested()) return;
  const url = new URL(window.location.href);
  url.searchParams.delete(SETUP_PARAM);
  window.history.replaceState(null, "", url.toString());
}

/**
 * Full URL for `screenId`, derived from where the app is currently served — so it works at the
 * domain root, in a subdirectory, and whether or not the current URL already names a screen.
 */
export function screenUrl(screenId: string, knownScreenIds: Set<string>, mode: RoutingMode): string {
  const dir = appDirectory(knownScreenIds);
  const params = preservedSearch();

  if (mode === "query") {
    params.set(SCREEN_PARAM, screenId);
    return `${dir}?${params.toString()}`;
  }
  const search = params.toString();
  return `${dir}${encodeURIComponent(screenId)}${search ? `?${search}` : ""}`;
}

/** URL of the app itself, with the screen dropped (used when a run ends). */
export function appUrl(knownScreenIds: Set<string>): string {
  const search = preservedSearch().toString();
  return `${appDirectory(knownScreenIds)}${search ? `?${search}` : ""}`;
}

/** Navigates to a screen with a real page load, adding a history entry. */
export function navigateToScreen(screenId: string, knownScreenIds: Set<string>, mode: RoutingMode): void {
  window.location.assign(screenUrl(screenId, knownScreenIds, mode));
}

/** Points the address bar at `screenId` without navigating — for the screen already on display. */
export function replaceUrlWithScreen(screenId: string, knownScreenIds: Set<string>, mode: RoutingMode): void {
  const url = screenUrl(screenId, knownScreenIds, mode);
  if (url !== window.location.pathname + window.location.search) {
    window.history.replaceState(null, "", url);
  }
}
