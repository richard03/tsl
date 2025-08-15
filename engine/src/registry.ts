import type { ComponentType } from "react";

export interface RegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  /** Value is stored/read via the generic `field`/`variable` convention; the renderer injects `value` + `onChange`. */
  field?: boolean;
  /** Fires a ButtonAction on click; the renderer injects `onClick` derived from the resolved `action` prop. */
  action?: boolean;
  /** An action component whose click is blocked while the screen has validation errors (the form submit). Also honours `disabledIf`. */
  gated?: boolean;
  /** Supports the `validators`/`forceShowError` contract (only meaningful together with `field`). */
  validatable?: boolean;
  /**
   * Marks a domain-specific composite ("widget") as opposed to a universal primitive ("component").
   * Purely a readability contract: such a type must be referenced in YAML as `Widget <Type> <id>`,
   * and a plain `<Type> <id>` reference is rejected (see `parseScreenYaml`). Set by the project.
   */
  widget?: boolean;
}

/**
 * Maps a component type name (as referenced in screen YAML) to its React component plus the
 * wiring metadata the engine needs. The engine is domain-agnostic: it never names concrete
 * component types, it only reads these flags. A prototype contributes its own entries and
 * merges them with the universal ones (see `src/prototype/registry.ts`).
 */
export type ComponentRegistry = Record<string, RegistryEntry>;
