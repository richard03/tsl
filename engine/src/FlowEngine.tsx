import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ButtonAction, ScreenDefinition } from "./types/screen";
import type { FlowConfig, FlowNode } from "./types/flow";
import type { ComponentRegistry } from "./registry";
import { evaluateAll, type EvalState } from "./conditions";
import { parseFlowYaml, parseScreenYaml } from "./screenYaml";
import { parseTranslations, type Translations } from "./translations";
import { AlertMessage } from "./setup/ui/AlertMessage";
import { ScreenRenderer } from "./ScreenRenderer";
import { navigateToScreen, replaceUrlWithScreen, screenIdFromUrl } from "./router";
import { loadData, saveData, loadCurrentScreenId, saveCurrentScreenId, type Data } from "./state";

interface FlowEngineProps {
  respondent: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdateRespondent: (updater: (r: any) => any) => void;
  registry: ComponentRegistry;
  onScreenChange?: (screenId: string) => void;
  /** Injected banner shown when a submit is attempted with validation errors still present (see ScreenRenderer). */
  renderValidationError?: () => ReactNode;
}

interface LoadedConfig {
  flow: FlowConfig;
  screensById: Map<string, ScreenDefinition>;
  translations: Translations;
}

/** Resolves the next screen id from a flow node against the current evaluation state. */
function resolveNext(node: FlowNode, state: EvalState): string | null {
  if (node.next === null) return null;
  if (typeof node.next === "string") return node.next;

  let fallback: string | null = null;
  for (const rule of node.next) {
    if (rule.default) {
      fallback = rule.goto;
      continue;
    }
    if (rule.when && evaluateAll(rule.when, state)) {
      return rule.goto;
    }
  }
  return fallback;
}

/**
 * Fetches one screen definition, named after its id in `flow.yaml`.
 *
 * A dev server (and any host with an SPA rewrite) answers a missing file with `index.html` and
 * status 200. Handing that to the YAML parser produces a parse error pointing at a `<meta>` tag,
 * which sends whoever reads it looking in entirely the wrong place — so the disguise is stripped
 * here and reported as what it is: the screen file isn't there.
 */
async function fetchScreen(base: string, id: string): Promise<string> {
  const path = `screens/${id}.yaml`;
  const text = await fetchText(`${base}${path}`);
  if (/^s*<(!doctype|html)/i.test(text)) {
    throw new Error(`${path}: soubor neexistuje (server místo něj vrátil index.html)`);
  }
  return text;
}

