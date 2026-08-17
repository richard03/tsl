import { load } from "js-yaml";
import type { ComponentInstance, Condition, ScreenDefinition } from "./types/screen";
import type { FlowConfig } from "./types/flow";

/**
 * Screen YAML format: a `structure` section describing only nesting
 * (each node is "ComponentType instanceId", children as a nested list),
 * and a flat `attributes` section keyed by instance id. Reserved
 * attribute keys `$visibleIf`/`$disabledIf` map to instance conditions;
 * everything else becomes component props.
 */
interface ScreenYamlDoc {
  id: string;
  title: string;
  type?: "form" | "centered" | "full-bleed";
  structure?: {
    header?: unknown[];
    content?: unknown[];
    footer?: unknown[];
  };
  attributes?: Record<string, Record<string, unknown>>;
}

class ScreenYamlError extends Error {}

function parseNode(
  node: unknown,
  attributes: Record<string, Record<string, unknown>>,
  usedIds: Set<string>,
  screenId: string,
  widgetTypes: Set<string>,
  autoId: { current: number },
): ComponentInstance {
  let spec: string;
  let childrenRaw: unknown[] | undefined;

  if (typeof node === "string") {
    spec = node;
  } else if (node !== null && typeof node === "object" && !Array.isArray(node)) {
    const entries = Object.entries(node as Record<string, unknown>);
    if (entries.length !== 1) {
      throw new ScreenYamlError(
        `${screenId}: uzel struktury musí mít právě jeden klíč ("Typ id"), nalezeno: ${entries.map(([k]) => k).join(", ")}`,
      );
    }
    spec = entries[0][0];
    const value = entries[0][1];
    if (value !== null && !Array.isArray(value)) {
      throw new ScreenYamlError(`${screenId}: potomci uzlu "${spec}" musí být seznam`);
    }
    childrenRaw = (value as unknown[] | null) ?? undefined;
  } else {
    throw new ScreenYamlError(`${screenId}: neplatný uzel struktury: ${JSON.stringify(node)}`);
  }

  // Two node shapes: `Component id` (universal primitive) and `Widget Component id` (domain
  // widget). The `Widget` prefix must match the registry's `widget` flag — it makes the YAML
  // say at a glance which nodes are primitives and which are domain-specific composites. The id
  // itself may be omitted (just "Component" / "Widget Component") for nodes nothing else needs to
  // reference — no attributes, no $visibleIf/$disabledIf — typically Dividers; one is generated.
  const parts = spec.trim().split(/\s+/);
  const isWidgetNode = parts[0] === "Widget";
  const bare = isWidgetNode ? parts.slice(1) : parts;
  if (bare.length !== 1 && bare.length !== 2) {
    throw new ScreenYamlError(
      `${screenId}: uzel "${spec}" musí mít tvar "Typ" nebo "Typ id"${isWidgetNode ? " (za klíčovým slovem Widget)" : ""}`,
    );
  }
  const [type, explicitId] = bare;
  if (isWidgetNode && !widgetTypes.has(type)) {
    throw new ScreenYamlError(`${screenId}: "${type}" není widget – napiš "${spec.replace(/^Widget\s+/, "")}" bez klíčového slova Widget`);
  }
  if (!isWidgetNode && widgetTypes.has(type)) {
    throw new ScreenYamlError(`${screenId}: "${type}" je widget – napiš "Widget ${spec}"`);
  }
  const id = explicitId ?? `${type}#${autoId.current++}`;
  usedIds.add(id);

  const attrs = attributes[id] ?? {};
  const { $visibleIf, $disabledIf, ...props } = attrs;

  const instance: ComponentInstance = { id, type, props };
  if ($visibleIf) instance.visibleIf = $visibleIf as Condition | Condition[];
  if ($disabledIf) instance.disabledIf = $disabledIf as Condition | Condition[];
  if (childrenRaw) {
    instance.children = childrenRaw.map((child) => parseNode(child, attributes, usedIds, screenId, widgetTypes, autoId));
  }
  return instance;
}

export function parseScreenYaml(yamlText: string, sourceName: string, widgetTypes: Set<string> = new Set()): ScreenDefinition {
  const doc = load(yamlText) as ScreenYamlDoc;
  if (!doc || typeof doc !== "object") {
    throw new ScreenYamlError(`${sourceName}: soubor neobsahuje YAML objekt`);
  }
  if (!doc.id) throw new ScreenYamlError(`${sourceName}: chybí "id"`);

  /**
   * `structure` must be sections, not a bare list of components.
   *
   * Writing the list directly under `structure` reads perfectly naturally, and used to produce a
   * screen with nothing on it: `structure.content` was simply `undefined`, so the screen rendered
   * its title and nothing else, with nothing anywhere saying why.
   */
  const structure = doc.structure;
  if (structure !== undefined) {
    if (Array.isArray(structure)) {
      throw new ScreenYamlError(
        `${sourceName}: "structure" musí obsahovat sekce (header, content, footer), ne rovnou seznam prvků — obal seznam do "content:"`,
      );
    }
    if (typeof structure !== "object" || structure === null) {
      throw new ScreenYamlError(`${sourceName}: "structure" musí být objekt se sekcemi header/content/footer`);
    }
    const SECTIONS = ["header", "content", "footer"];
    if ("components" in structure) {
      throw new ScreenYamlError(`${sourceName}: sekce "components" se nově jmenuje "content" — přejmenuj ji ve "structure".`);
    }
    const unknown = Object.keys(structure).filter((key) => !SECTIONS.includes(key));
    if (unknown.length > 0) {
      throw new ScreenYamlError(
        `${sourceName}: neznámé sekce ve "structure": ${unknown.join(", ")} (povolené jsou ${SECTIONS.join(", ")})`,
      );
    }
  }

  const attributes = doc.attributes ?? {};
  const usedIds = new Set<string>();
  const autoId = { current: 0 };

  const parseSection = (nodes: unknown[] | undefined) =>
    nodes?.map((node) => parseNode(node, attributes, usedIds, doc.id, widgetTypes, autoId));

  const header = parseSection(doc.structure?.header);
  const content = parseSection(doc.structure?.content) ?? [];
  const footer = parseSection(doc.structure?.footer);

  const orphans = Object.keys(attributes).filter((id) => !usedIds.has(id));
  if (orphans.length > 0) {
    throw new ScreenYamlError(
      `${doc.id}: atributy odkazují na id, která nejsou ve struktuře: ${orphans.join(", ")} (překlep?)`,
    );
  }

  const screen: ScreenDefinition = { id: doc.id, title: doc.title ?? doc.id, content };
  if (doc.type) screen.type = doc.type;
  if (header && header.length > 0) screen.header = header;
  if (footer && footer.length > 0) screen.footer = footer;
  return screen;
}

export function parseFlowYaml(yamlText: string, sourceName: string): FlowConfig {
  const doc = load(yamlText) as FlowConfig;
  if (!doc || typeof doc !== "object" || !doc.start || !Array.isArray(doc.nodes)) {
    throw new ScreenYamlError(`${sourceName}: flow musí obsahovat "start" a seznam "nodes"`);
  }
  return doc;
}
