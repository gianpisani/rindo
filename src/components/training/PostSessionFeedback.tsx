import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Frown, Meh, Smile, SmilePlus, Laugh } from "lucide-react";

interface Props {
  sessionId: string;
  currentRating?: number | null;
  currentNotes?: string | null;
  onSave: (rating: number, notes: string) => void;
}

const FEELINGS = [
  { value: 1, icon: Frown, label: "Muy mal", color: "text-rose-500 bg-rose-500/10 border-rose-500/30" },
  { value: 2, icon: Meh, label: "Mal", color: "text-orange-500 bg-orange-500/10 border-orange-500/30" },
  { value: 3, icon: Smile, label: "Normal", color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  { value: 4, icon: SmilePlus, label: "Bien", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
  { value: 5, icon: Laugh, label: "Genial", color: "text-green-500 bg-green-500/10 border-green-500/30" },
];

export function PostSessionFeedback({ sessionId, currentRating, currentNotes, onSave }: Props) {
  const [rating, setRating] = useState(currentRating || 0);
  const [notes, setNotes] = useState(currentNotes || "");
  const isDirty = rating !== (currentRating || 0) || notes !== (currentNotes || "");

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Cómo te sentiste
      </h4>
      <div className="flex gap-2 mb-3">
        {FEELINGS.map((f) => {
          const Icon = f.icon;
          const isSelected = rating === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setRating(f.value)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all flex-1",
                isSelected ? f.color : "border-transparent hover:bg-muted/50 text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-medium">{f.label}</span>
            </button>
          );
        })}
      </div>
      <Textarea
        placeholder="Notas post-sesión..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="min-h-[60px] text-sm resize-none"
      />
      {isDirty && rating > 0 && (
        <Button
          size="sm"
          className="mt-2 w-full"
          onClick={() => onSave(rating, notes)}
        >
          Guardar feedback
        </Button>
      )}
    </div>
  );
}
