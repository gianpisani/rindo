import { useCallback, useState } from "react";

export function useStepTransition() {
  const [step, setStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [animating, setAnimating] = useState(false);

  const goToStep = useCallback(
    (target: number) => {
      if (target === step || animating) return;
      setSlideDirection(target > step ? "right" : "left");
      setAnimating(true);
      setTimeout(() => {
        setStep(target);
        setTimeout(() => setAnimating(false), 20);
      }, 150);
    },
    [step, animating]
  );

  const restart = useCallback(() => setStep(0), []);

  return { step, slideDirection, animating, goToStep, restart };
}
