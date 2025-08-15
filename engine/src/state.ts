/**
 * Name of this prototype, from `<meta name="prototyper-project">` in `index.html`.
 *
 * localStorage is shared by everything on one origin, so two prototypes served from the same host
 * and port — typically two dev servers that reused a port — would otherwise share one respondent,
 * one set of answers and one screen position. That shows up as one prototype inexplicably starting
 * in the middle of the other's flow, which is confusing enough to be worth a namespace.
 *
 * Read once at module load: the keys are needed synchronously, before any config has been fetched.
 */
function projectNamespace(): string {
  const name = document.querySelector('meta[name="prototyper-project"]')?.getAttribute("content")?.trim();
  return name || "default";
}

const PREFIX = `prototyper.${projectNamespace()}.`;

const KEYS = {
  respondent: `${PREFIX}respondent`,
  data: `${PREFIX}data`,
  currentScreenId: `${PREFIX}currentScreenId`,
  /**
   * Keys from before prototypes were namespaced. Never written any more and no longer read — a
   * shared key is exactly what this change removes — but still cleared, so ending a test tidies up
   * after a session that started on an older build.
   */
  legacy: ["prototyper.respondent", "prototyper.data", "prototyper.answers", "prototyper.currentScreenId", "prototyper.history"],
} as const;

/** Session data written by fields and `setData` actions (bound in YAML via the `data.*` namespace). */
export type Data = Record<string, unknown>;

/** Loads opaque respondent context from localStorage. */
export function loadRespondent(): unknown {
  const raw = localStorage.getItem(KEYS.respondent);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Persists opaque respondent context to localStorage. */
export function saveRespondent(respondent: unknown): void {
  localStorage.setItem(KEYS.respondent, JSON.stringify(respondent));
}

/** Loads flow session data. */
export function loadData(): Data {
  const raw = localStorage.getItem(KEYS.data);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Data;
  } catch {
    return {};
  }
}

/** Persists flow session data to localStorage. */
export function saveData(data: Data): void {
  localStorage.setItem(KEYS.data, JSON.stringify(data));
}

/** Loads the current screen id from localStorage. */
export function loadCurrentScreenId(): string | null {
  return localStorage.getItem(KEYS.currentScreenId);
}

/** Persists the current screen id to localStorage. */
export function saveCurrentScreenId(screenId: string): void {
  localStorage.setItem(KEYS.currentScreenId, screenId);
}

/** Clears session data and navigation position (keeps the respondent). */
export function clearDataAndPosition(): void {
  localStorage.removeItem(KEYS.data);
  localStorage.removeItem(KEYS.currentScreenId);
}

/** Clears respondent, session data, and navigation position — plus anything an older build left behind. */
export function clearAll(): void {
  localStorage.removeItem(KEYS.respondent);
  clearDataAndPosition();
  for (const key of KEYS.legacy) localStorage.removeItem(key);
}
