import type { ComponentInstance } from "./types/screen";
import { isBindRef } from "./bindings";

/** Loaded once from `translations.properties` and kept as a flat key → text map. */
export type Translations = Record<string, string>;

/**
 * Prop names treated as user-facing text for the `screen.<screenId>.<instanceId>.<key>` lookup
 * convention. Deliberately excludes config/enum-like string props (`type`, `field`, `variable`,
 * `unit`, `image`, `action.*`, `$bind` paths) — those aren't language text, they're wiring.
 */
const TRANSLATABLE_PROP_KEYS = ["text", "title", "label", "description", "alt", "suffix", "empty", "value"] as const;

/**
 * Parses a `.properties`-style file: `key=value` per line, `#` starts a comment, blank lines
 * ignored, key/value split on the first `=`. No multi-line values or escaping — nothing in this
 * project's text needs it, and keeping the format trivial is what makes it editable by hand.
 */
export function parseTranslations(text: string): Translations {
  const out: Translations = {};
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1);
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Returns `instance.props` with any translatable key overridden by
 * `screen.<screenId>.<instance.id>.<key>` when that translation exists (and, for an `options`
 * list, each item's `label` overridden by `screen.<screenId>.<instance.id>.options.<value>.label`).
 * Falls back to whatever's already in `props` when no translation is found, so a screen not yet
 * extracted keeps working with its text written directly in YAML. Must run *before* `resolveProps`
 * so `{{...}}` placeholders inside a translated string still get interpolated.
 */
export function applyScreenTranslations(
  screenId: string,
  instance: ComponentInstance,
  translations: Translations,
): Record<string, unknown> {
  const props: Record<string, unknown> = { ...(instance.props ?? {}) };
  const prefix = `screen.${screenId}.${instance.id}.`;

  for (const key of TRANSLATABLE_PROP_KEYS) {
    const translated = translations[`${prefix}${key}`];
    // A binding is wiring, not language text — the same reason `type`/`field`/`variable` are absent
    // from TRANSLATABLE_PROP_KEYS. That filter only looks at the prop's *name*, so without this a
    // translation would silently replace `title: { $bind: respondent.name }` with a constant and the
    // binding would be dead with nothing to show for it. Text that needs a value inside is written
    // as a translated string containing `{{...}}`, which `resolveProps` fills in right after.
    if (translated !== undefined && !isBindRef(props[key])) props[key] = translated;
  }

  if (Array.isArray(props.options)) {
    props.options = props.options.map((opt) => {
      if (!opt || typeof opt !== "object" || Array.isArray(opt)) return opt;
      const optValue = (opt as { value?: unknown }).value;
      if (optValue === undefined) return opt;
      const translated = translations[`${prefix}options.${String(optValue)}.label`];
      if (translated === undefined || isBindRef((opt as { label?: unknown }).label)) return opt;
      return { ...opt, label: translated };
    });
  }

  return props;
}
