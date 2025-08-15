import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import "./engine.css";
import { loadRespondent, saveRespondent, clearAll, clearDataAndPosition } from "./state";
import { FlowEngine, fetchText } from "./FlowEngine";
import { loadComponentLibrary } from "./html/loadComponentLibrary";
import { clearSetupFromUrl, isSetupRequested, setupUrl } from "./router";
import type { ComponentRegistry } from "./registry";
import { ModeratorSetup } from "./setup/ModeratorSetup";
import { ModeratorOverlay } from "./setup/ModeratorOverlay";
import { loadRespondentConfig as defaultLoadRespondentConfig } from "./setup/respondentConfig";
import { loadBusinessRules, loadDataFile, type BusinessRules } from "./business";
import { getSetupSchema, type SetupSchema } from "./setup/schema";
import { matchesItem } from "./conditions";
import { getValidationError } from "./validation";
import { onlyDigits, formatThousands, fillTemplate } from "./format";

/** Props the host project's moderator setup screen receives from the shell. `respondent` is opaque to the engine. */
export interface SetupProps {
  onStart: (respondent: unknown) => void;
  initialRespondent?: unknown;
  configLoadError?: string | null;
}

/** Props the host project's moderator overlay receives from the shell. */
export interface OverlayProps {
  respondent: unknown;
  onEndAndClear: () => void;
  onRestartFlow: () => void;
}

export interface AppShellProps {
  /**
   * Components bundled into the build. Normally empty: components and widgets live in
   * `public/components/*.html` and `public/widgets/*.html` and are compiled at runtime. It stays as
   * an extension point — a same-named HTML file overrides a bundled entry.
   */
  registry?: ComponentRegistry;
  /**
   * Moderator "configure the respondent" screen. Defaults to the schema-driven one, which builds its
   * form from `public/setup.yaml`; supply your own only when YAML genuinely can't express the form.
   */
  Setup?: ComponentType<SetupProps>;
  /** Floating moderator controls shown during a run (restart / end test). Defaults to the `overlay:` section of `setup.yaml`. */
  Overlay?: ComponentType<OverlayProps>;
  /** Loads a pre-staged respondent config by id (from `?respondentId=`). Defaults to reading `public/respondents/<id>.yaml`. */
  loadRespondentConfig?: (id: string) => Promise<unknown>;
  /**
   * Applied to a respondent as it enters a run, from either the setup form or a remote config.
   *
   * Everything else about a respondent is described in `setup.yaml`, but implicit defaults — a field
   * derived from two others, say — need a rule. Normally that rule is exported from
   * `public/business.js`; this prop is the override for a project that keeps it bundled and typed.
   */
  normalizeRespondent?: (respondent: unknown) => unknown;
  /** Banner rendered when a submit is attempted with validation errors present; lets the project supply its own component/copy. */
  renderValidationError?: () => ReactNode;
  /**
   * Extra helpers merged into `lib` on top of the engine's own and whatever `public/business.js`
   * exports. Only needed for logic a project deliberately keeps typed and bundled; business rules
   * belong in `business.js`, where they can be changed without a build.
   */
  lib?: Record<string, unknown>;
}

/** Helpers every component gets as `lib`, whatever the project's domain is. */
const ENGINE_LIB = { matchesItem, getValidationError, onlyDigits, formatThousands, fillTemplate, loadDataFile };

function getRespondentIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("respondentId");
}

function stripRespondentIdFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("respondentId");
  window.history.replaceState(null, "", url.toString());
}

/**
 * Generic shell around the flow engine: renders the simulated phone frame, wires the moderator
 * setup/overlay extension points, handles `?respondentId=` remote-config loading, and keeps the
 * whole phone visible on large screens via the `--phone-scale` variable.
 *
 * Everything a project needs is optional: with no props at all it runs a flow whose respondent is
 * described by `public/setup.yaml`. A project overrides a piece only where it has something the
 * configuration can't say.
 */
