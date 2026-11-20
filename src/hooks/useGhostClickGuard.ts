import { useCallback, useRef } from "react";

export function useGhostClickGuard(windowMs: number) {
  const armedAt = useRef(0);
  const arm = useCallback(() => {
    armedAt.current = Date.now();
  }, []);
  const isArmed = useCallback(() => Date.now() - armedAt.current < windowMs, [windowMs]);
  return { arm, isArmed };
}
