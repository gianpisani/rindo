import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  SPORT_CONFIG,
  INTENSITY_CONFIG,
  WORKOUT_SUBTYPES,
  TRAINING_PHASES,
  RACE_DISTANCES,
} from "@/lib/training-config";
import type { TrainingSession, CreateSessionData } from "@/hooks/useTrainingSessions";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: TrainingSession | null;
  defaultDate?: string;
  onSave: (data: CreateSessionData) => void;
  onDelete?: (id: string) => void;
}

export function SessionFormDrawer({
  open,
  onOpenChange,
  session,
  defaultDate,
  onSave,
}: Props) {
  const isEdit = !!session;

  const [sessionName, setSessionName] = useState("");
  const [sessionDate, setSessionDate] = useState<Date | undefined>();
  const [sportType, setSportType] = useState("running");
  const [intensity, setIntensity] = useState("moderate");
  const [workoutSubtype, setWorkoutSubtype] = useState<string>("");
  const [isRace, setIsRace] = useState(false);
  const [raceName, setRaceName] = useState("");
  const [raceDistance, setRaceDistance] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [targetDuration, setTargetDuration] = useState("");
  const [targetDistance, setTargetDistance] = useState("");
  const [targetHrZone, setTargetHrZone] = useState("");
  const [targetPace, setTargetPace] = useState("");
  const [targetPower, setTargetPower] = useState("");
  const [description, setDescription] = useState("");
  const [coachNotes, setCoachNotes] = useState("");
  const [trainingPhase, setTrainingPhase] = useState("");
  const [garminActivityId, setGarminActivityId] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (session) {
      setSessionName(session.session_name);
      setSessionDate(parseISO(session.session_date));
      setSportType(session.sport_type);
      setIntensity(session.intensity);
      setWorkoutSubtype(session.workout_subtype || "");
      setIsRace(session.is_race || false);
      setRaceName(session.race_name || "");
      setRaceDistance(session.race_distance_label || "");
      setScheduledTime(session.scheduled_time || "");
      setTargetDuration(session.target_duration_minutes?.toString() || "");
      setTargetDistance(
        session.target_distance_meters
          ? (session.target_distance_meters / 1000).toString()
          : ""
      );
      setTargetHrZone(session.target_hr_zone?.toString() || "");
      setTargetPace(session.target_pace_min_km || "");
      setTargetPower(session.target_power_watts?.toString() || "");
      setDescription(session.description || "");
      setCoachNotes(session.coach_notes || "");
      setTrainingPhase(session.training_phase || "");
      setGarminActivityId(session.garmin_activity_id?.toString() || "");
    } else {
      setSessionName("");
      setSessionDate(defaultDate ? parseISO(defaultDate) : new Date());
      setSportType("running");
      setIntensity("moderate");
      setWorkoutSubtype("");
      setIsRace(false);
      setRaceName("");
      setRaceDistance("");
      setScheduledTime("");
      setTargetDuration("");
      setTargetDistance("");
      setTargetHrZone("");
      setTargetPace("");
      setTargetPower("");
      setDescription("");
      setCoachNotes("");
      setTrainingPhase("");
      setGarminActivityId("");
    }
  }, [open, session, defaultDate]);

  const filteredSubtypes = useMemo(
    () =>
      Object.entries(WORKOUT_SUBTYPES).filter(([, v]) =>
        v.sports.includes(sportType)
      ),
    [sportType]
  );

  const handleSave = () => {
    if (!sessionName.trim() || !sessionDate) return;

    const data: CreateSessionData = {
      session_date: format(sessionDate, "yyyy-MM-dd"),
      session_name: sessionName.trim(),
      sport_type: sportType,
      intensity: intensity || "moderate",
      description: description || null,
      target_duration_minutes: targetDuration ? parseInt(targetDuration) : null,
      target_distance_meters: targetDistance ? parseFloat(targetDistance) * 1000 : null,
      target_hr_zone: targetHrZone ? parseInt(targetHrZone) : null,
      target_pace_min_km: targetPace || null,
      target_power_watts: targetPower ? parseInt(targetPower) : null,
      scheduled_time: scheduledTime || null,
      coach_notes: coachNotes || null,
      is_race: isRace,
      race_name: isRace ? raceName || null : null,
      race_distance_label: isRace ? raceDistance || null : null,
      workout_subtype: workoutSubtype || null,
      training_phase: trainingPhase || null,
      garmin_activity_id: garminActivityId ? parseInt(garminActivityId) : null,
    };

    onSave(data);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar sesión" : "Nueva sesión"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-6 mt-4">
          {/* Session Name */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nombre *
            </Label>
            <Input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Easy Run Z2..."
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fecha
            </Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !sessionDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {sessionDate
                    ? format(sessionDate, "PPP", { locale: es })
                    : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={sessionDate}
                  onSelect={(d) => {
                    setSessionDate(d);
                    setCalendarOpen(false);
                  }}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Sport Type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Deporte
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(SPORT_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                const isSelected = sportType === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSportType(key);
                      setWorkoutSubtype("");
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all",
                      isSelected
                        ? cn(config.bg, config.color, "border-current")
                        : "border-border/50 hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intensity */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Intensidad
            </Label>
            <Select value={intensity} onValueChange={setIntensity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INTENSITY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Workout Subtype */}
          {filteredSubtypes.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo de sesión
              </Label>
              <Select value={workoutSubtype} onValueChange={setWorkoutSubtype}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubtypes.map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Race toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Es una carrera
            </Label>
            <Switch checked={isRace} onCheckedChange={setIsRace} />
          </div>

          {isRace && (
            <div className="space-y-3 pl-4 border-l-2 border-rose-500/30">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nombre de la carrera</Label>
                <Input
                  value={raceName}
                  onChange={(e) => setRaceName(e.target.value)}
                  placeholder="Media Maratón Santiago..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Distancia</Label>
                <Select value={raceDistance} onValueChange={setRaceDistance}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RACE_DISTANCES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Targets section */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Objetivos
            </Label>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Horario</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Duración (min)</Label>
                <Input
                  type="number"
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(e.target.value)}
                  placeholder="45"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Distancia (km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={targetDistance}
                  onChange={(e) => setTargetDistance(e.target.value)}
                  placeholder="10.0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Zona HR</Label>
                <Select value={targetHrZone} onValueChange={setTargetHrZone}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((z) => (
                      <SelectItem key={z} value={z.toString()}>
                        Zona {z}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ritmo (/km)</Label>
                <Input
                  value={targetPace}
                  onChange={(e) => setTargetPace(e.target.value)}
                  placeholder="5:30"
                />
              </div>
              {sportType === "cycling" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Potencia (W)</Label>
                  <Input
                    type="number"
                    value={targetPower}
                    onChange={(e) => setTargetPower(e.target.value)}
                    placeholder="200"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Descripción
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles de la sesión..."
              className="min-h-[60px] resize-none"
            />
          </div>

          {/* Coach Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notas del Coach
            </Label>
            <Textarea
              value={coachNotes}
              onChange={(e) => setCoachNotes(e.target.value)}
              placeholder="Instrucciones específicas..."
              className="min-h-[60px] resize-none"
            />
          </div>

          {/* Training Phase */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fase de entrenamiento
            </Label>
            <Select value={trainingPhase} onValueChange={setTrainingPhase}>
              <SelectTrigger>
                <SelectValue placeholder="Sin fase" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRAINING_PHASES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Garmin Activity ID */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Garmin Activity ID
            </Label>
            <Input
              type="number"
              value={garminActivityId}
              onChange={(e) => setGarminActivityId(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="sticky bottom-0 pt-4 pb-2 bg-background border-t mt-4">
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={!sessionName.trim() || !sessionDate}
          >
            {isEdit ? "Guardar cambios" : "Crear sesión"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
