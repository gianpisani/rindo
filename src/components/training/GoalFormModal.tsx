import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPORT_CONFIG } from "@/lib/training-config";
import { format, startOfWeek, startOfMonth } from "date-fns";
import type { CreateGoalData } from "@/hooks/useTrainingGoals";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateGoalData) => void;
}

const GOAL_TYPES = [
  { value: "weekly_distance", label: "Distancia semanal", unit: "km" },
  { value: "weekly_duration", label: "Duración semanal", unit: "min" },
  { value: "weekly_sessions", label: "Sesiones semanales", unit: "sesiones" },
  { value: "monthly_distance", label: "Distancia mensual", unit: "km" },
  { value: "monthly_duration", label: "Duración mensual", unit: "min" },
  { value: "monthly_sessions", label: "Sesiones mensuales", unit: "sesiones" },
];

export function GoalFormModal({ open, onOpenChange, onSave }: Props) {
  const [goalType, setGoalType] = useState("weekly_distance");
  const [sportType, setSportType] = useState<string>("");
  const [targetValue, setTargetValue] = useState("");

  const selectedGoalType = GOAL_TYPES.find((g) => g.value === goalType);

  const handleSave = () => {
    if (!targetValue) return;
    const now = new Date();
    const isWeekly = goalType.startsWith("weekly_");

    onSave({
      goal_type: goalType,
      sport_type: sportType || null,
      target_value: parseFloat(targetValue),
      start_date: format(
        isWeekly ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now),
        "yyyy-MM-dd"
      ),
    });
    onOpenChange(false);
    setGoalType("weekly_distance");
    setSportType("");
    setTargetValue("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Nueva meta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tipo de meta</Label>
            <Select value={goalType} onValueChange={setGoalType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_TYPES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Deporte (opcional)</Label>
            <Select value={sportType} onValueChange={setSportType}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los deportes" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SPORT_CONFIG)
                  .filter(([k]) => k !== "rest")
                  .map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Objetivo ({selectedGoalType?.unit || "valor"})
            </Label>
            <Input
              type="number"
              step="0.1"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={selectedGoalType?.unit === "km" ? "30" : selectedGoalType?.unit === "min" ? "300" : "5"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!targetValue}>
            Crear meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
