/**
 * Loads the runtime component library: HTML component files fetched, parsed, compiled and registered
 * at page load, with no build step. Dropping a new `.html` file next to a manifest entry is all it
 * takes to add or change a component on a plain FTP host.
 *
 * Components and widgets are listed in separate manifests — `components.yaml` and `widgets.yaml` —
 * mirroring the two directories they live in. Which manifest a name appears in is what makes it a
 * widget (referenced as `Widget <Type> <id>` in screen YAML).
 */
import { load } from "js-yaml";
import type { ComponentType } from "react";
import type { ComponentRegistry, RegistryEntry } from "../registry";
import { compileTemplate, isKnownHtmlTag, type ResolveComponent } from "./compileTemplate";
import { parseComponentFile } from "./parseComponentFile";
import { createComponent, createErrorComponent, type ComponentDefinition } from "./createComponent";

export interface LoadOptions {
  /** Base URL everything is resolved against (`import.meta.env.BASE_URL`). */
  base: string;
  /** Domain helpers exposed to component scripts/templates as `lib` — see the note on imports below. */
  lib: Record<string, unknown>;
  /** Fetches a text resource, bypassing the cache. */
  fetchText: (url: string) => Promise<string>;
  /**
   * The bundled registry. HTML templates may use `<SomeComponent>` for components that haven't been
   * migrated yet — without this they could only reference each other, which would make it impossible
   * to migrate anything that composes a still-bundled component.
   */
  baseRegistry?: ComponentRegistry;
}

/**
 * Runs a component's `<script>` as a real ES module.
 *
 * A blob URL is the only way to get `export default` (and module-level consts/helpers) without a
 * build step. Two consequences worth knowing:
 *  - Relative `import` inside such a module can't resolve — that's why domain helpers arrive via
 *    `lib` instead, rather than being duplicated into `public/`.
 *  - A fresh blob per load means the module cache can never serve a stale component after an upload.
 */
async function runScript(code: string, name: string, path: string): Promise<ComponentDefinition> {
  // `sourceURL` is what makes stack traces and DevTools show the real file instead of `blob:...`.
  const source = `${code}\n//# sourceURL=${path}`;
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    const mod = (await import(/* @vite-ignore */ url)) as { default?: ComponentDefinition };
    const def = mod.default;
    if (def && typeof def !== "object") {
      throw new Error(`${name}: <script> musí exportovat objekt (export default { ... }).`);
    }
    return def ?? {};
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Fetches with one retry on a *network-level* failure (dropped connection, flaky wifi during a test
 * session). HTTP errors like 404 are a config mistake, not a blip, so they fail straight away.
 */
async function fetchWithRetry(fetchText: LoadOptions["fetchText"], url: string): Promise<string> {
  try {
    return await fetchText(url);
  } catch (e) {
    if (e instanceof Error && /HTTP \d/.test(e.message)) throw e;
    return fetchText(url);
  }
}

/** Rejects effect specs without a `watch`, which would otherwise loop forever at runtime. */
function validateDefinition(def: ComponentDefinition, name: string): void {
  for (const [key, list] of [
    ["effects", def.effects],
    ["layoutEffects", def.layoutEffects],
  ] as const) {
    if (list === undefined) continue;
    if (!Array.isArray(list)) throw new Error(`${name}: "${key}" musí být pole.`);
    list.forEach((spec, i) => {
      if (typeof spec?.run !== "function") throw new Error(`${name}: ${key}[${i}] nemá funkci "run".`);
      if (typeof spec?.watch !== "function") {
        throw new Error(
          `${name}: ${key}[${i}] nemá povinný "watch" — bez seznamu závislostí by se efekt spouštěl donekonečna.`,
        );
      }
    });
  }
}

/**
 * Appends (or replaces) a component's `<style>` block in the document head.
 *
 * The block is assigned to the `components` cascade layer. Without that it would land after every
 * stylesheet the page links — it is injected at load time, so it is always last — and silently
 * outrank all of them, including the project's own screen styles. Inside a layer, position stops
 * mattering and the order declared in the project's entry stylesheet decides.
 */
function injectStyle(name: string, css: string): void {
  if (!css.trim()) return;
  const id = `html-component-${name}`;
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    el.dataset.htmlComponent = name;
    document.head.appendChild(el);
  }
  el.textContent = `@layer components {\n${css}\n}`;
}

/**
 * One list item of a manifest is either a bare name (`- Nazev`) or a single-key mapping whose key
 * is the name (`- Nazev:` with a nested value) — the mapping form lets a project document a
 * component's attributes (type, default) right next to its registration, for readers who don't
 * want to open the `.html` file just to see its shape. The nested value itself is never read by
 * the engine; it's pure documentation.
 */
function manifestEntryName(item: unknown): string | undefined {
  if (typeof item === "string") return item;
  if (item !== null && typeof item === "object" && !Array.isArray(item)) {
    const keys = Object.keys(item as Record<string, unknown>);
    if (keys.length === 1) return keys[0];
  }
  return undefined;
}

/**
 * Reads one manifest — a YAML list of component names (see `manifestEntryName` for the two shapes
 * a list item may take).
 *
 * A missing manifest is fatal on purpose. Widget-ness comes from *which* manifest a name is in, so
 * silently treating an unreadable `widgets.yaml` as "no widgets" would make every `Widget <Type>`
 * reference fail instead, and send the reader off to fix screen YAML that was never wrong. A project
 * with no widgets ships an empty file.
 */