export function AppShell({
  registry = {},
  Setup = ModeratorSetup,
  Overlay = ModeratorOverlay,
  loadRespondentConfig,
  normalizeRespondent,
  renderValidationError,
  lib,
}: AppShellProps) {
  const remoteId = getRespondentIdFromUrl();
  const [respondent, setRespondent] = useState<unknown>(() => (remoteId ? null : loadRespondent()));
  const [mode, setMode] = useState<"setup" | "running" | "loading">(() => {
    if (remoteId) return "loading";
    // An explicit setup URL wins over a stored respondent — that's what makes "restart" (which keeps
    // the respondent so it can be tweaked and re-run) land on the setup page instead of the flow.
    if (isSetupRequested()) return "setup";
    return loadRespondent() ? "running" : "setup";
  });
  const [flowKey, setFlowKey] = useState(0);
  const [currentScreenId, setCurrentScreenId] = useState<string | null>(null);
  const [configLoadError, setConfigLoadError] = useState<string | null>(null);
  // `null` until the HTML component library has loaded.
  const [htmlRegistry, setHtmlRegistry] = useState<ComponentRegistry | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  // Business rules from `public/business.js`; needed before the flow runs, since components call them.
  const [business, setBusiness] = useState<BusinessRules | null>(null);
  /** `undefined` while loading, `null` when the project has no `setup.yaml` at all. */
  const [schema, setSchema] = useState<SetupSchema | null | undefined>(undefined);

  useEffect(() => {
    // Runs in parallel with the moderator's setup screen, so the load is invisible in practice.
    // Business rules first: they are part of the `lib` every component is compiled against.
    loadBusinessRules(import.meta.env.BASE_URL, fetchText)
      .then((rules) => {
        setBusiness(rules);
        return loadComponentLibrary({
          base: import.meta.env.BASE_URL,
          lib: { ...ENGINE_LIB, ...rules, ...(lib ?? {}) },
          fetchText,
          baseRegistry: registry,
        });
      })
      .then(setHtmlRegistry)
      .catch((e) => {
        // Only a manifest-level failure lands here (individual files degrade to an error placeholder).
        // Surfacing it beats carrying on with an empty registry, which would blame the screens instead.
        console.error("[html-komponenty] knihovnu se nepodařilo načíst:", e);
        setLibraryError(e instanceof Error ? e.message : String(e));
      });
    // A malformed setup.yaml is reported by the setup screen itself; here a failure only means
    // "no schema", which is the same as not having the file.
    getSetupSchema(import.meta.env.BASE_URL, fetchText)
      .then(setSchema)
      .catch(() => setSchema(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Without a setup.yaml there is nothing for the moderator to fill in, so the run starts straight
    // away instead of showing an empty form or an error about a file the project never needed.
    if (mode === "setup" && schema === null && !configLoadError) handleStart(respondent ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, schema]);

  /**
   * Filling in domain defaults is the one thing configuration can't express, so it comes from
   * `business.js` — with the prop left as an override for a project that keeps the rule bundled.
   */
  const normalize =
    normalizeRespondent ??
    (typeof business?.normalizeRespondent === "function"
      ? (business.normalizeRespondent as (r: unknown) => unknown)
      : undefined);

  // HTML components override bundled ones of the same name — that's the migration lever: a component
  // moves to the runtime library by gaining a manifest entry, and reverts by losing it.
  const mergedRegistry: ComponentRegistry = { ...registry, ...(htmlRegistry ?? {}) };

  useEffect(() => {
    // On large screens the simulated phone (375×812) can be taller than the available viewport —
    // shrink it uniformly (via CSS transform, driven by this variable) rather than let the page
    // scroll, so it's always fully visible. No-op on mobile, where the frame is full-bleed anyway.
    function updatePhoneScale() {
      const availableWidth = window.innerWidth - 24; // #root's 12px horizontal padding × 2
      const availableHeight = window.innerHeight - 48; // #root's 24px vertical padding × 2
      const scale = Math.min(1, availableWidth / 375, availableHeight / 812);
      document.documentElement.style.setProperty("--phone-scale", String(Math.max(scale, 0.01)));
    }
    updatePhoneScale();
    window.addEventListener("resize", updatePhoneScale);
    return () => window.removeEventListener("resize", updatePhoneScale);
  }, []);

  useEffect(() => {
    if (!remoteId || business === null) return;
    const loadConfig =
      loadRespondentConfig ??
      ((id: string) =>
        defaultLoadRespondentConfig(id, {
          base: import.meta.env.BASE_URL,
          fetchText,
          normalize,
        }));
    loadConfig(remoteId)
      .then((r) => {
        saveRespondent(r);
        clearDataAndPosition();
        setRespondent(r);
        setMode("running");
        setFlowKey((k) => k + 1);
      })
      .catch(() => {
        setConfigLoadError(`Konfigurace „${remoteId}“ nebyla nalezena. Zadejte prosím parametry ručně.`);
        setMode("setup");
      })
      .finally(() => stripRespondentIdFromUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  function handleStart(rawRespondent: unknown) {
    const newRespondent = normalize ? normalize(rawRespondent) : rawRespondent;
    saveRespondent(newRespondent);
    clearDataAndPosition();
    clearSetupFromUrl();
    setRespondent(newRespondent);
    setMode("running");
    setFlowKey((k) => k + 1);
  }

  // Both of these end the run and go to the setup page by real navigation, so the URL stops naming a
  // screen: reloading (or going back) must not drop into the flow that was just cleared.
  const screenIdsForUrl = () => (currentScreenId ? new Set([currentScreenId]) : new Set<string>());

  /** Ends the run entirely: the respondent is forgotten and setup starts from scratch. */
  function handleEndAndClear() {
    clearAll();
    window.location.assign(setupUrl(screenIdsForUrl()));
  }

  /** Restarts the flow but keeps the respondent, so it can be adjusted and run again. */
  function handleRestartFlow() {
    clearDataAndPosition();
    window.location.assign(setupUrl(screenIdsForUrl()));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleUpdateRespondent(updater: (r: any) => any) {
    setRespondent((r: unknown) => {
      if (!r) return r;
      const next = updater(r);
      saveRespondent(next);
      return next;
    });
  }

  return (
    <div className="app">
      <div className="phone">
        {mode === "loading" ? (
          <div className="screen">Načítání…</div>
        ) : mode === "running" && respondent ? (
          // The registry must be complete before FlowEngine mounts: it derives `widgetTypes` from it
          // once, and screen parsing rejects `Widget <Type> <id>` for any type missing at that moment.
          libraryError !== null ? (
            <div className="screen">Nepodařilo se načíst knihovnu komponent: {libraryError}</div>
          ) : htmlRegistry === null ? (
            <div className="screen">Načítání…</div>
          ) : (
            <FlowEngine
              key={flowKey}
              respondent={respondent}
              onUpdateRespondent={handleUpdateRespondent}
              registry={mergedRegistry}
              onScreenChange={setCurrentScreenId}
              renderValidationError={renderValidationError}
            />
          )
        ) : (
          <Setup onStart={handleStart} initialRespondent={respondent} configLoadError={configLoadError} />
        )}
      </div>
      {mode === "running" && respondent != null && currentScreenId && (
        <div className="screen-id-tag">{currentScreenId}</div>
      )}
      {mode === "running" && respondent != null && (
        <Overlay
          respondent={respondent}
          onEndAndClear={handleEndAndClear}
          onRestartFlow={handleRestartFlow}
        />
      )}
    </div>
  );
}
