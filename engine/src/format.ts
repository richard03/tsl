export function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Groups a digit string into Czech-style thousands, e.g. "250000" -> "250 000". The separator
 * is U+00A0 (non-breaking space), not a plain space — a number must never wrap across lines.
 */
export function formatThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Fills `{name}` placeholders in a template string.
 *
 * Deliberately a different syntax from the engine's `{{...}}` YAML bindings: these templates come
 * from translations and are filled with values a component already has, not with paths resolved
 * against engine state.
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}
