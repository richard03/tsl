/**
 * Splits a component `.html` file into its `<template>` / `<style>` / `<script>` parts, and rejects
 * the handful of ways the HTML parser silently mangles component markup (see `lintSource`).
 */

export interface ParsedComponentFile {
  /** The `<template>`'s content, or null when the file has none (script-only files aren't valid). */
  template: DocumentFragment | null;
  /** All `<style>` blocks concatenated. */
  style: string;
  /** The `<script>` body, or null when absent. */
  script: string | null;
}

export class ComponentFileError extends Error {}

/**
 * Catches parser traps that would otherwise fail silently and produce subtly wrong output:
 *
 * 1. `<MyComponent />` — self-closing syntax does not exist for non-void HTML elements. The parser
 *    treats it as an *open* tag and reparents every following sibling into it.
 * 2. A camelCase attribute name (`:sheetOptions`) is lowercased to `:sheetoptions`, so the prop
 *    silently arrives under the wrong name. Only detectable in the raw source — by the time the DOM
 *    exists, the original casing is gone.
 * 3. `</script>` inside a JS string literal terminates the whole script block early.
 */
function lintSource(source: string, name: string): void {
  const selfClosing = source.match(/<([A-Z][\w-]*)\b[^>]*\/>/);
  if (selfClosing) {
    throw new ComponentFileError(
      `${name}: <${selfClosing[1]} ... /> — samouzavírací zápis u komponenty nefunguje, ` +
        `prohlížeč do ní vloží všechny následující prvky. Napiš </${selfClosing[1]}>.`,
    );
  }

  const camelBinding = source.match(/[\s"'](:[a-z][a-zA-Z]*[A-Z][a-zA-Z]*)\s*=/);
  if (camelBinding) {
    const bad = camelBinding[1];
    const good = bad.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    throw new ComponentFileError(
      `${name}: ${bad}="..." — prohlížeč převede názvy atributů na malá písmena, takže by vlastnost ` +
        `nedorazila. Napiš ${good}="..." (spojovníky se převedou zpět na velká písmena).`,
    );
  }

  const camelDirective = source.match(/[\s"'](data-(?:let|on)-[a-z-]*[A-Z][a-zA-Z-]*)\s*=/);
  if (camelDirective) {
    const bad = camelDirective[1];
    const good = bad.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    throw new ComponentFileError(
      `${name}: ${bad}="..." — názvy atributů prohlížeč převede na malá písmena. Napiš ${good}="...".`,
    );
  }

  const scriptBody = source.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1] ?? "";
  if (/<\/script/i.test(scriptBody)) {
    throw new ComponentFileError(`${name}: "</script" uvnitř <script> ukončí blok předčasně — rozděl řetězec (např. "<\\/script").`);
  }
}

/** Parses one component file's source. `name` is only used in error messages. */
export function parseComponentFile(source: string, name: string): ParsedComponentFile {
  lintSource(source, name);

  // Query the whole document, not `body`: the parser hoists `<style>` into `<head>`, and a leading
  // `<template>` can end up in either depending on what precedes it.
  const doc = new DOMParser().parseFromString(source, "text/html");

  const templateEl = doc.querySelector("template");
  const style = Array.from(doc.querySelectorAll("style"))
    .map((el) => el.textContent ?? "")
    .join("\n");
  const script = doc.querySelector("script")?.textContent ?? null;

  if (!templateEl) {
    throw new ComponentFileError(`${name}: chybí <template> — komponenta musí mít značky k vykreslení.`);
  }

  return { template: templateEl.content, style, script: script && script.trim() ? script : null };
}
