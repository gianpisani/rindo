// Pixel art shapes for each Bicho evolution level
// Each '#' = a cell that maps to a day of the month (31 cells max)
// Cells are mapped left-to-right, top-to-bottom

export interface BichoShape {
  name: string;
  emoji: string;
  description: string;
  grid: string[];
  eyes: [number, number][]; // [row, col] positions for eye blink animation
}

export const BICHO_SHAPES: Record<number, BichoShape> = {
  1: {
    name: "Semilla",
    emoji: "🌱",
    description: "Tu bicho está en su forma más básica. ¡Mejora tus hábitos para que evolucione!",
    grid: [
      "...#...",
      "..###..",
      ".#####.",
      "#######",
      "#######",
      ".#####.",
      "..###..",
    ],
    eyes: [],
  },
  2: {
    name: "Bichito",
    emoji: "🐛",
    description: "Tu bicho está tomando forma. Sigue así y pronto evolucionará.",
    grid: [
      ".#...#.",
      "..#.#..",
      ".#####.",
      ".#####.",
      "#######",
      ".#####.",
      "..###..",
      ".#...#.",
    ],
    eyes: [[3, 2], [3, 4]],
  },
  3: {
    name: "Zorrito",
    emoji: "🦊",
    description: "Tu bicho evolucionó a Zorrito. Tus finanzas van en buen camino.",
    grid: [
      "#.....#",
      "##...##",
      "###.###",
      ".#####.",
      ".#.#.#.",
      ".#####.",
      "..###..",
      "..###..",
    ],
    eyes: [[4, 1], [4, 5]],
  },
  4: {
    name: "Fénix",
    emoji: "🔥",
    description: "¡Tu bicho es un Fénix! Tus finanzas brillan con fuerza.",
    grid: [
      "...#...",
      "..###..",
      ".#####.",
      "##.#.##",
      "#..#..#",
      "##.#.##",
      ".#####.",
      "..#.#..",
      ".#...#.",
    ],
    eyes: [[3, 0], [3, 6]],
  },
};

// Parse shape grid into ordered cell coordinates
export function getShapeCells(
  shape: BichoShape
): { row: number; col: number; isEye: boolean }[] {
  const cells: { row: number; col: number; isEye: boolean }[] = [];

  for (let row = 0; row < shape.grid.length; row++) {
    for (let col = 0; col < shape.grid[row].length; col++) {
      if (shape.grid[row][col] === "#") {
        const isEye = shape.eyes.some(([r, c]) => r === row && c === col);
        cells.push({ row, col, isEye });
      }
    }
  }

  return cells;
}

// Get grid dimensions
export function getShapeSize(shape: BichoShape): { rows: number; cols: number } {
  return {
    rows: shape.grid.length,
    cols: Math.max(...shape.grid.map((r) => r.length)),
  };
}

// Score → color
export function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 65) return "#4ade80";
  if (score >= 50) return "#a3e635";
  if (score >= 40) return "#facc15";
  if (score >= 25) return "#f97316";
  return "#ef4444";
}

export const EMPTY_CELL_COLOR = "#1c1c22";
export const FUTURE_CELL_COLOR = "#27272a";
