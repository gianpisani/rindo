import { useState, useRef, useEffect, useCallback } from "react";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  THEME_PRESETS,
  FONT_OPTIONS,
  applyThemePreview,
  applyFontPreview,
  applyRadiusPreview,
  clearThemeOverrides,
  generatePaletteFromHue,
  parseCustomSettings,
  type CustomThemeSettings,
} from "@/hooks/useCustomTheme";
import { useTheme } from "next-themes";
import {
  Camera,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Save,
  User,
  Palette,
  Check,
  Loader2,
  Trash2,
  Paintbrush,
  Type,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "onboarding" | "edit";
}

const STEPS = [
  { icon: User, label: "Nombre" },
  { icon: Camera, label: "Avatar" },
  { icon: Palette, label: "Tema" },
];

const DEFAULT_RADIUS = 0.65;

// ── Mini preview card for a theme palette ─────────────────────────────
function ThemePreviewCard({
  palette,
  name,
  selected,
  onClick,
}: {
  palette: {
    background: string;
    card: string;
    primary: string;
    foreground: string;
    muted: string;
    border: string;
  };
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition-all duration-200",
        selected
          ? "ring-2 ring-primary/40 bg-primary/5 scale-[1.02]"
          : "hover:bg-muted/50 active:scale-[0.97]"
      )}
    >
      <div
        className="w-full aspect-[4/3] rounded-lg overflow-hidden border"
        style={{
          backgroundColor: palette.background,
          borderColor: palette.border,
        }}
      >
        <div className="flex h-full">
          <div className="w-1/4 h-full" style={{ backgroundColor: palette.muted }}>
            <div
              className="w-2/3 h-1 rounded-full mt-2 mx-auto"
              style={{ backgroundColor: palette.primary }}
            />
            <div
              className="w-1/2 h-0.5 rounded-full mt-1.5 mx-auto opacity-40"
              style={{ backgroundColor: palette.foreground }}
            />
            <div
              className="w-1/2 h-0.5 rounded-full mt-1 mx-auto opacity-30"
              style={{ backgroundColor: palette.foreground }}
            />
          </div>
          <div className="flex-1 p-1.5 space-y-1">
            <div
              className="w-3/4 h-1 rounded-full"
              style={{ backgroundColor: palette.foreground, opacity: 0.7 }}
            />
            <div
              className="w-full h-4 rounded"
              style={{
                backgroundColor: palette.card,
                border: `0.5px solid ${palette.border}`,
              }}
            >
              <div
                className="w-1/2 h-0.5 rounded-full mt-1 ml-1"
                style={{ backgroundColor: palette.primary }}
              />
            </div>
            <div
              className="w-full h-3 rounded"
              style={{
                backgroundColor: palette.card,
                border: `0.5px solid ${palette.border}`,
              }}
            />
          </div>
        </div>
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">{name}</span>
    </button>
  );
}

