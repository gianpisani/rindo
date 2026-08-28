import { useEffect, useState } from "react";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmojiPicker } from "@/components/EmojiPicker";
import { cn } from "@/lib/utils";
import { Loader2, ChevronDown } from "lucide-react";
import { LEVELS } from "@/lib/learning-config";
import type { LearningGoal } from "@/hooks/useLearningGoals";

interface GoalSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: LearningGoal | null;
  onSave: (draft: {
    topic: string;
    emoji: string;
    north_star: string | null;
    level_current: string | null;
    level_target: string | null;
    daily_minutes_target: number;
    weekly_days_target: number;
  }) => void;
  isSaving?: boolean;
}

const MINUTE_PRESETS = [15, 20, 30, 45, 60];
const DAY_PRESETS = [3, 4, 5, 6, 7];

export function GoalSetupDialog({
  open,
  onOpenChange,
  goal,
  onSave,
  isSaving,
}: GoalSetupDialogProps) {
  const [topic, setTopic] = useState("");
  const [emoji, setEmoji] = useState("🇬🇧");
  const [northStar, setNorthStar] = useState("");
  const [levelCurrent, setLevelCurrent] = useState<string | null>(null);
  const [levelTarget, setLevelTarget] = useState<string | null>(null);
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [weeklyDays, setWeeklyDays] = useState(5);
  const [showDetails, setShowDetails] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTopic(goal?.topic ?? "");
    setEmoji(goal?.emoji ?? "🇬🇧");
    setNorthStar(goal?.north_star ?? "");
    setLevelCurrent(goal?.level_current ?? null);
    setLevelTarget(goal?.level_target ?? null);
    setDailyMinutes(goal?.daily_minutes_target ?? 30);
    setWeeklyDays(goal?.weekly_days_target ?? 5);
    setShowDetails(!!goal);
  }, [open, goal]);

  const canSave = topic.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      topic: topic.trim(),
      emoji,
      north_star: northStar.trim() || null,
      level_current: levelCurrent,
      level_target: levelTarget,
      daily_minutes_target: dailyMinutes,
      weekly_days_target: weeklyDays,
    });
  };

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? "Editar objetivo" : "¿Qué quieres aprender?"}
      description={goal ? undefined : "Treinta segundos y estás listo"}
      maxWidth="lg"
      footer={
        <Button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          size="cta"
        >
          {isSaving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : goal ? (
            "Guardar"
          ) : (
            "Crear objetivo"
          )}
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Tema + emoji */}
        <div className="flex gap-2">
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-12 w-12 shrink-0 rounded-xl text-xl p-0"
              >
                {emoji}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <EmojiPicker
                value={emoji}
                onSelect={(e) => {
                  setEmoji(e);
                  setEmojiOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>

          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Inglés"
            autoFocus
            className="h-12 rounded-xl text-base font-medium"
          />
        </div>

        {/* Metas — lo único realmente necesario */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Minutos efectivos al día
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {MINUTE_PRESETS.map((m) => (
                <button
                  key={m}
                  onClick={() => setDailyMinutes(m)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm font-medium border transition-all tabular-nums",
                    dailyMinutes === m
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Días a la semana
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_PRESETS.map((d) => (
                <button
                  key={d}
                  onClick={() => setWeeklyDays(d)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm font-medium border transition-all tabular-nums",
                    weeklyDays === d
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* El resto, plegado */}
        <div>
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                showDetails && "rotate-180"
              )}
            />
            Objetivo y nivel
          </button>

          {showDetails && (
            <div className="space-y-4 mt-3 pt-3 border-t border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  ¿Para qué lo quieres?
                </Label>
                <Textarea
                  value={northStar}
                  onChange={(e) => setNorthStar(e.target.value)}
                  placeholder="Hablar inglés con soltura en el trabajo y en conversaciones"
                  rows={2}
                  className="rounded-xl resize-none text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Hoy estás en</Label>
                  <div className="flex flex-wrap gap-1">
                    {LEVELS.map((l) => (
                      <button
                        key={l}
                        onClick={() => setLevelCurrent(levelCurrent === l ? null : l)}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[11px] border transition-all",
                          levelCurrent === l
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/60 text-muted-foreground hover:border-border"
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Quieres llegar a</Label>
                  <div className="flex flex-wrap gap-1">
                    {LEVELS.map((l) => (
                      <button
                        key={l}
                        onClick={() => setLevelTarget(levelTarget === l ? null : l)}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[11px] border transition-all",
                          levelTarget === l
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/60 text-muted-foreground hover:border-border"
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
