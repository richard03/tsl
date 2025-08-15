interface DataRowValueProps {
  label: string;
  value: string;
}

export function DataRowValue({ label, value }: DataRowValueProps) {
  return (
    <div className="data-row-value">
      <span className="data-row-value__label">{label}</span>
      <span className="data-row-value__value">{value}</span>
    </div>
  );
}