// ── Custom hue slider with rainbow track and glass thumb ──────────────
function HueSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (hue: number) => void;
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

  const pct = (value / 360) * 100;

  return (
    <div
      ref={trackRef}
      className="relative h-9 cursor-pointer touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      {/* Rainbow track */}
      <div
        className="absolute inset-y-[10px] inset-x-0 rounded-full"
        style={{
          background:
            "linear-gradient(to right, oklch(0.65 0.25 0), oklch(0.65 0.25 45), oklch(0.65 0.25 90), oklch(0.65 0.25 135), oklch(0.65 0.25 180), oklch(0.65 0.25 225), oklch(0.65 0.25 270), oklch(0.65 0.25 315), oklch(0.65 0.25 360))",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)",
        }}
      />
      {/* Glass thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 size-[22px] rounded-full pointer-events-none transition-[left] duration-75 ease-out"
        style={{
          left: `calc(${pct}% - 11px)`,
          backgroundColor: `oklch(0.65 0.25 ${value})`,
          border: "3px solid rgba(255,255,255,0.9)",
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.3)",
        }}
      />
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────
function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Palette;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="size-3.5 text-muted-foreground/70" />
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {children}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
export function OnboardingModal({
  open,
  onOpenChange,
  mode = "onboarding",
}: OnboardingModalProps) {
  const { profile, updateProfile, uploadAvatar, removeAvatar, avatarUrl } =
    useUserProfile();
  const { setTheme, resolvedTheme } = useTheme();

  const [step, setStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [animating, setAnimating] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [customHue, setCustomHue] = useState(240);
  const [selectedFont, setSelectedFont] = useState<string>("default");
  const [customRadius, setCustomRadius] = useState(DEFAULT_RADIUS);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill on open
  useEffect(() => {
    if (open && profile && !initialized) {
      setFullName(profile.full_name || "");
      setNickname(profile.nickname || "");
      setLocalAvatarPreview(null);
      setSelectedTheme(profile.accent_color_1 || null);
      const settings = parseCustomSettings(profile.accent_color_2);
      setCustomHue(settings.hue ?? 240);
      setSelectedFont(settings.font ?? "default");
      setCustomRadius(settings.radius ?? DEFAULT_RADIUS);
      if (mode === "edit") setStep(0);
      setInitialized(true);
    }
    if (!open) setInitialized(false);
  }, [open, profile, mode, initialized]);

  const goToStep = useCallback(
    (target: number) => {
      if (target === step || animating) return;
      setSlideDirection(target > step ? "right" : "left");
      setAnimating(true);
      setTimeout(() => {
        setStep(target);
        setTimeout(() => setAnimating(false), 20);
      }, 150);
    },
    [step, animating]
  );

  const displayInitials = (nickname || fullName || "?").slice(0, 2).toUpperCase();
  const currentAvatarSrc = localAvatarPreview || avatarUrl;
  const currentMode = (resolvedTheme || "dark") as "light" | "dark";

  const buildCustomSettings = useCallback((): string | null => {
    const settings: CustomThemeSettings = {};
    if (selectedTheme === "custom") settings.hue = customHue;
    if (selectedFont !== "default") settings.font = selectedFont;
    if (Math.abs(customRadius - DEFAULT_RADIUS) > 0.01) settings.radius = customRadius;
    return Object.keys(settings).length > 0 ? JSON.stringify(settings) : null;
  }, [selectedTheme, customHue, selectedFont, customRadius]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalAvatarPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      await uploadAvatar.mutateAsync(file);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectTheme = useCallback(
    (themeId: string | null) => {
      setSelectedTheme(themeId);
      applyThemePreview(themeId, currentMode, { hue: customHue });
    },
    [currentMode, customHue]
  );

  const handleCustomHue = useCallback(
    (hue: number) => {
      setCustomHue(hue);
      setSelectedTheme("custom");
      applyThemePreview("custom", currentMode, { hue });
    },
    [currentMode]
  );

  const handleFontChange = useCallback((fontId: string) => {
    setSelectedFont(fontId);
    applyFontPreview(fontId);
  }, []);

  const handleRadiusChange = useCallback((radius: number) => {
    setCustomRadius(radius);
    applyRadiusPreview(radius);
  }, []);

  const handleToggleMode = useCallback(
    (newMode: "light" | "dark") => {
      setTheme(newMode);
      setTimeout(() => {
        applyThemePreview(selectedTheme, newMode, { hue: customHue });
      }, 50);
    },
    [selectedTheme, setTheme, customHue]
  );

  const handleRemoveAvatar = async () => {
    setUploading(true);
    try {
      await removeAvatar.mutateAsync();
      setLocalAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        full_name: fullName || null,
        nickname: nickname || null,
        accent_color_1: selectedTheme,
        accent_color_2: buildCustomSettings(),
        onboarding_completed: true,
      });
      const name = nickname || fullName;
      if (mode === "onboarding" && name) {
        toast.success(`Listo, bienvenido ${name}!`);
      } else if (mode === "edit") {
        toast.success("Perfil actualizado");
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSkipAll = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({ onboarding_completed: true });
      clearThemeOverrides();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const isLastStep = step === STEPS.length - 1;
  const customPalette = generatePaletteFromHue(customHue, currentMode);

  return (
    <BaseModal
      open={open}
      onOpenChange={
        mode === "onboarding"
          ? (v) => {
              if (!v) handleSkipAll();
            }
          : onOpenChange
      }
      title={mode === "edit" ? "Editar perfil" : "Personaliza tu experiencia"}
      description={mode === "onboarding" ? "Haz que Rindo se sienta tuyo" : undefined}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between">
          <div>
            {step > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToStep(step - 1)}
                className="gap-1"
              >
                <ChevronLeft className="size-4" />
                Anterior
              </Button>
            ) : mode === "onboarding" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkipAll}
                disabled={saving}
                className="text-muted-foreground"
              >
                Omitir
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {isLastStep ? (
              <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {mode === "edit" ? "Guardar" : "Empezar"}
              </Button>
            ) : (
              <Button onClick={() => goToStep(step + 1)} size="sm" className="gap-1">
                Siguiente
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Step indicators */}
      <p className="text-center text-xs text-muted-foreground mb-2">
        Paso {step + 1} de {STEPS.length}
      </p>
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => goToStep(i)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                i === step
                  ? "bg-primary/10 text-primary"
                  : i < step
                    ? "text-primary/60"
                    : "text-muted-foreground"
              )}
            >
              {i < step ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step content with slide transition */}
      <div
        className={cn(
          "transition-all duration-200 ease-out",
          animating && slideDirection === "right" && "opacity-0 translate-x-4",
          animating && slideDirection === "left" && "opacity-0 -translate-x-4",
          !animating && "opacity-100 translate-x-0"
        )}
      >
        {/* Step 0: Name */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Apodo</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Como quieres que te saludemos?"
              />
              <p className="text-xs text-muted-foreground">
                Este nombre aparece en el saludo de la home
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Avatar */}
        {step === 1 && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <Avatar className="size-28 rounded-2xl ring-2 ring-primary/20">
                {currentAvatarSrc && (
                  <AvatarImage
                    src={currentAvatarSrc}
                    className="rounded-2xl object-cover"
                  />
                )}
                <AvatarFallback className="rounded-2xl bg-primary/10 text-primary text-2xl font-bold">
                  {displayInitials}
                </AvatarFallback>
              </Avatar>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-2xl">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Camera className="size-4" />
                {currentAvatarSrc ? "Cambiar foto" : "Subir foto"}
              </Button>
              {currentAvatarSrc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Eliminar
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            <p className="text-xs text-muted-foreground text-center">
              PNG, JPG o WebP. Se recorta a 256x256.
            </p>
          </div>
        )}

        {/* Step 2: Full theme customization */}
        {step === 2 && (
          <div className="space-y-6 max-h-[55vh] overflow-y-auto overscroll-contain pr-1 -mr-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            {/* ── Light / Dark ────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleToggleMode("light")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 text-sm font-medium",
                  currentMode === "light"
                    ? "border-primary/30 bg-primary/5 text-foreground shadow-sm"
                    : "border-border/50 text-muted-foreground hover:bg-muted active:scale-[0.97]"
                )}
              >
                <Sun className="size-4" />
                Light
              </button>
              <button
                onClick={() => handleToggleMode("dark")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 text-sm font-medium",
                  currentMode === "dark"
                    ? "border-primary/30 bg-primary/5 text-foreground shadow-sm"
                    : "border-border/50 text-muted-foreground hover:bg-muted active:scale-[0.97]"
                )}
              >
                <Moon className="size-4" />
                Dark
              </button>
            </div>

            {/* ── Color ───────────────────────────────────────── */}
            <div>
              <SectionLabel icon={Palette}>Color</SectionLabel>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-0.5">
                {/* Default Rindo */}
                <ThemePreviewCard
                  palette={{
                    background:
                      currentMode === "dark"
                        ? "oklch(0.098 0.005 285.823)"
                        : "oklch(1 0 0)",
                    card:
                      currentMode === "dark"
                        ? "oklch(0.141 0.005 285.823)"
                        : "oklch(1 0 0)",
                    primary:
                      currentMode === "dark"
                        ? "oklch(0.645 0.246 16.439)"
                        : "oklch(0.586 0.253 17.585)",
                    foreground:
                      currentMode === "dark"
                        ? "oklch(0.985 0 0)"
                        : "oklch(0.141 0.005 285.823)",
                    muted:
                      currentMode === "dark"
                        ? "oklch(0.21 0.006 285.885)"
                        : "oklch(0.967 0.001 286.375)",
                    border:
                      currentMode === "dark"
                        ? "oklch(0.28 0.006 285)"
                        : "oklch(0.92 0.004 286.32)",
                  }}
                  name="Rindo"
                  selected={selectedTheme === null}
                  onClick={() => handleSelectTheme(null)}
                />
                {/* Presets */}
                {THEME_PRESETS.map((preset) => {
                  const palette = currentMode === "dark" ? preset.dark : preset.light;
                  return (
                    <ThemePreviewCard
                      key={preset.id}
                      palette={palette}
                      name={preset.name}
                      selected={selectedTheme === preset.id}
                      onClick={() => handleSelectTheme(preset.id)}
                    />
                  );
                })}
                {/* Custom — gradient card with icon */}
                <button
                  onClick={() => handleSelectTheme("custom")}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition-all duration-200",
                    selectedTheme === "custom"
                      ? "ring-2 ring-primary/40 bg-primary/5 scale-[1.02]"
                      : "hover:bg-muted/50 active:scale-[0.97]"
                  )}
                >
                  <div
                    className="w-full aspect-[4/3] rounded-lg overflow-hidden flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, oklch(0.6 0.22 ${customHue}), oklch(0.7 0.18 ${customHue + 80}))`,
                    }}
                  >
                    <Paintbrush className="size-5 text-white/90 drop-shadow-md" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Custom
                  </span>
                </button>
              </div>

              {/* Hue slider — slides in when custom selected */}
              {selectedTheme === "custom" && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <HueSlider value={customHue} onChange={handleCustomHue} />
                </div>
              )}
            </div>

            {/* ── Fuente ──────────────────────────────────────── */}
            <div>
              <SectionLabel icon={Type}>Fuente</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => handleFontChange(font.id)}
                    className={cn(
                      "relative flex flex-col items-start px-3 py-2.5 rounded-xl border transition-all duration-200 text-left",
                      selectedFont === font.id
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : "border-border/50 hover:bg-muted/50 hover:border-border active:scale-[0.97]"
                    )}
                  >
                    {selectedFont === font.id && (
                      <div className="absolute top-2 right-2 size-4 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="size-2.5 text-primary" />
                      </div>
                    )}
                    <span
                      className="text-sm font-semibold leading-tight"
                      style={{ fontFamily: font.family }}
                    >
                      {font.name}
                    </span>
                    <span
                      className="text-[10px] text-muted-foreground mt-0.5"
                      style={{ fontFamily: font.family }}
                    >
                      Hola mundo $1.234
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Redondez ────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Circle className="size-3.5 text-muted-foreground/70" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Redondez
                  </span>
                </div>
                {/* Live mini preview */}
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-7 h-5 border-2 border-primary/30 bg-primary/8 transition-all duration-150"
                    style={{ borderRadius: `${customRadius * 0.6}rem` }}
                  />
                  <div
                    className="w-10 h-5 border-2 border-primary/30 bg-primary/8 transition-all duration-150"
                    style={{ borderRadius: `${customRadius}rem` }}
                  />
                </div>
              </div>
              <Slider
                value={[customRadius]}
                onValueChange={([v]) => handleRadiusChange(v)}
                min={0}
                max={1.5}
                step={0.05}
              />
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/60">
                <span>Cuadrado</span>
                <span>Redondeado</span>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* end slide wrapper */}
    </BaseModal>
  );
}
