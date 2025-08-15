import { createContext, useContext } from "react";
import type { ButtonAction } from "./types/screen";
import type { Data } from "./state";

/**
 * Engine capabilities exposed to any rendered component via `useEngine()`. This is the
 * extension point domain components use instead of the renderer special-casing them:
 * a component that needs to mutate the flow's context data or fire a navigation action
 * pulls the relevant callback from here.
 */
export interface EngineApi {
  /** Session data written by fields and `setData` actions (YAML namespace `data.*`). */
  data: Data;
  /** Opaque per-run context data (bound in YAML via the `respondent.*` namespace). */
  respondent: unknown;
  /** Writes a single key into session data. */
  setData: (field: string, value: unknown) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateRespondent: (updater: (r: any) => any) => void;
  runAction: (action: ButtonAction | undefined) => void;
  goBack: () => void;
  /** True once a blocked submit has revealed field errors, so fields can force-show them. */
  validationAttempted: boolean;
  /**
   * Looks up `key` in `translations.properties` (loaded at runtime, no rebuild needed). `fallback`
   * — normally the text that used to be hardcoded here — is shown if the key isn't translated yet,
   * so a missing/renamed translations file never surfaces a raw key to the tester.
   */
  t: (key: string, fallback?: string) => string;
}

const noop = () => {};

const EngineContext = createContext<EngineApi>({
  data: {},
  respondent: null,
  setData: noop,
  updateRespondent: noop,
  runAction: noop,
  goBack: noop,
  validationAttempted: false,
  t: (key, fallback) => fallback ?? key,
});

export const EngineProvider = EngineContext.Provider;

/** Returns the engine API for the current flow render tree. */
export function useEngine(): EngineApi {
  return useContext(EngineContext);
}