async function readManifest(opts: LoadOptions, file: string): Promise<string[]> {
  let text: string;
  try {
    text = await opts.fetchText(`${opts.base}${file}`);
  } catch (e) {
    throw new Error(`${file} se nepodařilo načíst (${String(e)}). Soubor musí existovat, i když je prázdný.`);
  }
  // A dev server with SPA fallback answers a missing file with index.html and status 200, so the
  // fetch above succeeds and the YAML parser would fail with something unhelpful instead.
  if (text.trimStart().startsWith("<")) {
    throw new Error(`${file} nebyl nalezen (server místo něj vrátil HTML). Soubor musí existovat, i když je prázdný.`);
  }
  // A file holding nothing but comments is a legitimate "none of these yet", but the YAML parser
  // rejects an empty document, so check before handing it over.
  const hasContent = text.split(/\r?\n/).some((line) => line.trim() && !line.trimStart().startsWith("#"));
  if (!hasContent) return [];

  const doc = load(text) ?? [];
  if (!Array.isArray(doc)) {
    throw new Error(
      `${file}: očekává se seznam názvů, každý na svém řádku jako "- Nazev" (volitelně "- Nazev:" s vnořenou dokumentací atributů).`,
    );
  }
  return doc.map(manifestEntryName).filter((name): name is string => name !== undefined);
}

/**
 * Fetches both manifests and every component file they list, in parallel. A failure in one file
 * yields a visible error placeholder for that component only — a typo uploaded over FTP must never
 * blank out the whole prototype.
 */
export async function loadComponentLibrary(opts: LoadOptions): Promise<ComponentRegistry> {
  const [componentNames, widgetNames] = await Promise.all([
    readManifest(opts, "components.yaml"),
    readManifest(opts, "widgets.yaml"),
  ]);

  const entries: Array<{ name: string; dir: "components" | "widgets"; isWidget: boolean }> = [
    ...componentNames.map((name) => ({ name, dir: "components" as const, isWidget: false })),
    ...widgetNames.map((name) => ({ name, dir: "widgets" as const, isWidget: true })),
  ];

  // The HTML parser lowercases tag names, so `<TextInputField>` arrives as `textinputfield` and the
  // original casing is unrecoverable — hence an explicit lowercase → registry-name index.
  const lowerIndex = new Map<string, string>();
  for (const name of Object.keys(opts.baseRegistry ?? {})) lowerIndex.set(name.toLowerCase(), name);
  for (const { name } of entries) {
    const lower = name.toLowerCase();
    const clash = lowerIndex.get(lower);
    if (clash && clash !== name) {
      throw new Error(
        `components.yaml/widgets.yaml: "${name}" a "${clash}" se liší jen velikostí písmen — HTML značky to nerozliší.`,
      );
    }
    /**
     * A name that is also an HTML element can't be used as `<Name>` inside another template — the
     * parser turns it into the plain element, and the engine deliberately leaves it that way (see
     * compileTemplate). Referencing it from screen YAML works fine, so this is a warning rather than
     * an error, but it has to be said out loud: otherwise the component silently never appears.
     */
    if (isKnownHtmlTag(lower)) {
      console.warn(
        `[html-komponenty] "${name}" má stejný název jako HTML značka <${lower}>. V obrazovkách funguje, ` +
          `ale v šablonách jiných komponent se <${lower}> vykreslí jako obyčejný HTML prvek, ne jako tahle komponenta.`,
      );
    }
    lowerIndex.set(lower, name);
  }

  const registry: ComponentRegistry = {};
  // Resolution is deferred to render time so components may reference each other in any load order,
  // and so a not-yet-migrated component still resolves to its bundled version.
  const resolveComponent: ResolveComponent = (lowerTag) => {
    const key = lowerIndex.get(lowerTag);
    if (!key) return undefined;
    const entry = registry[key] ?? opts.baseRegistry?.[key];
    return entry?.component as ComponentType<Record<string, unknown>> | undefined;
  };

  await Promise.all(
    entries.map(async ({ name, dir, isWidget }) => {
      const path = `${dir}/${name}.html`;
      try {
        const source = await fetchWithRetry(opts.fetchText, `${opts.base}${path}`);
        const parsed = parseComponentFile(source, name);
        const def = parsed.script ? await runScript(parsed.script, name, path) : {};
        validateDefinition(def, name);
        injectStyle(name, parsed.style);
        const render = compileTemplate(parsed.template!, { name, resolveComponent });
        const entry: RegistryEntry = {
          component: createComponent(name, def, render, opts.lib, opts.base),
          widget: isWidget,
        };
        if (def.field) entry.field = true;
        if (def.action) entry.action = true;
        if (def.gated) entry.gated = true;
        if (def.validatable) entry.validatable = true;
        registry[name] = entry;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[html-komponenta] ${path}:`, e);
        // Registered anyway, and crucially with the right `widget` flag — otherwise a single missing
        // file would make parseScreenYaml reject every `Widget <Type> <id>` node on every screen.
        registry[name] = { component: createErrorComponent(name, message), widget: isWidget };
      }
    }),
  );

  return registry;
}
