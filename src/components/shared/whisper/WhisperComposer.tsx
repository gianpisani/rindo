import type { CSSProperties, FormEvent, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUp, X } from "lucide-react";
import "./whisper.css";

interface WhisperComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  accent?: string;
  focusOnOpen?: () => void;
  onSubmit?: (event: FormEvent) => void;
  formId?: string;
  formClassName?: string;
  children: ReactNode;
}

export function WhisperComposer({
  open,
  onOpenChange,
  title,
  description,
  accent,
  focusOnOpen,
  onSubmit,
  formId,
  formClassName,
  children,
}: WhisperComposerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="whisper-backdrop" />
        <Dialog.Content
          data-scrollable
          className="whisper-composer"
          style={accent ? ({ "--whisper-accent": accent } as CSSProperties) : undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusOnOpen?.();
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar">
            <X size={16} />
          </Dialog.Close>
          {onSubmit ? (
            <form id={formId} onSubmit={onSubmit} className={formClassName ? `whisper-form ${formClassName}` : "whisper-form"}>
              {children}
            </form>
          ) : (
            <div className="whisper-form">{children}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function WhisperStaticType({ children }: { children: ReactNode }) {
  return (
    <div className="whisper-type" data-static>
      <span className="whisper-dot" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

interface WhisperSubmitProps {
  label?: string;
  disabled?: boolean;
  keyHint?: boolean;
  children: ReactNode;
}

export function WhisperSubmit({ label, disabled, keyHint = true, children }: WhisperSubmitProps) {
  return (
    <button type="submit" className="whisper-submit" disabled={disabled} aria-label={label}>
      {children}
      {keyHint && (
        <>
          <span className="hidden sm:inline" aria-hidden="true">↵</span>
          <ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

export function WhisperShortcuts({ id, items }: { id?: string; items: Array<[key: string, action: string]> }) {
  return (
    <p id={id} className="whisper-shortcuts">
      {items.map(([key, action]) => (
        <span key={key}>
          <kbd>{key}</kbd> {action}
        </span>
      ))}
    </p>
  );
}
