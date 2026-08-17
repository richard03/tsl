import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  resolveActionSpec,
  type ActionSpec,
  type ButtonAction,
  type ComponentInstance,
  type ScreenDefinition,
} from "./types/screen";
import type { Data } from "./state";
import type { ComponentRegistry } from "./registry";
import { evaluateCondition, type EvalState } from "./conditions";
import { resolveProps } from "./bindings";
import { getValidationError, type ValidatorConfig } from "./validation";
import { EngineProvider, type EngineApi } from "./EngineContext";
import { applyScreenTranslations, type Translations } from "./translations";

/** Recursively checks whether any currently visible field with `validators` configured is invalid. */
function screenHasValidationErrors(
  instances: ComponentInstance[],
  state: EvalState,
  data: Data,
): boolean {
  return instances.some((instance) => {
    if (instance.visibleIf && !evaluateCondition(instance.visibleIf, state)) return false;
    const resolvedProps = resolveProps(instance.props, state);
    const validators = resolvedProps.validators as ValidatorConfig[] | undefined;
    if (validators && validators.length > 0) {
      const field = (resolvedProps.field ?? resolvedProps.variable) as string | undefined;
      const stored = field ? data[field] : undefined;
      const rawValue = stored === undefined || stored === null ? "" : String(stored);
      if (getValidationError(rawValue, validators)) return true;
    }
    return instance.children ? screenHasValidationErrors(instance.children, state, data) : false;
  });
}

/**
 * Recursively finds visible fields that have a configured `default` but no stored value yet. The
 * field itself already falls back to `default` for display, but until something writes it to
 * `data`, any other screen binding straight to `{{data.x}}` sees nothing — so the moment such a
 * field is shown, its default is persisted too.
 */
function collectUnsetFieldDefaults(
  instances: ComponentInstance[],
  state: EvalState,
  data: Data,
  registry: ComponentRegistry,
): Array<{ field: string; value: unknown }> {
  const result: Array<{ field: string; value: unknown }> = [];
  function walk(list: ComponentInstance[]) {
    for (const instance of list) {
      if (instance.visibleIf && !evaluateCondition(instance.visibleIf, state)) continue;
      const entry = registry[instance.type];
      if (entry?.field) {
        const resolvedProps = resolveProps(instance.props, state);
        const field = (resolvedProps.field ?? resolvedProps.variable) as string | undefined;
        if (field && data[field] === undefined && resolvedProps.default !== undefined) {
          result.push({ field, value: resolvedProps.default });
        }
      }
      if (instance.children) walk(instance.children);
    }
  }
  walk(instances);
  return result;
}

interface ScreenRendererProps {
  screen: ScreenDefinition;
  registry: ComponentRegistry;
  respondent: unknown;
  data: Data;
  setData: (field: string, value: unknown) => void;
  onButtonAction: (action: ButtonAction | undefined) => void;
  onBack: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdateRespondent: (updater: (r: any) => any) => void;
  /** Rendered above the screen body once a submit is attempted while validation errors remain. Injected by the host so the engine stays free of project-specific banner components/copy. */
  renderValidationError?: () => ReactNode;
  /** Loaded from `translations.properties` (empty if the file is missing) — see `applyScreenTranslations`/`EngineApi.t`. */
  translations: Translations;
}

