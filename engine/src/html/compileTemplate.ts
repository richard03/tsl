/**
 * Compiles a component's `<template>` DOM into a tree of closures, once at load time. Rendering then
 * only calls closures — the DOM fragment is never walked again, and no HTML is re-parsed per render.
 */
import { createElement, Fragment, type ReactNode } from "react";
import { compileInterpolation, evaluate, hasMustache, reportOnce, type Scope } from "./expressions";

export type Render = (scope: Scope) => ReactNode;

/** Resolves a lowercased tag name to a registry component, or undefined for a plain HTML element. Called at render time, so components may reference each other regardless of load order. */
export type ResolveComponent = (lowerTag: string) => React.ComponentType<Record<string, unknown>> | undefined;

export class TemplateError extends Error {}

// ---------------------------------------------------------------------------
// Attribute / event name mapping
// ---------------------------------------------------------------------------

/** HTML attribute names that React spells differently. Anything not listed (incl. `aria-*`/`data-*`) passes through. */
const ATTR_TO_PROP: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  inputmode: "inputMode",
  maxlength: "maxLength",
  minlength: "minLength",
  readonly: "readOnly",
  colspan: "colSpan",
  rowspan: "rowSpan",
  srcset: "srcSet",
  autofocus: "autoFocus",
  autocomplete: "autoComplete",
  autoplay: "autoPlay",
  spellcheck: "spellCheck",
  contenteditable: "contentEditable",
  crossorigin: "crossOrigin",
  novalidate: "noValidate",
  enctype: "encType",
  formaction: "formAction",
  accesskey: "accessKey",
  datetime: "dateTime",
  usemap: "useMap",
  playsinline: "playsInline",
  frameborder: "frameBorder",
  allowfullscreen: "allowFullScreen",
};

/** Valueless attributes that must become `true`, not `""`. */
const BOOLEAN_ATTRS = new Set([
  "disabled", "hidden", "checked", "readonly", "required", "autofocus", "multiple", "selected",
  "open", "novalidate", "loop", "muted", "controls", "autoplay", "playsinline", "reversed",
  "ismap", "defer", "async", "allowfullscreen", "default", "inert",
]);

/** DOM event names whose React prop isn't just `on` + capitalised. */
const EVENT_TO_PROP: Record<string, string> = {
  dblclick: "onDoubleClick",
  focusin: "onFocus",
  focusout: "onBlur",
  contextmenu: "onContextMenu",
  pointerdown: "onPointerDown", pointerup: "onPointerUp", pointermove: "onPointerMove",
  pointercancel: "onPointerCancel", pointerenter: "onPointerEnter", pointerleave: "onPointerLeave",
  pointerover: "onPointerOver", pointerout: "onPointerOut",
  mousedown: "onMouseDown", mouseup: "onMouseUp", mousemove: "onMouseMove",
  mouseenter: "onMouseEnter", mouseleave: "onMouseLeave", mouseover: "onMouseOver", mouseout: "onMouseOut",
  keydown: "onKeyDown", keyup: "onKeyUp", keypress: "onKeyPress",
  touchstart: "onTouchStart", touchmove: "onTouchMove", touchend: "onTouchEnd", touchcancel: "onTouchCancel",
  animationend: "onAnimationEnd", animationstart: "onAnimationStart", transitionend: "onTransitionEnd",
  dragstart: "onDragStart", dragover: "onDragOver", dragend: "onDragEnd", dragenter: "onDragEnter",
  dragleave: "onDragLeave",
};

