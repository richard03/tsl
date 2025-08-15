import { useState } from "react";
import { caretDownIcon } from "./icons";
import { getValidationError, type ValidatorConfig } from "../../validation";

interface Option {
  value: string;
  label: string;
}

interface SelectBoxFieldProps {
  label: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  /** 0..n validators checked in order; only the first one that fails is shown. */
  validators?: ValidatorConfig[];
  /** Reveals the validation error even before the field has been blurred (e.g. after a failed submit attempt). */
  forceShowError?: boolean;
}

export function SelectBoxField({ label, options, value, onChange, validators, forceShowError }: SelectBoxFieldProps) {
  const [touched, setTouched] = useState(false);
  const selected = options.find((opt) => opt.value === value);
  const errorMessage = getValidationError(value ?? "", validators);
  const showError = Boolean(errorMessage) && (touched || forceShowError);
  return (
    <label className="select-box-field">
      <span className={`select-box-field__box${showError ? " select-box-field__box--error" : ""}`}>
        <span className="select-box-field__text">
          {selected ? (
            <>
              <span className="select-box-field__caption">{label}</span>
              <span className="select-box-field__value">{selected.label}</span>
            </>
          ) : (
            <span className="select-box-field__placeholder">{label}</span>
          )}
        </span>
        <span className="select-box-field__caret">{caretDownIcon}</span>
      </span>
      <select
        className="select-box-field__select"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={() => setTouched(true)}
      >
        <option value="" disabled hidden>
          {label}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {showError && <span className="select-box-field__error">{errorMessage}</span>}
    </label>
  );
}
