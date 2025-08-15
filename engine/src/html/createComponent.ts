/**
 * Turns a parsed component definition into a React component. Built once per file at load time —
 * creating it during a render would give the element a new type on every parent render, remounting
 * the subtree and throwing away local state.
 */
import { createElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useEngine } from "../EngineContext";
import type { Render } from "./compileTemplate";
import type { Scope } from "./expressions";

/** The object a component file's `<script>` default-exports. Everything is optional. */
export interface ComponentDefinition {
  field?: boolean;
  action?: boolean;
  gated?: boolean;
  validatable?: boolean;
  defaults?: Record<string, unknown>;
  state?: Record<string, unknown>;
  compute?: (ctx: Ctx) => Record<string, unknown> | undefined;
  on?: Record<string, (ctx: Ctx, ...args: unknown[]) => unknown>;
  effects?: EffectSpec[];
  layoutEffects?: EffectSpec[];
}

export interface EffectSpec {
  /**
   * Dependency list — mandatory, and must always be the same length. Without it, an effect that
   * writes into engine data would re-trigger itself forever and hang the tab.
   */
  watch: (ctx: Ctx) => unknown[];
  run: (ctx: Ctx) => void | (() => void);
}

export interface Ctx {
  props: Record<string, unknown>;
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void;
  derived: Record<string, unknown>;
  engine: ReturnType<typeof useEngine>;
  t: ReturnType<typeof useEngine>["t"];
  lib: Record<string, unknown>;
  /** Mutable, non-reactive scratch space — for values that must not trigger a re-render, e.g. an in-flight pointer id. */
  self: Record<string, unknown>;
  refs: Record<string, unknown>;
  uid: string;
  base: string;
}

/** Renders-per-millisecond ceiling; trips on a runaway effect→setState→effect cycle and names the culprit. */
const RENDER_BUDGET = 60;

export function createComponent(
  name: string,
  def: ComponentDefinition,
  render: Render,
  lib: Record<string, unknown>,
  base: string,
): ComponentType<Record<string, unknown>> {
  const effects = def.effects ?? [];
  const layoutEffects = def.layoutEffects ?? [];
  const handlerNames = Object.keys(def.on ?? {});

  function HtmlComponent(props: Record<string, unknown>): ReactNode {
    const engine = useEngine();
    const [state, setStateRaw] = useState<Record<string, unknown>>(() => ({ ...(def.state ?? {}) }));
    const self = useRef<Record<string, unknown>>({}).current;
    const refs = useRef<Record<string, unknown>>({}).current;
    const uid = useId();
    const ctxRef = useRef<Ctx | null>(null);
    const renderCount = useRef({ tick: 0, count: 0 });

    const now = Date.now();
    if (now === renderCount.current.tick) {
      if (++renderCount.current.count > RENDER_BUDGET) {
        throw new Error(
          `Komponenta "${name}" se překreslila ${RENDER_BUDGET}× během jedné milisekundy — ` +
            `pravděpodobně efekt bez správného "watch" zapisuje data, která ho hned zase spustí.`,
        );
      }
    } else {
      renderCount.current = { tick: now, count: 1 };
    }

    const setState = useCallback(
      (patch: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
        setStateRaw((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) }));
      },
      [],
    );

    // Handlers keep a stable identity (so they don't invalidate memoised children) but read the
    // current ctx through the ref, which is refreshed below on every render.
    const handlers = useMemo(() => {
      const out: Record<string, unknown> = {};
      for (const key of handlerNames) {
        out[key] = (...args: unknown[]) => def.on![key](ctxRef.current!, ...args);
      }
      return out;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A `$bind` that resolves to nothing arrives as an explicitly-undefined prop, and a plain spread
    // would let it overwrite the default — turning "not set yet" into `undefined` and, downstream,
    // into NaN. An unresolved binding means the same as an absent prop: fall back to the default.
    const merged = useMemo(() => {
      const out: Record<string, unknown> = { ...(def.defaults ?? {}) };
      for (const [key, value] of Object.entries(props)) {
        if (value !== undefined) out[key] = value;
      }
      return out;
    }, [props]);

    const ctx: Ctx = {
      props: merged,
      state,
      setState,
      derived: {},
      engine,
      t: engine.t,
      lib,
      self,
      refs,
      uid,
      base,
    };
    ctx.derived = (def.compute ? def.compute(ctx) : undefined) ?? {};
    ctxRef.current = ctx;

    // Constant-length loops over arrays fixed at load time, so the hook order never changes.
    for (const spec of effects) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useEffect(() => {
        const cleanup = spec.run(ctxRef.current!);
        return typeof cleanup === "function" ? cleanup : undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, spec.watch(ctx));
    }
    for (const spec of layoutEffects) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useLayoutEffect(() => {
        const cleanup = spec.run(ctxRef.current!);
        return typeof cleanup === "function" ? cleanup : undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, spec.watch(ctx));
    }

    const scope: Scope = {
      ...merged,
      ...state,
      ...ctx.derived,
      ...handlers,
      t: engine.t,
      lib,
      engine,
      uid,
      base,
      children: merged.children,
      $refs: refs,
    };

    return render(scope);
  }

  HtmlComponent.displayName = `Html(${name})`;
  return HtmlComponent;
}

/** Stand-in for a component that failed to load or compile — keeps the rest of the screen alive. */
export function createErrorComponent(name: string, message: string): ComponentType<Record<string, unknown>> {
  function HtmlComponentError(): ReactNode {
    return createElement(
      "div",
      {
        style: {
          border: "1px solid #c00",
          background: "#fff5f5",
          color: "#900",
          padding: "8px",
          font: "12px/1.4 monospace",
          whiteSpace: "pre-wrap",
        },
      },
      `Komponenta ${name} se nenačetla:\n${message}`,
    );
  }
  HtmlComponentError.displayName = `HtmlError(${name})`;
  return HtmlComponentError;
}
