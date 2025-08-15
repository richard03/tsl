/**
 * Renders a `setup.yaml` field list against a plain object and reports edits back.
 *
 * Deliberately controlled and stateless: the object being edited lives in the caller (the moderator
 * screen, or the add-item modal), so the same component drives both the top-level form and the form
 * inside an `objectList` modal.
 */
import type { FieldSpec } from "./schema";
import { isFieldVisible, labelFor } from "./schema";
import { TextInputField } from "./ui/TextInputField";
import { SelectBoxField } from "./ui/SelectBoxField";
import { CheckBoxField } from "./ui/CheckBoxField";
import { RadioButtonField } from "./ui/RadioButtonField";
import { ObjectListField } from "./ObjectListField";

export interface SchemaFormProps {
  fields: FieldSpec[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Reveals validation errors on untouched fields, after a failed submit. */
  forceShowError?: boolean;
  /** Called the first time the moderator types into a field, so the caller can stop overwriting it with a `defaultFrom` suggestion. */
  onTouch?: (name: string) => void;
}

/**
 * Options carry arbitrary values (strings, booleans) but the underlying controls speak strings, so
 * each option gets a stable string key and is mapped back on the way out.
 */
const optionKey = (value: unknown) => String(value);

function ChoiceField({
  field,
  label,
  value,
  onChange,
  forceShowError,
}: {
  field: FieldSpec;
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  forceShowError?: boolean;
}) {
  const options = field.options ?? [];
  const selected = options.find((o) => optionKey(o.value) === optionKey(value));

  if (field.control === "radio") {
    return (
      <div className="field">
        <span className="field__label">{label}</span>
        {options.map((opt) => (
          <RadioButtonField
            key={optionKey(opt.value)}
            variable={field.name}
            label={opt.label}
            value={selected?.label ?? ""}
            onChange={(chosenLabel) => {
              const match = options.find((o) => o.label === chosenLabel);
              if (match) onChange(match.value);
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <SelectBoxField
      label={label}
      options={options.map((o) => ({ value: optionKey(o.value), label: o.label }))}
      value={selected ? optionKey(selected.value) : ""}
      onChange={(key) => {
        const match = options.find((o) => optionKey(o.value) === key);
        if (match) onChange(match.value);
      }}
      validators={field.validators}
      forceShowError={forceShowError}
    />
  );
}

export function SchemaForm({ fields, value, onChange, forceShowError, onTouch }: SchemaFormProps) {
  const set = (name: string, next: unknown) => onChange({ ...value, [name]: next });

  return (
    <>
      {fields.filter((field) => isFieldVisible(field, value)).map((field) => {
        const label = labelFor(field, value);
        const current = value[field.name];

        switch (field.type) {
          case "boolean":
            return (
              <CheckBoxField
                key={field.name}
                variable={field.name}
                label={label}
                value={Boolean(current)}
                onChange={(v) => set(field.name, v)}
              />
            );

          case "choice":
            return (
              <ChoiceField
                key={field.name}
                field={field}
                label={label}
                value={current}
                onChange={(v) => set(field.name, v)}
                forceShowError={forceShowError}
              />
            );

          case "objectList":
            return (
              <ObjectListField
                key={field.name}
                field={field}
                items={Array.isArray(current) ? (current as Record<string, unknown>[]) : []}
                onChange={(items) => set(field.name, items)}
              />
            );

          case "number":
            return (
              <TextInputField
                key={field.name}
                label={label}
                suffix={field.suffix}
                inputType="numeric"
                value={current == null ? "" : (current as number)}
                onChange={(v) => set(field.name, v === "" ? undefined : Number(v))}
                validators={field.validators}
                forceShowError={forceShowError}
              />
            );

          default:
            return (
              <TextInputField
                key={field.name}
                label={label}
                suffix={field.suffix}
                inputType="text"
                value={(current ?? "") as string}
                onChange={(v) => {
                  onTouch?.(field.name);
                  set(field.name, v);
                }}
                validators={field.validators}
                forceShowError={forceShowError}
              />
            );
        }
      })}
    </>
  );
}
