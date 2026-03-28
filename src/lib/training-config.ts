import {
  Footprints,
  Bike,
  Waves,
  Dumbbell,
  Coffee,
  Circle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ─── Sport Config ────────────────────────────────────

export const SPORT_CONFIG: Record<
  string,
  { icon: typeof Footprints; color: string; bg: string; dot: string; label: string }
> = {
  running: {
    icon: Footprints,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    dot: "bg-orange-500",
    label: "Running",
  },
  cycling: {
    icon: Bike,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    dot: "bg-blue-500",
    label: "Ciclismo",
  },
  swimming: {
    icon: Waves,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    dot: "bg-cyan-500",
    label: "Natación",
  },
  padel: {
    icon: Dumbbell,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    dot: "bg-violet-500",
    label: "Pádel",
  },
  strength: {
    icon: Dumbbell,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    dot: "bg-amber-500",
    label: "Fuerza",
  },
  rest: {
    icon: Coffee,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    dot: "bg-muted-foreground/40",
    label: "Descanso",
  },
};

// ─── Intensity Config ────────────────────────────────

export const INTENSITY_CONFIG: Record<string, { label: string; color: string }> = {
  easy: {
    label: "Suave",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  moderate: {
    label: "Moderado",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  hard: {
    label: "Intenso",
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  },
  recovery: {
    label: "Recuperación",
    color: "text-sky-500 bg-sky-500/10 border-sky-500/20",
  },
  rest: {
    label: "Descanso",
    color: "text-muted-foreground bg-muted/50 border-border/50",
  },
};

// ─── Status Config ───────────────────────────────────

export const STATUS_ICON: Record<string, typeof Circle> = {
  pending: Circle,
  completed: CheckCircle2,
  skipped: XCircle,
};

export const STATUS_COLOR: Record<string, string> = {
  pending: "text-muted-foreground",
  completed: "text-emerald-500",
  skipped: "text-rose-400",
};

// ─── Day Names ───────────────────────────────────────

export const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ─── Workout Subtypes ────────────────────────────────

export const WORKOUT_SUBTYPES: Record<
  string,
  { label: string; sports: string[] }
> = {
  intervals: { label: "Intervalos", sports: ["running", "cycling", "swimming"] },
  tempo: { label: "Tempo", sports: ["running", "cycling"] },
  fondo: { label: "Fondo", sports: ["running", "cycling", "swimming"] },
  ftp_test: { label: "Test FTP", sports: ["cycling"] },
  hill_repeats: { label: "Cuestas", sports: ["running", "cycling"] },
  recovery_jog: { label: "Trote recuperación", sports: ["running"] },
  sweet_spot: { label: "Sweet Spot", sports: ["cycling"] },
  race: { label: "Carrera", sports: ["running", "cycling", "swimming"] },
  drills: { label: "Técnica", sports: ["swimming"] },
  match: { label: "Partido", sports: ["padel"] },
  circuit: { label: "Circuito", sports: ["strength"] },
};

// ─── Training Phases ─────────────────────────────────

export const TRAINING_PHASES: Record<
  string,
  { label: string; color: string; description: string }
> = {
  base: {
    label: "Base",
    color: "bg-blue-500",
    description: "Construyendo volumen aeróbico",
  },
  build: {
    label: "Construcción",
    color: "bg-amber-500",
    description: "Aumentando intensidad",
  },
  peak: {
    label: "Pico",
    color: "bg-rose-500",
    description: "Máxima carga de entrenamiento",
  },
  taper: {
    label: "Descarga",
    color: "bg-violet-500",
    description: "Reduciendo volumen pre-competición",
  },
  recovery: {
    label: "Recuperación",
    color: "bg-emerald-500",
    description: "Descanso activo",
  },
  transition: {
    label: "Transición",
    color: "bg-gray-400",
    description: "Entre ciclos de entrenamiento",
  },
};

// ─── Race Distances ──────────────────────────────────

export const RACE_DISTANCES = [
  { value: "5K", label: "5K" },
  { value: "10K", label: "10K" },
  { value: "half_marathon", label: "Media Maratón" },
  { value: "marathon", label: "Maratón" },
  { value: "custom", label: "Otra" },
] as const;
