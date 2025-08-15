/**
 * Reading and writing pre-staged respondent configs (`public/respondents/<id>.yaml`).
 *
 * Both directions are driven by `setup.yaml` rather than by knowledge of any particular respondent:
 * the schema is what says which fields are lists of objects, which is all this needs in order to
 * hand out ids on load and strip them again on save.
 */
import { load, dump } from "js-yaml";
import type { SetupSchema } from "./schema";
import { getSetupSchema } from "./schema";

type Respondent = Record<string, unknown>;

/**
 * Generates an item id.
 *
 * Ids are an internal detail — a moderator writing a config by hand shouldn't have to invent them,
 * so any list item that arrives without one gets it here.
 */
function generateId(): string {
  // crypto.randomUUID() only exists in secure contexts (HTTPS/localhost) — fall back on plain HTTP.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Names of the schema's `objectList` fields — the ones whose items carry ids. */
function listFields(schema: SetupSchema): string[] {
  return schema.fields.filter((f) => f.type === "objectList").map((f) => f.name);
}

function isRespondentShape(doc: unknown): doc is Respondent {
  return typeof doc === "object" && doc !== null && !Array.isArray(doc);
}

export interface LoadRespondentOptions {
  base: string;
  fetchText: (url: string) => Promise<string>;
  /** Project hook applied to the finished object, for defaults only the domain can fill in. */
  normalize?: (respondent: unknown) => unknown;
}

/**
 * Loads a config by id (e.g. uploaded via FTP for a remote test). Fetched at runtime, so adding a
 * respondent needs no rebuild or redeploy of the app.
 */
export async function loadRespondentConfig(id: string, options: LoadRespondentOptions): Promise<unknown> {
  const { base, fetchText, normalize } = options;
  const fileName = `${id}.yaml`;
  const text = await fetchText(`${base}respondents/${fileName}`);
  const doc = load(text);
  if (!isRespondentShape(doc)) {
    throw new Error(`respondents/${fileName}: neplatný tvar konfigurace respondenta`);
  }

  // Without a schema there is nothing that says which fields are lists, so ids are left alone.
  const schema = await getSetupSchema(base, fetchText);
  const withIds: Respondent = { ...doc };
  for (const name of schema ? listFields(schema) : []) {
    const items = withIds[name];
    if (!Array.isArray(items)) continue;
    withIds[name] = items.map((item) =>
      item && typeof item === "object" ? { ...item, id: (item as Respondent).id || generateId() } : item,
    );
  }

  return normalize ? normalize(withIds) : withIds;
}

/**
 * Serializes a respondent back to the YAML shape `loadRespondentConfig` reads, for the moderator to
 * upload as a new `public/respondents/<id>.yaml`. Item ids are dropped — they're regenerated on load
 * and would only be noise in a hand-edited file.
 */
export function respondentToYaml(respondent: unknown, schema: SetupSchema): string {
  const out: Respondent = { ...(respondent as Respondent) };
  for (const name of listFields(schema)) {
    const items = out[name];
    if (!Array.isArray(items)) continue;
    out[name] = items.map((item) => {
      if (!item || typeof item !== "object") return item;
      const { id: _id, ...rest } = item as Respondent;
      return rest;
    });
  }
  return dump(out);
}
