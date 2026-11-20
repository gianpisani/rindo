import { useCallback, useRef } from "react";
import { generatedAccent } from "@/lib/theme";

export function HueSlider({
  value,
  onChange,
  mode,
}: {
  value: number;
  onChange: (hue: number) => void;
  mode: "light" | "dark";
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const updateFromPointer = useCallback(
    (clientX: number) => {
      const rect = trackRef.current!.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onChange(Math.round(ratio * 360));
    },
    [onChange]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateFromPointer(e.clientX);
    },
    [updateFromPointer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pressure > 0) updateFromPointer(e.clientX);
    },
    [updateFromPointer]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 30 : 5;
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowUp" ? step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : 0;
    if (!delta) return;
    e.preventDefault();
    onChange((value + delta + 360) % 360);
  };

  const pct = (value / 360) * 100;
  const track = Array.from({ length: 13 }, (_, i) =>
    generatedAccent(i * 30, mode).primary
  ).join(", ");
  const thumb = generatedAccent(value, mode).primary;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Tono"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={value}
      onKeyDown={handleKeyDown}
      className="relative h-9 cursor-pointer touch-none select-none rounded-full"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <div
        className="absolute inset-y-[10px] inset-x-0 rounded-full"
        style={{
          background: `linear-gradient(to right, ${track})`,
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)",
        }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 size-[22px] rounded-full pointer-events-none transition-[left] duration-75 ease-out"
        style={{
          left: `calc(${pct}% - 11px)`,
          backgroundColor: thumb,
          border: "3px solid rgba(255,255,255,0.9)",
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.3)",
        }}
      />
    </div>
  );
}
