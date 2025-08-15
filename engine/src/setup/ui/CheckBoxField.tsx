interface CheckBoxFieldProps {
  variable: string;
  label: string;
  checked?: boolean;
  value?: boolean;
  onChange?: (value: boolean) => void;
}

export function CheckBoxField({ label, checked, value, onChange }: CheckBoxFieldProps) {
  const isChecked = value !== undefined ? value : Boolean(checked);
  return (
    <label className="field-check">
      <input
        type="checkbox"
        className="field-check__input field-check__input--checkbox"
        checked={isChecked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="field-check__label">{label}</span>
    </label>
  );
}
