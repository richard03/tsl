import type { Condition } from "./types/screen";
import type { Data } from "./state";
import { resolvePath } from "./path";

export interface EvalState {
  /** Opaque per-run context data, bound in YAML via the `respondent.*` namespace. */
  respondent: unknown;
  /** Session data written by fields and actions, bound in YAML via the `data.*` namespace. */
  data: Data;
}

/** Evaluates a condition against an arbitrary root (either the top-level `EvalState` or, for `some`, one array element). */
function evaluateAgainst(condition: Condition, root: unknown): boolean {
  const value = resolvePath(root, condition.field);

  if (condition.some) {
    return Array.isArray(value) && value.some((item) => condition.some!.every((c) => evaluateAgainst(c, item)));
  }
  if (condition.equals !== undefined) return value === condition.equals;
  if (condition.notEquals !== undefined) return value !== condition.notEquals;
  if (condition.includes !== undefined) {
    return Array.isArray(value) && value.includes(condition.includes);
  }
  if (condition.in !== undefined) {
    return Array.isArray(condition.in) && condition.in.includes(value);
  }
  if (condition.truthy !== undefined) {
    return condition.truthy ? Boolean(value) : !value;
  }
  return Boolean(value);
}

/** Evaluates a single visibility/flow condition against the current engine state. */
export function evaluateCondition(condition: Condition, state: EvalState): boolean {
  return evaluateAgainst(condition, state);
}

/** Returns true when every condition in the list passes. */
export function evaluateAll(conditions: Condition[], state: EvalState): boolean {
  return conditions.every((c) => evaluateCondition(c, state));
}

/**
 * Evaluates conditions with a single array element as the root (so `field: bank` reads `item.bank`).
 * Lets project components filter arrays by a config `where` (domain predicates live in YAML, engine
 * stays domain-agnostic). Empty/absent conditions match everything.
 */
export function matchesItem(item: unknown, conditions?: Condition[]): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evaluateAgainst(c, item));
}
