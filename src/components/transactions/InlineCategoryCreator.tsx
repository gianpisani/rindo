import { Check } from "lucide-react";
import { WhisperSwatches } from "@/components/shared/whisper/WhisperSwatches";
import { NEW_CATEGORY_COLORS, type NewCategoryDraft } from "@/hooks/useTxEditor";

interface InlineCategoryCreatorProps {
  draft: NewCategoryDraft;
  typeLabel: string;
  creating: boolean;
  onChange: (draft: NewCategoryDraft) => void;
  onCreate: () => void;
  onCancel: () => void;
}

export function InlineCategoryCreator({ draft, typeLabel, creating, onChange, onCreate, onCancel }: InlineCategoryCreatorProps) {
  return (
    <div className="whisper-tx-newcat" role="group" aria-label="Nueva categoría">
      <div className="whisper-tx-inline">
        <input
          className="whisper-tx-emoji"
          aria-label="Emoji de la categoría"
          maxLength={4}
          value={draft.icon}
          onChange={(e) => onChange({ ...draft, icon: e.target.value })}
        />
        <input
          className="grow"
          aria-label="Nombre de la categoría"
          placeholder={`Nueva categoría de ${typeLabel.toLowerCase()}`}
          value={draft.name}
          autoFocus
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCreate();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
        />
      </div>
      <WhisperSwatches
        colors={NEW_CATEGORY_COLORS}
        value={draft.color}
        onChange={(color) => onChange({ ...draft, color })}
        label="Color de la categoría"
      />
      <div className="whisper-tx-inline">
        <button
          type="button"
          className="whisper-tx-mini primary"
          disabled={!draft.name.trim() || creating}
          onClick={onCreate}
        >
          <Check size={12} /> Crear {draft.icon} {draft.name.trim() || "categoría"}
        </button>
        <button type="button" className="whisper-tx-mini" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