/** Fetches a text resource and throws on non-OK HTTP status. Bypasses the browser cache — this is a user-testing prototype, so a moderator re-uploading a config file must take effect immediately. */
export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** Loads flow + screen YAML and drives navigation, session data, and screen rendering. */
export function FlowEngine({ respondent, onUpdateRespondent, registry, onScreenChange, renderValidationError }: FlowEngineProps) {
  const [config, setConfig] = useState<LoadedConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setDataStore] = useState<Data>(() => loadData());
  const [currentScreenId, setCurrentScreenId] = useState<string | null>(() => loadCurrentScreenId());
  const autoAdvanceTimer = useRef<number | null>(null);
  /** Screen ids, known only once the flow has loaded; the router needs them to read/write URLs. */
  const screenIds = useMemo(() => new Set(config ? [...config.screensById.keys()] : []), [config]);
  /** URL shape for screens; `path` needs the .htaccess rewrite, `query` needs no server config. */
  const routing = config?.flow.routing ?? "path";

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL;

    async function load() {
      const flow = parseFlowYaml(await fetchText(`${base}flow.yaml`), "flow.yaml");
      // Types the project flagged as domain widgets — they must be referenced as `Widget <Type> <id>`.
      const widgetTypes = new Set(Object.keys(registry).filter((t) => registry[t].widget));
      const screenIds = Array.from(new Set(flow.nodes.map((n) => n.screenId)));
      const [screens, translations] = await Promise.all([
        Promise.all(
          screenIds.map(async (id) => parseScreenYaml(await fetchScreen(base, id), `${id}.yaml`, widgetTypes)),
        ),
        // Optional — a missing translations.properties shouldn't break the app, just leave every
        // lookup falling back to whatever fallback text the caller supplied.
        fetchText(`${base}translations.properties`)
          .then(parseTranslations)
          .catch(() => ({})),
      ]);
      if (cancelled) return;
      const screensById = new Map(screens.map((s) => [s.id, s]));
      setConfig({ flow, screensById, translations });

      // The URL is the source of truth: after a real navigation — including the browser's back
      // button — it names the screen to show, while the stored id still points at wherever the run
      // had got to. Falling back to storage keeps a bare app URL resuming an interrupted run.
      const ids = new Set(screensById.keys());
      const fromUrl = screenIdFromUrl(ids);
      const resolved = fromUrl ?? (currentScreenId && ids.has(currentScreenId) ? currentScreenId : flow.start);
      if (resolved !== currentScreenId) setCurrentScreenId(resolved);
      saveCurrentScreenId(resolved);
      // Give the entry URL a screen segment too, so every screen is addressable and reloadable.
      replaceUrlWithScreen(resolved, ids, flow.routing ?? "path");
    }

    load().catch((e) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nodesById = useMemo(() => {
    const map = new Map<string, FlowNode>();
    config?.flow.nodes.forEach((n) => map.set(n.screenId, n));
    return map;
  }, [config]);

  /** Writes a single key into session data and persists it. */
  function setData(field: string, value: unknown) {
    setDataStore((prev) => {
      const next = { ...prev, [field]: value };
      saveData(next);
      return next;
    });
  }

  /**
   * Navigates to `targetScreenId` with a real page load, so the screen change is a genuine browser
   * navigation (own URL, own history entry, visible to page-level analytics). The screen is stored
   * first because the app re-reads it after the reload.
   */
  function goToScreen(targetScreenId: string) {
    if (!currentScreenId || targetScreenId === currentScreenId) return;
    saveCurrentScreenId(targetScreenId);
    navigateToScreen(targetScreenId, screenIds, routing);
  }

  /** Advances via the current screen's flow `next` rules. */
  function advance(dataForEval: Data) {
    if (!currentScreenId) return;
    const node = nodesById.get(currentScreenId);
    if (!node) return;
    const nextId = resolveNext(node, { respondent, data: dataForEval });
    if (!nextId) return;
    goToScreen(nextId);
  }

  /** Advances using the currently stored session data. */
  function goNext() {
    advance(data);
  }

  /** Applies an optional `setData` patch, then navigates via back / goto / next. */
  function runButtonAction(action: ButtonAction | undefined) {
    let dataForEval = data;
    if (action?.setData && Object.keys(action.setData).length > 0) {
      dataForEval = { ...data, ...action.setData };
      setDataStore(dataForEval);
      saveData(dataForEval);
    }
    if (action?.back) {
      goBack();
      return;
    }
    if (action?.goto) {
      goToScreen(action.goto);
      return;
    }
    if (action?.next === false) return;
    advance(dataForEval);
  }

  /**
   * Goes back through the browser's own history, which is now the flow's history — every forward
   * step was a real navigation, so the in-app back button and the browser's agree by construction.
   */
  function goBack() {
    window.history.back();
  }

  useEffect(() => {
    if (autoAdvanceTimer.current) {
      window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (!currentScreenId) return;
    const node = nodesById.get(currentScreenId);
    if (node?.autoAdvanceMs) {
      autoAdvanceTimer.current = window.setTimeout(() => {
        goNext();
      }, node.autoAdvanceMs);
    }
    return () => {
      if (autoAdvanceTimer.current) {
        window.clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreenId, nodesById]);

  useEffect(() => {
    if (currentScreenId) onScreenChange?.(currentScreenId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreenId]);

  if (error) {
    return <div className="screen">Nepodařilo se načíst konfiguraci: {error}</div>;
  }

  if (!config || !currentScreenId) {
    return <div className="screen">Načítání…</div>;
  }

  const screen = config.screensById.get(currentScreenId);
  if (!screen) {
    return <div className="screen">Neznámá obrazovka: {currentScreenId}</div>;
  }

  return (
    <ScreenRenderer
      screen={screen}
      registry={registry}
      respondent={respondent}
      data={data}
      setData={setData}
      onButtonAction={runButtonAction}
      onBack={goBack}
      onUpdateRespondent={onUpdateRespondent}
      renderValidationError={
        renderValidationError ??
        (() => (
          <AlertMessage
            intent="error"
            text={config.translations["engine.validationError"] ?? "Ve formuláři se vyskytly chyby"}
          />
        ))
      }
      translations={config.translations}
    />
  );
}
