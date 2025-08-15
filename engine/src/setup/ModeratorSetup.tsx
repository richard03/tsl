/**
 * Default moderator "configure the test" screen.
 *
 * Which variables it collects comes entirely from `public/setup.yaml`, so a project normally uses
 * this as-is and describes its respondent in YAML. A project with genuinely different needs can
 * still pass its own `Setup` to `AppShell`.
 */
import { useEffect, useState } from "react";
import { fetchText } from "../FlowEngine";
import type { SetupSchema } from "./schema";
import { defaultsFromSchema, getSetupSchema, schemaHasErrors } from "./schema";
import { respondentToYaml } from "./respondentConfig";
import { SchemaForm } from "./SchemaForm";
import { AlertMessage } from "./ui/AlertMessage";

export interface ModeratorSetupProps {
  onStart: (respondent: unknown) => void;
  /** Pre-fills the form, e.g. when returning here via "restart flow". */
  initialRespondent?: unknown;
  /** Shown when a `?respondentId=` link pointed at a config that couldn't be loaded. */
  configLoadError?: string | null;
}

/** ASCII-only, filesystem-safe stand-in for a name, used as the downloaded file's default name. */
function slugify(text: string): string {
  const ascii = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return ascii || "respondent";
}

export function ModeratorSetup({ onStart, initialRespondent, configLoadError }: ModeratorSetupProps) {
  const [schema, setSchema] = useState<SetupSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [value, setValue] = useState<Record<string, unknown> | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSetupSchema(import.meta.env.BASE_URL, fetchText)
      .then((loaded) => {
        // `null` means the project has no setup.yaml. The shell starts the run without asking the
        // moderator anything, so this screen only has to avoid rendering a form it doesn't have.
        if (cancelled || !loaded) return;
        setSchema(loaded);
        // A returning respondent wins over the schema defaults, but a field that came into existence
        // after them still needs its default — otherwise its input would bind to `undefined`.
        setValue({ ...defaultsFromSchema(loaded.fields), ...((initialRespondent as object) ?? {}) });
      })
      .catch((e: unknown) => {
        if (!cancelled) setSchemaError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [initialRespondent]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    // Starting a test with an invalid form (e.g. a nameless respondent) would silently produce bad
    // research data, so the errors are revealed instead.
    if (!value || !schema || schemaHasErrors(schema.fields, value)) return;
    onStart(value);
  }

  function handleDownloadConfig() {
    if (!value || !schema) return;
    const blob = new Blob([respondentToYaml(value, schema)], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(String(schema.fileNameFrom ? (value[schema.fileNameFrom] ?? "") : ""))}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (schemaError) {
    return (
      <div className="moderator-setup">
        <h1 className="heading heading--1">Nastavení respondenta</h1>
        <AlertMessage intent="error" text={`Nepodařilo se načíst setup.yaml — ${schemaError}`} />
      </div>
    );
  }

  if (!schema || !value) {
    return (
      <div className="moderator-setup">
        <p className="paragraph paragraph--muted">Načítání…</p>
      </div>
    );
  }

  return (
    <div className="moderator-setup">
      <h1 className="heading heading--1">{schema.title}</h1>
      {configLoadError && <AlertMessage intent="error" text={configLoadError} />}
      <form onSubmit={handleSubmit}>
        <SchemaForm fields={schema.fields} value={value} onChange={setValue} forceShowError={submitAttempted} />

        <button type="submit" className="button button--primary">
          {schema.submitText}
        </button>
        {schema.downloadText && (
          <button type="button" className="button button--secondary" onClick={handleDownloadConfig}>
            {schema.downloadText}
          </button>
        )}
      </form>
    </div>
  );
}
