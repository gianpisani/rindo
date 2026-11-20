import { digitsOnly, formatAmountInput } from "@/lib/format";

export function AmountField({
  value,
  onChange,
  onSave,
  onCancel,
  autoFocus,
  placeholder = "1.500.000",
  label,
}: {
  value: string;
  onChange: (raw: string) => void;
  onSave: () => void;
  onCancel: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  label: string;
}) {
  return (
    <span className="meta-edit-field">
      <span>$</span>
      <input
        value={formatAmountInput(value)}
        inputMode="numeric"
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={label}
        onChange={(e) => onChange(digitsOnly(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
      />
    </span>
  );
}
