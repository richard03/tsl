/**
 * Expression evaluation for HTML component templates.
 *
 * `{{ ... }}` here is plain JavaScript evaluated against the template scope — deliberately NOT the
 * engine's `interpolate()` from `bindings.ts`, which is a path lookup that also auto-formats numbers
 * with thousands separators. Screen YAML keeps that behaviour; component templates must not, or
 * every raw number a component computes would silently gain spaces.
 */

export type Scope = Record<string, unknown>;

/** Compiled expressions are cached by source text — templates re-evaluate the same handful constantly. */
const cache = new Map<string, (scope: Scope) => unknown>();

/**
 * Identifiers that must keep resolving to the real global rather than to a (missing) scope entry.
 * Everything else is claimed by the scope proxy below.
 */
const REAL_GLOBALS = new Set([
  "Math", "JSON", "Date", "Number", "String", "Boolean", "Array", "Object", "RegExp", "Intl", "Map", "Set",
  "isNaN", "isFinite", "parseInt", "parseFloat", "encodeURIComponent", "decodeURIComponent", "console",
  "undefined", "NaN", "Infinity",
]);

const proxyCache = new WeakMap<Scope, Scope>();

/**
 * Wraps a scope so `with(...)` resolves *every* non-global identifier through it — an absent optional
 * prop then evaluates to `undefined`, exactly as a destructured JSX prop would, instead of throwing
 * `ReferenceError`. Without this, templates would have to declare every optional prop in `defaults`.
 */
function scopeProxy(scope: Scope): Scope {
  const cached = proxyCache.get(scope);
  if (cached) return cached;
  const proxy = new Proxy(scope, {
    // Symbols (notably Symbol.unscopables) must fall through, or `with` misbehaves.
    has: (_target, key) => (typeof key === "symbol" ? false : !REAL_GLOBALS.has(key)),
    get: (target, key) => (target as Record<string | symbol, unknown>)[key],
  });
  proxyCache.set(scope, proxy);
  return proxy;
}

/**
 * Compiles `expr` into a function of the template scope. `with(scope)` is what lets templates name
 * loop variables and `data-let-*` bindings that aren't known until render; a `Function` body is
 * sloppy-mode by default, so `with` is legal here even though the surrounding module is strict.
 */
function compile(expr: string): (scope: Scope) => unknown {
  const cached = cache.get(expr);
  if (cached) return cached;
  let fn: (scope: Scope) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const raw = new Function("$scope", `with($scope){return (${expr})}`) as (scope: Scope) => unknown;
    fn = raw;
  } catch (e) {
    // A syntax error is a permanent property of the source — report once, then evaluate to undefined.
    fn = () => {
      void e;
      return undefined;
    };
    reportOnce(`syntaxe výrazu {{ ${expr} }}: ${String(e)}`);
  }
  cache.set(expr, fn);
  return fn;
}

const reported = new Set<string>();

/** Logs a given message only the first time — a broken expression in a loop would otherwise flood the console. */
export function reportOnce(message: string): void {
  if (reported.has(message)) return;
  reported.add(message);
  console.error(`[html-komponenta] ${message}`);
}

/**
 * Evaluates `expr` against `scope`. A throwing expression yields `undefined` and one console error —
 * one bad binding blanks its own value instead of taking down the whole screen.
 */
export function evaluate(expr: string, scope: Scope, where: string): unknown {
  try {
    return compile(expr)(scopeProxy(scope));
  } catch (e) {
    reportOnce(`${where}: výraz {{ ${expr} }} selhal: ${String(e)}`);
    return undefined;
  }
}

const MUSTACHE = /\{\{([\s\S]+?)\}\}/g;

/** True when `text` contains at least one `{{ ... }}` placeholder. */
export function hasMustache(text: string): boolean {
  MUSTACHE.lastIndex = 0;
  return MUSTACHE.test(text);
}

/**
 * Compiles a string containing `{{ ... }}` into a scope function. A string that is *entirely* one
 * placeholder returns the raw value (so `title="{{count}}"` can yield a number, and an attribute
 * bound to `undefined` can be dropped); anything else is concatenated into a string.
 */
export function compileInterpolation(text: string, where: string): (scope: Scope) => unknown {
  const parts: Array<string | { expr: string }> = [];
  let last = 0;
  MUSTACHE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MUSTACHE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ expr: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  if (parts.length === 1 && typeof parts[0] === "object") {
    const { expr } = parts[0];
    return (scope) => evaluate(expr, scope, where);
  }
  return (scope) =>
    parts
      .map((p) => {
        if (typeof p === "string") return p;
        const v = evaluate(p.expr, scope, where);
        return v === undefined || v === null ? "" : String(v);
      })
      .join("");
}
