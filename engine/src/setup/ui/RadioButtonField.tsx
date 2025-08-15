interface RadioButtonFieldProps {
  variable: string;
  label: string;
  checked?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

export function RadioButtonField({ variable, label, checked, value, onChange }: RadioButtonFieldProps) {
  const isChecked = value !== undefined ? value === label : Boolean(checked);
  return (
    <label className="field-check">
      <input
        type="radio"
        name={variable}
        className="field-check__input field-check__input--radio"
        checked={isChecked}
        onChange={() => {
          if (!isChecked) onChange?.(label);
        }}
      />
      <span className="field-check__label">{label}</span>
    </label>
  );
}
