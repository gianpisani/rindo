import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS } from "./steps";

export function StepIndicator({
  step,
  onStepClick,
}: {
  step: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <>
      <p className="text-center text-xs text-muted-foreground mb-2">
        Paso {step + 1} de {ONBOARDING_STEPS.length}
      </p>
      <div className="flex items-center justify-center gap-2 mb-6">
        {ONBOARDING_STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => onStepClick(i)}
              aria-label={s.label}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                i > step && "text-muted-foreground"
              )}
            >
              {i < step ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
