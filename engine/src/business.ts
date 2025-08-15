import { load } from "js-yaml";

/**
 * Loads a project's business rules from `public/business.js` at runtime.
 *
 * The point is the same one that drove the flow, the screens, the component library and the
 * translations into `public/`: a rule that changes — a rate, a rounding, which loans count towards a
 * threshold — should be a file upload, not a rebuild. Keeping every rule in one documented file also
 * means there is a single place to point at when someone asks "where is this decided".
 *
 * The file is a plain ES module. Everything it exports becomes available to HTML components as
 * `lib.<name>`, alongside the engine's own helpers.
 */

/** Everything `business.js` exports, keyed by export name. */
export type BusinessRules = Record<string, unknown>;

/**
 * Runs the file as a real ES module via a blob URL.
 *
 * Same technique as the HTML component library, and it carries the same two consequences: relative
 * `import` can't resolve from inside (so a rule file has to stand alone), and a fresh blob per load
 * means the browser's module cache can never serve a stale copy after an upload.
 */
async function runModule(code: string, path: string): Promise<BusinessRules> {
  // `sourceURL` is what makes stack traces and DevTools show the real file instead of `blob:...`.
  const url = URL.createObjectURL(new Blob([`${code}\n//# sourceURL=${path}`], { type: "text/javascript" }));
  try {
    return (await import(/* @vite-ignore */ url)) as BusinessRules;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Fetches and evaluates `public/business.js`.
 *
 * A project without business rules is legitimate, so a missing file resolves to `{}`. A file that
 * exists but throws is not — that's a mistake the moderator must see rather than discover as
 * mysteriously absent behaviour halfway through a test.
 */
export async function loadBusinessRules(
  base: string,
  fetchText: (url: string) => Promise<string>,
): Promise<BusinessRules> {
  const path = "business.js";
  let code: string;
  try {
    code = await fetchText(`${base}${path}`);
  } catch {
    return {};
  }
  // A dev server's SPA fallback answers a missing file with index.html and status 200; evaluating
  // that would fail with a baffling syntax error instead of "there are no business rules".
  if (/^\s*<(!doctype|html)/i.test(code)) return {};

  const mod = await runModule(code, path);
  // `default` is not part of the contract — named exports are what make the file readable as a list
  // of rules — but ignoring it silently would hide a mistake, so it is merged in too.
  const { default: fallback, ...named } = mod as BusinessRules & { default?: BusinessRules };
  return { ...(typeof fallback === "object" && fallback !== null ? fallback : {}), ...named };
}

/**
 * Fetches and parses a YAML data file from `public/`, e.g. a lookup table a project keeps out of
 * `business.js` because it's reference data rather than a rule.
 *
 * Lives here rather than in `business.js` because that file is a standalone module and can't import
 * a YAML parser — and hand-rolling one there would be a fragile way to read editable config.
 */
export async function loadDataFile(path: string): Promise<unknown> {
  // Cesta se skládá proti adrese, ze které prototyp běží — stejně jako `{{base}}` v šablonách.
  // Relativní `fetch` by se řešil proti adrese aktuální obrazovky, takže by stačilo změnit podobu
  // URL a soubor by se začal hledat jinde.
  const url = /^([a-z]+:)?\/\//i.test(path) ? path : `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return load(await res.text());
}
