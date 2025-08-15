/**
 * Schema for the moderator's "configure the test" form, loaded at runtime from `public/setup.yaml`.
 *
 * The form used to be hardcoded React, so adding a test variable meant editing components and
 * rebuilding. Here the fields are data: a moderator adds a variable by adding a YAML entry, and it
 * is immediately bindable in screens as `$bind: respondent.<name>` — the same runtime-config
 * treatment `flow.yaml`, the screens, the component library and the translations already get.
 *
 * The vocabulary is deliberately small: five field types and the engine's existing `Condition`
 * syntax for everything conditional.
 */
import { load } from "js-yaml";
import type { Condition } from "../types/screen";
import { matchesItem } from "../conditions";
import { getValidationError, type ValidatorConfig } from "../validation";

/** One selectable value of a `choice` field. `value` is what lands in the data, `label` what the moderator reads. */
export interface FieldOption {
  value: unknown;
  label: string;
}

/** Replaces a field's label while `when` holds — e.g. "Částka ke splacení" becomes "Čerpáno" for a credit card. */
export interface ConditionalLabel {
  when: Condition[];
  label: string;
}

export type FieldType = "text" | "number" | "boolean" | "choice" | "objectList";

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  /** Value the field starts at. For `objectList` this is always an empty list. */
  default?: unknown;
  /** Unit shown after the input, e.g. "Kč". */
  suffix?: string;
  /** `choice` only. */
  options?: FieldOption[];
  /** `choice` only — radio buttons instead of a dropdown. */
  control?: "radio" | "select";
  validators?: ValidatorConfig[];
  /** The field is only shown — and only saved — while these conditions hold against the object being edited. */
  showWhen?: Condition[];
  /** First matching entry wins; falls back to `label`. */
  labelWhen?: ConditionalLabel[];
  /**
   * Pre-fills the field from another field's value until the moderator types into it, e.g. picking
   * the product type suggests a name. Only meaningful for `text`.
   */
  defaultFrom?: { field: string; map: Record<string, unknown> };

  // ---- `objectList` only ----
  /** Fields of one item in the list. Items are flat objects — a field here may not itself be an `objectList`. */
  fields?: FieldSpec[];
  addText?: string;
  modalTitle?: string;
  saveText?: string;
  cancelText?: string;
  removeText?: string;
  emptyText?: string;
  /** Row above each group totalling one numeric field across the group's items. */
  summary?: { label: string; sum: string; suffix?: string };
  /** Splits the list into sections; an item shows in the first group whose `where` it matches. */
  groups?: { title: string; where?: Condition[] }[];
  /** How one item is rendered in the list. */
  item?: ItemSpec;
}

export interface ItemSpec {
  /** Which field supplies the item's headline. */
  label: { field: string };
  value?: { field: string; suffix?: string };
  /** Secondary lines; each is skipped when its field is empty or its `showWhen` fails. */
  meta?: { label: string; field: string; suffix?: string; showWhen?: Condition[] }[];
}

/**
 * What the floating moderator panel shows during a run.
 *
 * It's here rather than in code so the engine's default overlay never has to know what a respondent
 * looks like — a project says "show this field" instead of the engine assuming there is one.
 */
export interface OverlaySpec {
  toggleLabel?: string;
  /** Field shown in bold at the top of the panel. */
  title?: { field: string };
  /** One line each; `count` shows the length of an array field instead of its value. */
  lines?: { field: string; map?: Record<string, string>; count?: boolean; suffix?: string }[];
  restartText?: string;
  endText?: string;
}

export interface SetupSchema {
  title: string;
  submitText: string;
  downloadText?: string;
  /** Field whose value names the downloaded config file. Without it the file is `respondent.yaml`. */
  fileNameFrom?: string;
  overlay?: OverlaySpec;
  fields: FieldSpec[];
}

const FIELD_TYPES: FieldType[] = ["text", "number", "boolean", "choice", "objectList"];

/**
 * Rejects a malformed schema loudly at load time.
 *
 * A silently-ignored typo here would show the moderator a form that is quietly missing a variable,
 * and the test would run with wrong data — far worse than refusing to start.
 */
function validateFields(fields: unknown, path: string, allowObjectList: boolean): asserts fields is FieldSpec[] {
  if (!Array.isArray(fields)) throw new Error(`${path}: očekával jsem seznam polí`);
  const seen = new Set<string>();
  for (const [i, raw] of fields.entries()) {
    const at = `${path}[${i}]`;
    const f = raw as FieldSpec;
    if (typeof f?.name !== "string" || !f.name) throw new Error(`${at}: chybí "name"`);
    if (seen.has(f.name)) throw new Error(`${at}: pole "${f.name}" je definované dvakrát`);
    seen.add(f.name);
    if (typeof f.label !== "string") throw new Error(`${at} (${f.name}): chybí "label"`);
    if (!FIELD_TYPES.includes(f.type)) {
      throw new Error(`${at} (${f.name}): neznámý typ "${f.type}", povolené jsou ${FIELD_TYPES.join(", ")}`);
    }
    if (f.type === "choice" && (!Array.isArray(f.options) || f.options.length === 0)) {
      throw new Error(`${at} (${f.name}): typ "choice" potřebuje "options"`);
    }
    if (f.type === "objectList") {
      if (!allowObjectList) {
        throw new Error(`${at} (${f.name}): "objectList" nelze zanořit do jiného "objectList"`);
      }
      if (!f.item?.label?.field) throw new Error(`${at} (${f.name}): chybí "item.label.field"`);
      validateFields(f.fields, `${at} (${f.name}).fields`, false);
    }
  }
}

