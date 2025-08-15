import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { onlyDigits, formatThousands } from "../../format";
import { getValidationError, type ValidatorConfig } from "../../validation";

interface TextInputFieldProps {
  label: string;
  suffix?: string;
  inputType?: "text" | "numeric";
  value?: string | number;
  onChange?: (value: string) => void;
  /** Focuses and selects the input's text on mount, so typing immediately replaces it (e.g. in a just-opened bottom sheet). */
  autoFocus?: boolean;
  /** 0..n validators checked in order; only the first one that fails is shown. */
  validators?: ValidatorConfig[];
  /** Reveals the validation error even before the field has been blurred (e.g. after a failed submit attempt). */
  forceShowError?: boolean;
}

function digitsBeforeIndex(raw: string, index: number): number {
  return onlyDigits(raw.slice(0, index)).length;
}

/** Position right after the nth digit in a formatted (space-grouped) string. */
function indexAfterDigitCount(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

export function TextInputField({
  label,
  suffix,
  inputType = "text",
  value,
  onChange,
  autoFocus,
  validators,
  forceShowError,
}: TextInputFieldProps) {
  const isNumeric = inputType === "numeric";
  const inputRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Digit-count-based cursor target for the next render, set by the change handler
  // and consumed (then cleared) by the layout effect once the formatted value lands in the DOM.
  const pendingCursorDigits = useRef<number | null>(null);

  const rawValue = value === undefined || value === null ? "" : String(value);
  const hasValue = rawValue !== "";
  const displayValue = isNumeric ? formatThousands(onlyDigits(rawValue)) : rawValue;
  const errorMessage = getValidationError(rawValue, validators);
  const showError = Boolean(errorMessage) && (touched || forceShowError);

  useLayoutEffect(() => {
    if (pendingCursorDigits.current === null || !inputRef.current) return;
    const pos = indexAfterDigitCount(displayValue, pendingCursorDigits.current);
    inputRef.current.setSelectionRange(pos, pos);
    pendingCursorDigits.current = null;
  }, [displayValue]);

  return (
    <label className={`text-input-field${hasValue ? " text-input-field--filled" : ""}`}>
      <span className={`text-input-field__box${showError ? " text-input-field__box--error" : ""}`}>
        <span className="text-input-field__text">
          {hasValue && <span className="text-input-field__caption">{label}</span>}
          <input
            ref={inputRef}
            className="text-input-field__input"
            type="text"
            inputMode={isNumeric ? "numeric" : undefined}
            placeholder={hasValue ? undefined : label}
            value={displayValue}
            onChange={(e) => {
              if (isNumeric) {
                const cursorPos = e.target.selectionStart ?? e.target.value.length;
                pendingCursorDigits.current = digitsBeforeIndex(e.target.value, cursorPos);
                onChange?.(onlyDigits(e.target.value));
              } else {
                onChange?.(e.target.value);
              }
            }}
            onBlur={() => setTouched(true)}
          />
        </span>
        {suffix && <span className="text-input-field__suffix">{suffix}</span>}
      </span>
      {showError && <span className="text-input-field__error">{errorMessage}</span>}
    </label>
  );
}
