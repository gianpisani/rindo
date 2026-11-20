import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { groupDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_DIGITS = 12;

const stop = (e: MouseEvent) => e.stopPropagation();

function useInlineEditor(onEditingChange?: (editing: boolean) => void) {
  const [editing, setEditingState] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);
  const refocus = useRef(false);

  const setEditing = (next: boolean) => {
    setEditingState(next);
    onEditingChange?.(next);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
    else if (refocus.current) {
      refocus.current = false;
      triggerRef.current?.focus();
    }
  }, [editing]);

  const start = () => {
    cancelled.current = false;
    setEditing(true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" && e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    cancelled.current = e.key === "Escape";
    refocus.current = true;
    e.currentTarget.blur();
  };

  const finish = (save: () => void) => {
    if (!cancelled.current) save();
    setEditing(false);
  };

  return { editing, start, finish, onKeyDown, inputRef, triggerRef };
}

interface InlineTextProps {
  value: string;
  editable: boolean;
  label: string;
  placeholder?: string;
  title?: string;
  className?: string;
  onSave: (value: string) => void;
  onEditingChange?: (editing: boolean) => void;
}

export function InlineText({ value, editable, label, placeholder = "Sin detalle", title, className, onSave, onEditingChange }: InlineTextProps) {
  const editor = useInlineEditor(onEditingChange);
  const [draft, setDraft] = useState(value);

  const open = () => {
    setDraft(value);
    editor.start();
  };

  if (editor.editing) {
    return (
      <input
        ref={editor.inputRef}
        className={cn("inline-field inline-field-input", className)}
        value={draft}
        placeholder={placeholder}
        aria-label={label}
        onClick={stop}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={editor.onKeyDown}
        onBlur={() => editor.finish(() => {
          const next = draft.trim();
          if (next !== value) onSave(next);
        })}
      />
    );
  }

  const content = value || <span className="inicio-placeholder">{placeholder}</span>;
  if (!editable) return <span className={cn("inline-field inicio-editable", className)} title={title}>{content}</span>;

  return (
    <button
      ref={editor.triggerRef}
      type="button"
      className={cn("inline-field inicio-editable", className)}
      title={title}
      aria-label={`${label}: ${value || placeholder}`}
      onClick={(e) => {
        stop(e);
        open();
      }}
    >
      {content}
    </button>
  );
}

interface InlineAmountProps {
  amount: number;
  signOf: (amount: number) => string;
  editable: boolean;
  allowNegative?: boolean;
  color?: string;
  className?: string;
  onSave: (amount: number) => void;
  onEditingChange?: (editing: boolean) => void;
}

const caretAfterDigits = (value: string, digits: number) => {
  let seen = 0;
  let position = 0;
  while (position < value.length && seen < digits) {
    if (/\d/.test(value[position])) seen++;
    position++;
  }
  return position;
};

export function InlineAmount({ amount, signOf, editable, allowNegative = false, color, className, onSave, onEditingChange }: InlineAmountProps) {
  const editor = useInlineEditor(onEditingChange);
  const [digits, setDigits] = useState("");
  const [negative, setNegative] = useState(false);
  const caretDigits = useRef<number | null>(null);
  const shown = digits ? groupDigits(Number(digits)) : "";
  const style: CSSProperties = { color };

  useLayoutEffect(() => {
    const input = editor.inputRef.current;
    if (!editor.editing || !input || caretDigits.current === null) return;
    const position = caretAfterDigits(input.value, caretDigits.current);
    input.setSelectionRange(position, position);
    caretDigits.current = null;
  }, [shown, editor.editing, editor.inputRef]);

  const open = () => {
    setDigits(String(Math.abs(amount)));
    setNegative(amount < 0);
    editor.start();
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value, selectionStart } = e.target;
    if (allowNegative && /[-−+]/.test(value)) setNegative(/[-−]/.test(value));
    caretDigits.current = value.slice(0, selectionStart ?? value.length).replace(/\D/g, "").length;
    setDigits(value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS));
  };

  const save = () => {
    const magnitude = Number(digits);
    if (!Number.isSafeInteger(magnitude) || magnitude <= 0) return;
    const sign = allowNegative ? (negative ? -1 : 1) : amount < 0 ? -1 : 1;
    const next = sign * magnitude;
    if (next !== amount) onSave(next);
  };

  if (editor.editing) {
    const sign = signOf(allowNegative ? (negative ? -1 : 1) : amount || 1);
    return (
      <span className={cn("inline-amount is-editing", className)} style={style}>
        <span aria-hidden="true">{sign}$</span>
        <span className="inline-amount-size" data-value={shown}>
          <input
            ref={editor.inputRef}
            size={1}
            value={shown}
            inputMode="numeric"
            aria-label="Monto del movimiento"
            onClick={stop}
            onChange={onChange}
            onKeyDown={editor.onKeyDown}
            onBlur={() => editor.finish(save)}
          />
        </span>
      </span>
    );
  }

  const content = (
    <>
      <span>{signOf(amount)}$</span>
      <span>{groupDigits(Math.abs(amount))}</span>
    </>
  );
  if (!editable) return <span className={cn("inline-amount", className)} style={style}>{content}</span>;

  return (
    <button
      ref={editor.triggerRef}
      type="button"
      className={cn("inline-amount inicio-editable", className)}
      style={style}
      aria-label="Editar monto"
      onClick={(e) => {
        stop(e);
        open();
      }}
    >
      {content}
    </button>
  );
}