/** Renders one screen definition against the component registry and current engine state. */
export function ScreenRenderer({
  screen,
  registry,
  respondent,
  data,
  setData,
  onButtonAction,
  onBack,
  onUpdateRespondent,
  renderValidationError,
  translations,
}: ScreenRendererProps) {
  const state: EvalState = { respondent, data };
  const [validationAttempted, setValidationAttempted] = useState(false);

  useEffect(() => {
    document.title = screen.title;
  }, [screen.title]);

  useEffect(() => {
    setValidationAttempted(false);
  }, [screen.id]);

  const allInstances = [...(screen.header ?? []), ...screen.content, ...(screen.footer ?? [])];
  const hasValidationErrors = screenHasValidationErrors(allInstances, state, data);

  useEffect(() => {
    const unset = collectUnsetFieldDefaults(allInstances, state, data, registry);
    unset.forEach(({ field, value }) => setData(field, value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.id]);

  /**
   * Zapisuje skutečnou výšku hlavičky a patičky do CSS proměnných na rámu obrazovky.
   *
   * Obojí je pozicované absolutně, aby zůstalo na místě i při rolování, takže obsah pod ním musí
   * dostat odsazení — a to se nedá napsat natvrdo: hlavička na některých obrazovkách chybí a patička
   * je jednou o jedno tlačítko, jindy o tři. Měří se proto za běhu a přepočítá, kdykoli prvek změní
   * velikost (jiný počet tlačítek, zalomený nadpis, vysunutá klávesnice).
   */
  const frameRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      frame.style.setProperty("--screen-header-height", `${headerRef.current?.offsetHeight ?? 0}px`);
      frame.style.setProperty("--screen-footer-height", `${footerRef.current?.offsetHeight ?? 0}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (headerRef.current) observer.observe(headerRef.current);
    if (footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  });

  function handleGatedAction(action: ButtonAction | undefined) {
    if (hasValidationErrors && !action?.back) {
      setValidationAttempted(true);
      return;
    }
    onButtonAction(action);
  }

  const engineApi: EngineApi = {
    data,
    respondent,
    setData,
    updateRespondent: onUpdateRespondent,
    runAction: onButtonAction,
    goBack: onBack,
    validationAttempted,
    t: (key, fallback) => translations[key] ?? fallback ?? key,
  };

  function renderInstance(instance: ComponentInstance) {
    if (instance.visibleIf && !evaluateCondition(instance.visibleIf, state)) {
      return null;
    }

    const entry = registry[instance.type];
    if (!entry) {
      return (
        <p key={instance.id} className="paragraph paragraph--muted">
          Neznámý typ komponenty: {instance.type}
        </p>
      );
    }
    const Component = entry.component;
    const translatedProps = applyScreenTranslations(screen.id, instance, translations);
    const resolvedProps = resolveProps(translatedProps, state);

    // Action components fire a ButtonAction on click. The gated one (the form submit) is
    // blocked while the screen has validation errors and additionally honours `disabledIf`.
    //
    // Children are rendered here too: a clickable element isn't necessarily a leaf — a card that
    // navigates somewhere is an ordinary pattern, and dropping its content would leave the screen
    // silently empty. A component without a `<slot>` simply ignores them.
    if (entry.action) {
      const { action: rawAction, ...visualProps } = resolvedProps as { action?: ActionSpec } & Record<string, unknown>;
      const action = resolveActionSpec(rawAction);
      const actionChildren = instance.children?.map((child) => renderInstance(child));
      if (entry.gated) {
        const disabled = instance.disabledIf ? evaluateCondition(instance.disabledIf, state) : false;
        return (
          <Component key={instance.id} {...visualProps} disabled={disabled} onClick={() => handleGatedAction(action)}>
            {actionChildren}
          </Component>
        );
      }
      return (
        <Component
          key={instance.id}
          {...visualProps}
          onClick={action ? () => onButtonAction(action) : undefined}
        >
          {actionChildren}
        </Component>
      );
    }

    // Field components read/write their value through the generic `field`/`variable` convention.
    if (entry.field) {
      const field = (resolvedProps.field ?? resolvedProps.variable) as string | undefined;
      const stored = field ? data[field] : undefined;
      const value = stored ?? resolvedProps.default;
      return (
        <Component
          key={instance.id}
          {...resolvedProps}
          value={value}
          onChange={(v: unknown) => field && setData(field, v)}
          forceShowError={entry.validatable ? validationAttempted : undefined}
        />
      );
    }

    // Everything else renders with its resolved props and nested children. Components that need
    // engine capabilities (navigation, context mutation) pull them from `useEngine()` themselves.
    const children = instance.children?.map((child) => renderInstance(child));
    return (
      <Component key={instance.id} {...resolvedProps}>
        {children}
      </Component>
    );
  }

  const header = screen.header ?? [];
  const footer = screen.footer ?? [];

  return (
    <EngineProvider value={engineApi}>
      <div className="screen-frame" ref={frameRef}>
        {header.length > 0 && (
          <div className="screen__header" ref={headerRef}>
            {header.map((i) => renderInstance(i))}
          </div>
        )}
        <div className={`screen${screen.type === "full-bleed" ? " screen--full-bleed" : ""}`}>
          <div className={`screen__body${screen.type === "centered" ? " screen__body--center" : ""}`}>
            {validationAttempted && hasValidationErrors && renderValidationError?.()}
            {screen.content.map((i) => renderInstance(i))}
          </div>
        </div>
        {footer.length > 0 && (
          <div className="screen__footer" ref={footerRef}>
            {footer.map((i) => renderInstance(i))}
          </div>
        )}
      </div>
    </EngineProvider>
  );
}
