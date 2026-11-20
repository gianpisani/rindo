import { ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnboardingMode } from "@/hooks/useOnboardingDraft";

export function OnboardingFooter({
  mode,
  step,
  isLastStep,
  saving,
  onStepChange,
  onSkip,
  onSave,
}: {
  mode: OnboardingMode;
  step: number;
  isLastStep: boolean;
  saving: boolean;
  onStepChange: (step: number) => void;
  onSkip: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        {step > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStepChange(step - 1)}
            className="gap-1"
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
        ) : mode === "onboarding" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            disabled={saving}
            className="text-muted-foreground"
          >
            Omitir
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2">
        {isLastStep ? (
          <Button onClick={onSave} disabled={saving} size="sm" className="gap-1.5">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {mode === "edit" ? "Guardar" : "Empezar"}
          </Button>
        ) : (
          <Button onClick={() => onStepChange(step + 1)} size="sm" className="gap-1">
            Siguiente
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
