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

/**
 * `data.*` fields each get their own localStorage key (`prototyper.<project>.data.<field>`) instead
 * of being bundled into one JSON blob under a single key — a single answer is then visible and
 * editable on its own in devtools, instead of requiring the whole blob to be parsed by hand.
 */
const DATA_KEY_PREFIX = `${PREFIX}data.`;

const KEYS = {
  respondent: `${PREFIX}respondent`,
  currentScreenId: `${PREFIX}currentScreenId`,
  /**
   * Keys from before prototypes were namespaced, plus the pre-per-field `.data` blob. Never written
   * any more and no longer read, but still cleared, so ending a test tidies up after a session that
   * started on an older build.
   */
  legacy: [
    `${PREFIX}data`,
    "prototyper.respondent",
    "prototyper.data",
    "prototyper.answers",
    "prototyper.currentScreenId",
    "prototyper.history",
  ],
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

/** All localStorage keys currently holding a `data.*` field for this project. */
function dataKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DATA_KEY_PREFIX)) keys.push(key);
  }
  return keys;
}

/** Loads flow session data, one field per localStorage key. */
export function loadData(): Data {
  const out: Data = {};
  for (const key of dataKeys()) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      out[key.slice(DATA_KEY_PREFIX.length)] = JSON.parse(raw) as unknown;
    } catch {
      // A hand-edited or corrupted entry — skip it rather than fail the whole load.
    }
  }
  return out;
}

/**
 * Persists flow session data to localStorage, one key per field. Removes any existing field key
 * that's no longer present in `data` first, so a field that's gone doesn't linger in storage and
 * leak into a later run.
 */
export function saveData(data: Data): void {
  const wanted = new Set(Object.keys(data).map((field) => DATA_KEY_PREFIX + field));
  for (const key of dataKeys()) {
    if (!wanted.has(key)) localStorage.removeItem(key);
  }
  for (const [field, value] of Object.entries(data)) {
    localStorage.setItem(DATA_KEY_PREFIX + field, JSON.stringify(value));
  }
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
  for (const key of dataKeys()) localStorage.removeItem(key);
  localStorage.removeItem(KEYS.currentScreenId);
}

/** Clears respondent, session data, and navigation position — plus anything an older build left behind. */
export function clearAll(): void {
  localStorage.removeItem(KEYS.respondent);
  clearDataAndPosition();
  for (const key of KEYS.legacy) localStorage.removeItem(key);
}