function validateSchema(doc: unknown): asserts doc is SetupSchema {
  const s = doc as SetupSchema;
  if (typeof s !== "object" || s === null) throw new Error("setup.yaml: prázdný nebo neplatný soubor");
  if (typeof s.title !== "string") throw new Error('setup.yaml: chybí "title"');
  if (typeof s.submitText !== "string") throw new Error('setup.yaml: chybí "submitText"');
  validateFields(s.fields, "setup.yaml: fields", true);
}

/**
 * Loads and validates `public/setup.yaml`.
 *
 * Returns `null` when the file simply isn't there — a prototype where the moderator configures
 * nothing is a legitimate prototype, and it should start its flow rather than complain. A file that
 * *does* exist but is malformed still throws: that's a mistake somebody needs to hear about.
 */
export async function loadSetupSchema(
  base: string,
  fetchText: (url: string) => Promise<string>,
): Promise<SetupSchema | null> {
  const url = `${base}setup.yaml`;
  let text: string;
  try {
    text = await fetchText(url);
  } catch {
    return null;
  }
  // A dev server's SPA fallback answers a missing file with index.html and status 200 — that's the
  // same "no such file" case, just disguised.
  if (/^\s*<(!doctype|html)/i.test(text)) return null;
  const doc = load(text);
  validateSchema(doc);
  return doc;
}

/**
 * Memoized `loadSetupSchema`.
 *
 * The shell, the setup screen, the moderator overlay and the remote-config loader all need the
 * schema but mount at different moments; without this the same file would be fetched four times
 * (the fetch is deliberately `no-store`, so each one is a real request).
 */
let cachedSchema: Promise<SetupSchema | null> | null = null;
export function getSetupSchema(
  base: string,
  fetchText: (url: string) => Promise<string>,
): Promise<SetupSchema | null> {
  cachedSchema ??= loadSetupSchema(base, fetchText);
  return cachedSchema;
}

/** Starting value of the form: every field's `default`, with lists starting empty. */
export function defaultsFromSchema(fields: FieldSpec[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "objectList") out[f.name] = [];
    else if (f.default !== undefined) out[f.name] = f.default;
  }
  return out;
}

/** Whether the field applies to the object as currently filled in. */
export function isFieldVisible(field: FieldSpec, value: Record<string, unknown>): boolean {
  return matchesItem(value, field.showWhen);
}

/** The field's label for the current state of the object — `labelWhen` first match wins. */
export function labelFor(field: FieldSpec, value: Record<string, unknown>): string {
  return field.labelWhen?.find((c) => matchesItem(value, c.when))?.label ?? field.label;
}

/**
 * Drops the values of fields that don't currently apply, so an item can't carry a leftover value
 * from when it was still of a different type. Without this the stale value would flow into the
 * screens as if it were real data.
 */
export function stripHiddenFields(fields: FieldSpec[], value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    const field = fields.find((f) => f.name === key);
    if (field && !isFieldVisible(field, value)) continue;
    if (v === undefined || v === "") continue;
    out[key] = v;
  }
  return out;
}

/**
 * Whether any currently-visible field fails its validators.
 *
 * Used to block submit — the old hardcoded form relied on the browser's `required` attribute, and
 * without this a test could be started with a nameless respondent.
 */
export function schemaHasErrors(fields: FieldSpec[], value: Record<string, unknown>): boolean {
  return fields.some((field) => {
    if (!field.validators?.length || !isFieldVisible(field, value)) return false;
    const raw = value[field.name];
    return getValidationError(raw == null ? "" : String(raw), field.validators) !== undefined;
  });
}

/**
 * Writes `defaultFrom` suggestions into fields the moderator hasn't typed into yet, so picking a
 * product type fills in a matching name.
 *
 * The suggestion is written into the value rather than merely displayed — a name that is only on
 * screen would be lost on save, which is the whole point of suggesting it.
 */
export function applySuggestions(
  fields: FieldSpec[],
  value: Record<string, unknown>,
  touched: ReadonlySet<string>,
): Record<string, unknown> {
  let out = value;
  for (const field of fields) {
    if (!field.defaultFrom || touched.has(field.name)) continue;
    const suggestion = field.defaultFrom.map[String(value[field.defaultFrom.field])];
    if (suggestion !== undefined && out[field.name] !== suggestion) {
      out = { ...out, [field.name]: suggestion };
    }
  }
  return out;
}
