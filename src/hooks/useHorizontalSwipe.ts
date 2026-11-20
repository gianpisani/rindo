import { useRef, type TouchEvent } from "react";

const MIN_SWIPE_PX = 56;
const HORIZONTAL_RATIO = 1.6;

export function useHorizontalSwipe(onSwipe: (direction: "left" | "right") => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchEnd: (e: TouchEvent) => {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const dx = e.changedTouches[0].clientX - from.x;
      const dy = e.changedTouches[0].clientY - from.y;
      if (Math.abs(dx) < MIN_SWIPE_PX || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return;
      onSwipe(dx < 0 ? "left" : "right");
    },
  };
}
