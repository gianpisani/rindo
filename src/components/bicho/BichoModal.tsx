import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { BichoCreature } from "./BichoCreature";
import { getScoreColor } from "@/lib/bicho-shapes";
import type { BichoState } from "@/hooks/useBicho";
import { getDaysInMonth } from "date-fns";
import { Sparkles, Flame, Zap, ArrowRight, Loader2 } from "lucide-react";

interface BichoModalProps {
  open: boolean;
  onClose: () => void;
  bicho: BichoState;
}

export function BichoModal({ open, onClose, bicho }: BichoModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  // Generate AI message on open
  useEffect(() => {
    if (open && !bicho.aiMessage && !bicho.isLoadingAI) {
      bicho.generateAIMessage();
    }
  }, [open]);

  if (!open) return null;

  const glowColor = getScoreColor(bicho.monthlyScore);
  const now = new Date();
  const daysInMonth = getDaysInMonth(now);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300" />

      {/* Content */}
      <div
        className="relative flex flex-col items-center gap-6 max-w-sm w-full animate-in zoom-in-90 slide-in-from-bottom-4 duration-500 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow */}
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-[80px] opacity-30 pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />

        {/* Creature */}
        <div className="relative">
          <BichoCreature
            shape={bicho.shape}
            dayScores={bicho.monthDays}
            daysInMonth={daysInMonth}
            pixelSize={18}
            gap={3}
            showTooltips
          />
        </div>

        {/* Info */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {bicho.shape.emoji} {bicho.shape.name}
          </h2>
          <p className="text-white/40 text-xs uppercase tracking-widest">
            Nivel {bicho.level} · Evolución{" "}
            {bicho.level < 4 ? `${bicho.level}/4` : "Máxima"}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-white/70 text-sm">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-yellow-400" />
              <span className="font-bold text-white">{bicho.monthlyScore}</span>
            </div>
            <span className="text-[10px] text-white/40">Salud mensual</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span className="font-bold text-white">
                {bicho.savingStreak}d
              </span>
            </div>
            <span className="text-[10px] text-white/40">Racha ahorro</span>
          </div>
          {bicho.monthHormigaCount > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px]">🐜</span>
                <span className="font-bold text-white">
                  {bicho.monthHormigaCount}
                </span>
              </div>
              <span className="text-[10px] text-white/40">Gastos hormiga</span>
            </div>
          )}
        </div>

        {/* AI Message */}
        <div className="w-full min-h-[60px] flex items-center justify-center">
          {bicho.isLoadingAI ? (
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Pensando...</span>
            </div>
          ) : bicho.aiMessage ? (
            <p className="text-white/70 text-sm text-center leading-relaxed italic px-4">
              "{bicho.aiMessage}"
            </p>
          ) : (
            <button
              onClick={bicho.generateAIMessage}
              className="flex items-center gap-2 text-white/40 hover:text-white/60 text-sm transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Pedir mensaje</span>
            </button>
          )}
        </div>

        {/* Link to full page */}
        <Link
          to="/bicho"
          onClick={onClose}
          className="flex items-center gap-2 text-primary/80 hover:text-primary text-sm font-medium transition-colors"
        >
          Ver perfil completo
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>

        {/* Close hint */}
        <p className="text-white/20 text-xs">Click afuera o Esc para cerrar</p>
      </div>
    </div>,
    document.body
  );
}
