import type { EvalState } from "./conditions";
import { resolvePath } from "./path";
import { formatThousands } from "./format";

/** Whether a prop value is a binding (`{ $bind: "respondent.name" }`) rather than a literal value. */
export function isBindRef(value: unknown): value is { $bind: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "$bind" in value &&
    typeof (value as { $bind: unknown }).$bind === "string"
  );
}

const TEMPLATE_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Fills `{{path}}` placeholders inside a string with resolved values (numbers get thousands-separated). */
function interpolate(text: string, state: EvalState): string {
  return text.replace(TEMPLATE_RE, (_, path: string) => {
    const resolved = resolvePath(state, path);
    if (resolved === undefined || resolved === null) return "";
    if (typeof resolved === "number" && Number.isFinite(resolved)) {
      return formatThousands(String(Math.round(resolved)));
    }
    return String(resolved);
  });
}

export function resolveValue(value: unknown, state: EvalState): unknown {
  if (isBindRef(value)) {
    return resolvePath(state, value.$bind);
  }
  if (typeof value === "string" && value.includes("{{")) {
    return interpolate(value, state);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveValue(v, state));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveValue(v, state);
    }
    return out;
  }
  return value;
}

export function resolveProps(
  props: Record<string, unknown> | undefined,
  state: EvalState,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    out[key] = resolveValue(value, state);
  }
  return out;
}
