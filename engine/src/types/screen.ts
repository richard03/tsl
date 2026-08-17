export interface Condition {
  field: string;
  equals?: unknown;
  notEquals?: unknown;
  includes?: unknown;
  /** True when `field` resolves to one of the listed values — the "is one of" counterpart to `equals`. Note the direction: `includes` asks whether the field's array contains a value, `in` asks whether the field's value is in a list. */
  in?: unknown[];
  truthy?: boolean;
  /** True when `field` resolves to an array with at least one element satisfying every one of these conditions (their own `field` resolved against that element, not the outer state). */
  some?: Condition[];
}

export type Bindable<T = unknown> = T | { $bind: string };

/**
 * Behavior run when a ButtonTextAction/ListItemAction is pressed: optionally write values
 * into session `data` first, then either return to the previous screen (`back`, same as the
 * PageHeaderBar back/close button), jump straight to `goto` (an explicit screen id, ignoring
 * the current screen's `next` rules), or, unless `next` is `false`, advance via the flow's
 * `next` rules for the current screen — evaluated against the just-written data.
 */
export interface ButtonAction {
  setData?: Record<string, unknown>;
  next?: boolean;
  goto?: string;
  back?: boolean;
}

/**
 * What a screen YAML `action:` attribute may contain. The bare strings `next`/`back` are shorthand
 * for `{ next: true }`/`{ back: true }` — the two common no-`setData` cases (an ordinary "continue"
 * button, or a "cancel"/"back" button) — and read better in YAML than an object with one key.
 */
export type ActionSpec = ButtonAction | "next" | "back";

/** Normalizes a resolved `action` prop (as read from screen YAML) into a `ButtonAction`. */
export function resolveActionSpec(spec: ActionSpec | undefined): ButtonAction | undefined {
  if (spec === "next") return { next: true };
  if (spec === "back") return { back: true };
  return spec;
}

export interface ComponentInstance {
  id: string;
  type: string;
  /** Omit entirely for parameterless components (e.g. Divider). */
  props?: Record<string, unknown>;
  /** A bare list is AND — visible/disabled only when every condition in it passes. */
  visibleIf?: Condition | Condition[];
  disabledIf?: Condition | Condition[];
  /** Nested component instances, rendered as this component's React children (e.g. GroupShell). */
  children?: ComponentInstance[];
}

export interface ScreenDefinition {
  id: string;
  title: string;
  type?: "form" | "centered" | "full-bleed";
  /** Components rendered in a bar docked to the top of the screen (e.g. PageHeaderBar). */
  header?: ComponentInstance[];
  content: ComponentInstance[];
  /** Buttons rendered in a bar docked to the bottom of the screen. Omit to keep buttons inline in `components`. */
  footer?: ComponentInstance[];
}