function eventProp(event: string): string {
  return EVENT_TO_PROP[event] ?? `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

/** `sheet-options` → `sheetOptions`. Required because the HTML parser lowercases every attribute name. */
function kebabToCamel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Resolves an attribute name to the React prop name. `aria-*`/`data-*` are passed through verbatim —
 * React expects them dashed, and camelCasing them produces an invalid attribute.
 */
function propNameFor(rawName: string, isComponentTag: boolean): string {
  if (rawName.startsWith("aria-") || rawName.startsWith("data-")) return rawName;
  return isComponentTag ? kebabToCamel(rawName) : (ATTR_TO_PROP[rawName] ?? kebabToCamel(rawName));
}

const knownTagCache = new Map<string, boolean>();

/**
 * Whether `tag` is a real HTML element. `tagName` is always uppercase in an HTML document, so the
 * source casing of `<TextInputField>` is unrecoverable — asking the DOM whether it knows the tag is
 * the only reliable way to tell "component reference" from "plain element".
 */
export function isKnownHtmlTag(tag: string): boolean {
  let known = knownTagCache.get(tag);
  if (known === undefined) {
    known = !(document.createElement(tag) instanceof HTMLUnknownElement);
    knownTagCache.set(tag, known);
  }
  return known;
}

/** Parses an inline `style` string into the object React requires. */
function parseStyle(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    out[prop.startsWith("--") ? prop : kebabToCamel(prop)] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Text: JSX whitespace semantics
// ---------------------------------------------------------------------------

/**
 * Applies JSX's exact whitespace rule to a text node: drop whitespace-only lines, strip indentation
 * after a newline, and collapse the remaining line breaks to single spaces.
 *
 * HTML preserves source indentation verbatim while JSX discards it, so without this every migrated
 * component gains stray spaces and newlines relative to the `.tsx` it replaces.
 */
function applyJsxWhitespace(text: string): string {
  const lines = text.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) lastNonEmpty = i;

  let out = "";
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/\t/g, " ");
    if (i !== 0) line = line.replace(/^ +/, "");
    if (i !== lines.length - 1) line = line.replace(/ +$/, "");
    if (!line) continue;
    if (i !== lastNonEmpty) line += " ";
    out += line;
  }
  return out;
}

const PLACEHOLDER = "\u0000";

/**
 * Applies the JSX whitespace rule without disturbing `{{ ... }}` placeholders: they're swapped for
 * a control character first (so their contents can't be reindented or split across "lines"), then
 * restored afterwards.
 */
function cleanTextKeepingMustaches(raw: string): string {
  const exprs: string[] = [];
  const masked = raw.replace(/\{\{[\s\S]+?\}\}/g, (m) => {
    exprs.push(m);
    return `${PLACEHOLDER}${exprs.length - 1}${PLACEHOLDER}`;
  });
  const cleaned = applyJsxWhitespace(masked);
  return cleaned.replace(new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, "g"), (_, i: string) => exprs[Number(i)]);
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

interface CompileOptions {
  /** Component name, used in error messages. */
  name: string;
  resolveComponent: ResolveComponent;
}

const DIRECTIVES = new Set(["data-if", "data-else-if", "data-else", "data-for", "data-key", "data-ref", "data-tag"]);

function isDirective(attr: string): boolean {
  return DIRECTIVES.has(attr) || attr.startsWith("data-let-") || attr.startsWith("data-on-");
}

/**
 * Builds the per-element prop factory (everything except children).
 *
 * `isComponentTag` switches attribute naming: a plain HTML element keeps its attribute names
 * (`class`, `aria-*`), whereas a component receives camelCased props, so `input-type="numeric"`
 * reaches `inputType` — the same dash rule `:` bindings already follow.
 */
function compileProps(
  el: Element,
  opts: CompileOptions,
  isComponentTag: boolean,
): (scope: Scope) => Record<string, unknown> {
  const statics: Record<string, unknown> = {};
  const dynamic: Array<(scope: Scope, props: Record<string, unknown>) => void> = [];
  const where = `${opts.name} <${el.tagName.toLowerCase()}>`;

  for (const attr of Array.from(el.attributes)) {
    const rawName = attr.name;
    const value = attr.value;

    if (isDirective(rawName)) {
      if (rawName.startsWith("data-on-")) {
        const prop = eventProp(rawName.slice("data-on-".length));
        const expr = value;
        dynamic.push((scope, props) => {
          props[prop] = (event: unknown) => {
            const result = evaluate(expr, { ...scope, event }, `${where} ${rawName}`);
            if (typeof result === "function") (result as (e: unknown) => void)(event);
          };
        });
      }
      continue; // structural directives are handled by the caller
    }

    // `:prop="expr"` — raw value, so functions/objects/numbers survive.
    if (rawName.startsWith(":")) {
      const bound = rawName.slice(1);
      // `:tabindex` and `:tab-index` both need to reach React's `tabIndex`; `:aria-*` stays dashed.
      const prop = propNameFor(bound, isComponentTag);
      const expr = value;
      dynamic.push((scope, props) => {
        const v = evaluate(expr, scope, `${where} :${rawName.slice(1)}`);
        if (v !== undefined) props[prop] = v;
      });
      continue;
    }

    const prop = propNameFor(rawName, isComponentTag);

    // Valueless attribute → true. On a component that's unconditional (`<Foo bar>` means `bar={true}`,
    // as in JSX); on a real element only for attributes HTML actually treats as boolean, since
    // React renders `disabled=""` as absent.
    if (value === "" && (isComponentTag || BOOLEAN_ATTRS.has(rawName))) {
      statics[prop] = true;
      continue;
    }

    if (hasMustache(value)) {
      const interp = compileInterpolation(value, `${where} ${rawName}`);
      dynamic.push((scope, props) => {
        const v = interp(scope);
        if (v === undefined || v === null) return;
        props[prop] = prop === "style" && typeof v === "string" ? parseStyle(v) : v;
      });
      continue;
    }

    statics[prop] = prop === "style" ? parseStyle(value) : value;
  }

  return (scope) => {
    const props: Record<string, unknown> = { ...statics };
    for (const apply of dynamic) apply(scope, props);
    return props;
  };
}

/** Compiles one element (already stripped of its structural directives by the caller). */
function compileElement(el: Element, opts: CompileOptions): Render {
  const lowerTag = el.tagName.toLowerCase();

  if (lowerTag === "slot") {
    return (scope) => scope.children as ReactNode;
  }

  // Computed once: an unknown-to-HTML tag is a component reference (or, if nothing resolves it, a
  // typo worth reporting). A real HTML tag never is.
  const mayBeComponent = !isKnownHtmlTag(lowerTag);

  const propsOf = compileProps(el, opts, mayBeComponent);
  const refName = el.getAttribute("data-ref");
  const tagExpr = el.getAttribute("data-tag");
  const letBindings = Array.from(el.attributes)
    .filter((a) => a.name.startsWith("data-let-"))
    .map((a) => ({ name: kebabToCamel(a.name.slice("data-let-".length)), expr: a.value }));

  const isTemplateTag = lowerTag === "template";
  const childNodes = isTemplateTag ? Array.from((el as HTMLTemplateElement).content.childNodes) : Array.from(el.childNodes);
  const children = compileChildren(childNodes, opts);

  return (scope) => {
    let effective = scope;
    if (letBindings.length) {
      // Sequential: a later data-let-* may reference an earlier one (DOM keeps attribute order).
      effective = { ...scope };
      for (const b of letBindings) {
        effective[b.name] = evaluate(b.expr, effective, `${opts.name} data-let-${b.name}`);
      }
    }

    const kids = children.map((c) => c(effective));

    // A bare <template> (no data-if/data-for) is just a transparent grouping.
    if (isTemplateTag) return createElement(Fragment, null, ...kids);

    const props = propsOf(effective);

    if (refName) {
      props.ref = (node: unknown) => {
        (effective.$refs as Record<string, unknown>)[refName] = node;
      };
    }

    let tag: string | React.ComponentType<Record<string, unknown>> = lowerTag;
    // A name computed at runtime was chosen deliberately, so it may name a component even when it
    // happens to coincide with an HTML element.
    let namedAtRuntime = false;
    if (tagExpr) {
      const resolved = evaluate(tagExpr, effective, `${opts.name} data-tag`);
      if (typeof resolved === "string" && resolved) {
        tag = resolved;
        namedAtRuntime = true;
      }
    }
    if (typeof tag === "string") {
      /**
       * A tag the HTML parser recognises is that element and nothing else.
       *
       * Consulting the registry regardless would mean a project that registers a component called
       * `Button` turns every `<button>` in every template into that component — including the one
       * inside `Button` itself, which then renders itself forever and hangs the tab with nothing in
       * the console to explain it.
       */
      const component = namedAtRuntime || mayBeComponent ? opts.resolveComponent(tag) : undefined;
      if (component) tag = component;
      else if (mayBeComponent && !tag.includes("-")) {
        reportOnce(`${opts.name}: neznámá komponenta <${tag}> — chybí v components.yaml / widgets.yaml?`);
      }
    }

    return kids.length > 0 ? createElement(tag, props, ...kids) : createElement(tag, props);
  };
}

/** Wraps a render in its `data-for` loop, if any. */
function withLoop(el: Element, inner: Render, opts: CompileOptions): Render {
  const forExpr = el.getAttribute("data-for");
  if (!forExpr) return inner;

  const m = forExpr.match(/^\s*(?:\(\s*([\w$]+)\s*,\s*([\w$]+)\s*\)|([\w$]+))\s+in\s+([\s\S]+)$/);
  if (!m) {
    throw new TemplateError(`${opts.name}: data-for="${forExpr}" — očekává se tvar "polozka in seznam" nebo "(polozka, index) in seznam".`);
  }
  const itemName = m[1] ?? m[3];
  const indexName = m[2];
  const listExpr = m[4].trim();
  const keyExpr = el.getAttribute("data-key");

  return (scope) => {
    const list = evaluate(listExpr, scope, `${opts.name} data-for`);
    if (!Array.isArray(list)) return null;
    return list.map((item, i) => {
      const child: Scope = { ...scope, [itemName]: item };
      if (indexName) child[indexName] = i;
      const key = keyExpr ? evaluate(keyExpr, child, `${opts.name} data-key`) : i;
      return createElement(Fragment, { key: key as React.Key }, inner(child));
    });
  };
}

/**
 * Compiles a list of sibling nodes, collapsing each `data-if` / `data-else-if` / `data-else` run
 * into a single conditional closure.
 */
function compileChildren(nodes: Node[], opts: CompileOptions): Render[] {
  const out: Render[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.nodeType === Node.COMMENT_NODE) continue;

    if (node.nodeType === Node.TEXT_NODE) {
      const cleaned = cleanTextKeepingMustaches(node.textContent ?? "");
      if (!cleaned) continue;
      if (hasMustache(cleaned)) {
        const interp = compileInterpolation(cleaned, `${opts.name} text`);
        out.push((scope) => {
          const v = interp(scope);
          return v === undefined || v === null || v === false ? null : (v as ReactNode);
        });
      } else {
        out.push(() => cleaned);
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;

    if (el.hasAttribute("data-else-if") || el.hasAttribute("data-else")) {
      throw new TemplateError(`${opts.name}: <${el.tagName.toLowerCase()}> má data-else/-else-if bez předcházejícího data-if.`);
    }

    const ifExpr = el.getAttribute("data-if");
    const self = withLoop(el, compileElement(el, opts), opts);

    if (!ifExpr) {
      out.push(self);
      continue;
    }

    // Collect the else-if / else siblings that continue this chain (skipping whitespace text).
    const branches: Array<{ cond: string | null; render: Render }> = [{ cond: ifExpr, render: self }];
    let j = i + 1;
    while (j < nodes.length) {
      const n = nodes[j];
      if (n.nodeType === Node.TEXT_NODE && !(n.textContent ?? "").trim()) { j++; continue; }
      if (n.nodeType === Node.COMMENT_NODE) { j++; continue; }
      if (n.nodeType !== Node.ELEMENT_NODE) break;
      const cand = n as Element;
      const elseIf = cand.getAttribute("data-else-if");
      const hasElse = cand.hasAttribute("data-else");
      if (!elseIf && !hasElse) break;
      branches.push({ cond: elseIf ?? null, render: withLoop(cand, compileElement(cand, opts), opts) });
      i = j;
      j++;
      if (hasElse) break;
    }

    out.push((scope) => {
      for (const b of branches) {
        if (b.cond === null) return b.render(scope);
        if (evaluate(b.cond, scope, `${opts.name} data-if`)) return b.render(scope);
      }
      return null;
    });
  }

  return out;
}

/** Compiles a `<template>`'s content into a single render function. */
export function compileTemplate(fragment: DocumentFragment, opts: CompileOptions): Render {
  const children = compileChildren(Array.from(fragment.childNodes), opts);
  if (children.length === 1) return children[0];
  return (scope) => createElement(Fragment, null, ...children.map((c) => c(scope)));
}
