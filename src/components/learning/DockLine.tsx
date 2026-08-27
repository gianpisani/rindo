import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { splitWords } from "@/lib/transcript";
import { computeDock, numberWords, DOCK_SCALE } from "@/lib/dock";

/** Cómo se marca una palabra: el subrayado dice de qué se trata. */
export interface WordMark {
  /** Color del subrayado — se usa el de la banda de frecuencia. */
  color: string;
  /** Punteado = todavía no la tienes. Sólido = ya está en tu diccionario. */
  solid?: boolean;
  title: string;
}

interface DockLineProps {
  text: string;
  onPick: (word: string) => void;
  /** Marca por palabra. Devuelve null para dejarla limpia. */
  markOf?: (word: string) => WordMark | null;
  /** Cuánto crece la palabra señalada y sus vecinas. */
  steps?: number[];
  className?: string;
  /** Una selección de varias palabras manda por sobre el clic simple. */
  onSelectionPick?: () => boolean;
  /** Línea de contexto: se lee, no se toca. */
  inert?: boolean;
}

/**
 * Una línea de subtítulo donde cada palabra se puede señalar y tocar.
 *
 * Vive aparte porque la usan los dos lugares donde se lee: la frase grande
 * bajo el video y la transcripción completa del costado. Que el gesto sea el
 * mismo en ambos es la mitad de que la pantalla se sienta una sola cosa.
 */
export function DockLine({
  text,
  onPick,
  markOf,
  steps = DOCK_SCALE,
  className,
  onSelectionPick,
  inert,
}: DockLineProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  /** Anchos naturales, medidos una sola vez por línea. */
  const [widths, setWidths] = useState<number[]>([]);

  const parts = useMemo(() => numberWords(splitWords(text)), [text]);

  useEffect(() => {
    setHovered(null);
    setWidths([]);
  }, [text]);

  /**
   * Mide al entrar por primera vez a la línea. En ese momento ninguna de sus
   * palabras está agrandada, así que la medida es la real.
   */
  const handleEnter = useCallback((ord: number, el: HTMLElement) => {
    setHovered(ord);
    setWidths((prev) => {
      if (prev.length) return prev;
      const line = el.parentElement;
      if (!line) return prev;
      return Array.from(line.querySelectorAll<HTMLElement>("[data-part]")).map(
        (node) => node.getBoundingClientRect().width
      );
    });
  }, []);

  const dock =
    !inert && hovered !== null && widths.length
      ? computeDock(parts, widths, hovered, steps)
      : null;

  return (
    <p
      onMouseLeave={() => setHovered(null)}
      onMouseUp={onSelectionPick ? () => onSelectionPick() : undefined}
      className={className}
    >
      {parts.map((part, index) => {
        const scale = dock?.scale[index] ?? 1;
        const shift = dock?.shift[index] ?? 0;
        const isFocus = scale === steps[0];

        const style: CSSProperties = {
          transform:
            shift || scale !== 1
              ? `translateX(${shift}px) scale(${scale})`
              : undefined,
          transformOrigin: "center bottom",
          transition:
            "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), color 140ms ease-out",
          willChange: dock ? "transform" : undefined,
        };

        if (!part.isWord) {
          // `whitespace-pre` es obligatorio: un inline-block que solo contiene
          // un espacio lo colapsa a cero y las palabras quedan pegadas.
          return (
            <span
              key={index}
              data-part
              className="inline-block whitespace-pre"
              style={style}
            >
              {part.value}
            </span>
          );
        }

        const mark = markOf?.(part.value) ?? null;
        if (mark) {
          style.textDecoration = "underline";
          style.textDecorationStyle = mark.solid ? "solid" : "dotted";
          style.textDecorationColor = mark.color;
          style.textDecorationThickness = "2px";
          style.textUnderlineOffset = "0.28em";
        }

        return (
          <span
            key={index}
            data-part
            title={mark?.title}
            onMouseEnter={
              inert ? undefined : (e) => handleEnter(part.ord, e.currentTarget)
            }
            onClick={
              inert
                ? undefined
                : () => {
                    if (onSelectionPick?.()) return;
                    onPick(part.value);
                  }
            }
            className={cn(
              "inline-block rounded",
              !inert && "cursor-pointer",
              isFocus && "font-bold text-primary"
            )}
            style={style}
          >
            {part.value}
          </span>
        );
      })}
    </p>
  );
}
