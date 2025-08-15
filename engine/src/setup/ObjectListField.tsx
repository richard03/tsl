/**
 * A list of composite objects — the `objectList` field type.
 *
 * This is what makes things like the respondent's loans configurable: the item's fields, how the
 * list is split into groups, what each row shows and what the group totals are all come from
 * `setup.yaml` rather than from code.
 */
import { useRef, useState } from "react";
import { matchesItem } from "../conditions";
import { formatThousands } from "../format";
import type { FieldSpec, ItemSpec } from "./schema";
import { applySuggestions, defaultsFromSchema, stripHiddenFields } from "./schema";
import { SchemaForm } from "./SchemaForm";
import { DataRowValue } from "./ui/DataRowValue";
import { Divider } from "./ui/Divider";
import { TitleText } from "./ui/TitleText";

type Item = Record<string, unknown>;

interface ObjectListFieldProps {
  field: FieldSpec;
  items: Item[];
  onChange: (items: Item[]) => void;
}

/**
 * Generates an item id.
 *
 * Every item gets one so React keys and removal stay stable, and so hand-written YAML configs that
 * omit it get the same treatment (see `loadRespondentConfig`).
 */
function generateItemId(): string {
  // crypto.randomUUID() only exists in secure contexts (HTTPS/localhost) — fall back on plain HTTP.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Renders a number as "1 234 Kč", or an em dash when there's nothing to show. */
function amount(value: unknown, suffix?: string): string {
  if (value == null || value === "") return "—";
  const text = typeof value === "number" ? formatThousands(String(value)) : String(value);
  return suffix ? `${text} ${suffix}` : text;
}

function ItemRow({ item, spec, removeText, onRemove }: { item: Item; spec: ItemSpec; removeText: string; onRemove: () => void }) {
  return (
    <div className="product-summary-item">
      <DataRowValue
        label={String(item[spec.label.field] ?? "")}
        value={spec.value ? amount(item[spec.value.field], spec.value.suffix) : ""}
      />
      <div className="product-summary-item__meta">
        {spec.meta
          ?.filter((m) => item[m.field] != null && item[m.field] !== "" && matchesItem(item, m.showWhen))
          .map((m) => (
            <span key={m.field}>
              {m.label} {amount(item[m.field], m.suffix)}
            </span>
          ))}
        <button type="button" className="product-summary-item__remove" onClick={onRemove}>
          {removeText}
        </button>
      </div>
    </div>
  );
}

export function ObjectListField({ field, items, onChange }: ObjectListFieldProps) {
  const [draft, setDraft] = useState<Item | null>(null);
  /**
   * A ref, not state: `onTouch` and the value change arrive in the same event handler, and a state
   * update wouldn't be visible until the next render — the suggestion would overwrite the very
   * keystroke that was supposed to stop it.
   */
  const touched = useRef<Set<string>>(new Set());

  const itemFields = field.fields ?? [];
  const itemSpec = field.item!;
  const removeText = field.removeText ?? "Odebrat";
  // An item with no groups configured still has to show up, so everything falls into one unnamed group.
  const configuredGroups = field.groups ?? [{ title: field.label, where: undefined }];

  // First matching group wins, so an item is never counted in two totals.
  const groupIndexOf = (item: Item) => configuredGroups.findIndex((g) => matchesItem(item, g.where));
  /**
   * Items matching no group would otherwise vanish from the screen while still being in the data —
   * a `where` typo would silently produce a test the moderator can't see they configured.
   */
  const orphans = items.filter((item) => groupIndexOf(item) === -1);
  const groups = orphans.length
    ? [...configuredGroups, { title: "Nezařazeno (neodpovídá žádné skupině)", where: undefined }]
    : configuredGroups;

  function openModal() {
    const initial = defaultsFromSchema(itemFields);
    touched.current = new Set();
    setDraft(applySuggestions(itemFields, initial, new Set()));
  }

  function updateDraft(next: Item) {
    setDraft(applySuggestions(itemFields, next, touched.current));
  }

  function markTouched(name: string) {
    touched.current.add(name);
  }

  function save() {
    if (!draft) return;
    onChange([...items, { ...stripHiddenFields(itemFields, draft), id: generateItemId() }]);
    setDraft(null);
  }

  return (
    <div className="field">
      <span className="field__label">{field.label}</span>
      <div className="product-groups">
        {groups.map((group, groupIdx) => {
          const isOrphanGroup = groupIdx >= configuredGroups.length;
          const groupItems = isOrphanGroup ? orphans : items.filter((item) => groupIndexOf(item) === groupIdx);
          const total = field.summary
            ? groupItems.reduce((sum, item) => sum + (Number(item[field.summary!.sum]) || 0), 0)
            : 0;

          return (
            <div className="product-group" key={group.title}>
              <Divider />
              <TitleText type="titleLarge" title={group.title} />
              {field.summary && (
                <DataRowValue label={field.summary.label} value={amount(total, field.summary.suffix)} />
              )}
              <Divider />
              {groupItems.length === 0 ? (
                <p className="paragraph paragraph--muted">{field.emptyText ?? "Žádné položky."}</p>
              ) : (
                <div className="product-summary-list">
                  {groupItems.map((item, idx) => (
                    <div key={String(item.id ?? idx)}>
                      {idx > 0 && <Divider />}
                      <ItemRow
                        item={item}
                        spec={itemSpec}
                        removeText={removeText}
                        onRemove={() => onChange(items.filter((other) => other !== item))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="button button--secondary" onClick={openModal}>
        {field.addText ?? "+ Přidat"}
      </button>

      {draft && (
        <div className="modal-overlay" onClick={() => setDraft(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="heading heading--2">{field.modalTitle ?? field.label}</h2>
            <div className="modal-card__form">
              <SchemaForm
                fields={itemFields}
                value={draft}
                onChange={updateDraft}
                onTouch={markTouched}
              />
            </div>
            <div className="modal-card__actions">
              <button type="button" className="button button--secondary" onClick={() => setDraft(null)}>
                {field.cancelText ?? "Zrušit"}
              </button>
              <button type="button" className="button button--primary" onClick={save}>
                {field.saveText ?? "Přidat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
