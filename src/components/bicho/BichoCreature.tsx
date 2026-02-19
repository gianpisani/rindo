import { getShapeCells, getShapeSize, EMPTY_CELL_COLOR, FUTURE_CELL_COLOR, type BichoShape } from "@/lib/bicho-shapes";
import type { DayScore } from "@/hooks/useBicho";
import { cn } from "@/lib/utils";

interface BichoCreatureProps {
  shape: BichoShape;
  dayScores: DayScore[];
  daysInMonth: number;
  pixelSize?: number;
  gap?: number;
  showTooltips?: boolean;
  animated?: boolean;
  className?: string;
}

export function BichoCreature({
  shape,
  dayScores,
  daysInMonth,
  pixelSize = 12,
  gap = 2,
  showTooltips = false,
  animated = true,
  className,
}: BichoCreatureProps) {
  const cells = getShapeCells(shape);
  const { rows, cols } = getShapeSize(shape);

  const totalWidth = cols * (pixelSize + gap) - gap;
  const totalHeight = rows * (pixelSize + gap) - gap;

  const formatCLP = (n: number) =>
    `$${Math.round(n).toLocaleString("es-CL")}`;

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className={cn(animated && "bicho-breathe", className)}
    >
      <style>{`
        .bicho-breathe {
          animation: bichoBreathe 3s ease-in-out infinite;
        }
        @keyframes bichoBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        .bicho-eye {
          animation: bichoBlink 4s ease-in-out infinite;
        }
        @keyframes bichoBlink {
          0%, 92%, 100% { opacity: 1; }
          96% { opacity: 0.05; }
        }
        .bicho-cell {
          transition: fill 0.5s ease, opacity 0.3s ease;
        }
        .bicho-cell:hover {
          opacity: 0.8;
          filter: brightness(1.2);
        }
      `}</style>

      {cells.map((cell, i) => {
        const dayData = i < dayScores.length ? dayScores[i] : null;
        const isFuture = i >= daysInMonth;

        const x = cell.col * (pixelSize + gap);
        const y = cell.row * (pixelSize + gap);

        let fillColor: string;
        if (isFuture) {
          fillColor = FUTURE_CELL_COLOR;
        } else if (dayData) {
          fillColor = dayData.color;
        } else {
          fillColor = EMPTY_CELL_COLOR;
        }

        const tooltipText =
          showTooltips && dayData
            ? `${dayData.label}\n${formatCLP(dayData.spent)} gastado · ${dayData.txCount} tx · Score ${dayData.score}`
            : isFuture
              ? "Día futuro"
              : undefined;

        return (
          <rect
            key={`${cell.row}-${cell.col}`}
            x={x}
            y={y}
            width={pixelSize}
            height={pixelSize}
            rx={pixelSize * 0.2}
            fill={fillColor}
            className={cn("bicho-cell", cell.isEye && "bicho-eye")}
            style={cell.isEye ? { filter: "brightness(1.6)" } : undefined}
          >
            {tooltipText && <title>{tooltipText}</title>}
          </rect>
        );
      })}
    </svg>
  );
}
