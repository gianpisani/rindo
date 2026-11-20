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
  findPreset,
  FONT_OPTIONS,
  applyThemePreview,
  applyFontPreview,
  applyRadiusPreview,
  clearThemeOverrides,
  generatePaletteFromHue,
  parseCustomSettings,
  type CustomThemeSettings,
  type PaletteVars,
} from "@/hooks/useCustomTheme";
import { useTheme } from "next-themes";
import {
  Camera,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Monitor,
  Save,
  User,
  Palette,
  Check,
  Loader2,
  Trash2,
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

const DEFAULT_RADIUS = 0.75;

// ── Mini preview card for a theme palette ─────────────────────────────
// Una miniatura de la app con los colores que se van a aplicar: fondo,
// barra lateral con la navegación activa en el acento y tarjetas con su
// texto y su texto secundario.
type PreviewPalette = Pick<
  PaletteVars,
  "background" | "card" | "sidebar" | "primary" | "foreground" | "mutedForeground" | "border"
>;

// El tema Rindo de index.css, para su miniatura.
const RINDO_PREVIEW: Record<"light" | "dark", PreviewPalette> = {
  light: {
    background: "oklch(0.965 0.002 286)",
    card: "oklch(0.995 0 0)",
    sidebar: "oklch(0.955 0.002 286)",
    primary: "oklch(0.586 0.253 17.585)",
    foreground: "oklch(0.13 0.005 285.823)",
    mutedForeground: "oklch(0.355 0.016 285.938)",
    border: "oklch(0.835 0.008 286)",
  },
  dark: {
    background: "oklch(0.098 0.005 285.823)",
    card: "oklch(0.141 0.005 285.823)",
    sidebar: "oklch(0.12 0.005 285.823)",
    primary: "oklch(0.645 0.246 16.439)",
    foreground: "oklch(0.985 0 0)",
    mutedForeground: "oklch(0.705 0.015 286.067)",
    border: "oklch(1 0 0 / 8%)",
  },
};

function ThemePreviewCard({
  palette,
  name,
  selected,
  onClick,
}: {
  palette: PreviewPalette;
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  const line = (color: string, width: string) => (
    <div className="h-1 rounded-full" style={{ backgroundColor: color, width }} />
  );
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 p-1.5 rounded-card transition-all duration-200",
        selected ? "ring-2 ring-foreground" : "active:scale-[0.97]"
      )}
    >
      <div
        className="flex w-full aspect-[4/3] rounded-card overflow-hidden border"
        style={{ backgroundColor: palette.background, borderColor: palette.border }}
      >
        <div
          className="w-1/4 h-full flex flex-col items-center gap-1 pt-2 border-r"
          style={{ backgroundColor: palette.sidebar, borderColor: palette.border }}
        >
          <div className="size-1.5 rounded-full" style={{ backgroundColor: palette.primary }} />
          {line(palette.mutedForeground, "50%")}
          {line(palette.mutedForeground, "50%")}
        </div>
        <div className="flex-1 p-1.5 space-y-1">
          {line(palette.foreground, "60%")}
          <div
            className="rounded-card border p-1 space-y-1"
            style={{ backgroundColor: palette.card, borderColor: palette.border }}
          >
            {line(palette.foreground, "70%")}
            {line(palette.mutedForeground, "45%")}
          </div>
          <div
            className="rounded-card border p-1"
            style={{ backgroundColor: palette.card, borderColor: palette.border }}
          >
            {line(palette.mutedForeground, "55%")}
          </div>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{name}</span>
    </button>
  );
}

// ── Custom hue slider with rainbow track and glass thumb ──────────────
function HueSlider({
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

  const pct = (value / 360) * 100;
  // La barra muestra los acentos de verdad, no un arcoíris decorativo: el
  // color bajo el dedo es exactamente el que va a quedar en la app.
  const track = Array.from({ length: 13 }, (_, i) =>
    generatePaletteFromHue(i * 30, mode).primary
  ).join(", ");
  const thumb = generatePaletteFromHue(value, mode).primary;

  return (
    <div
      ref={trackRef}
      className="relative h-9 cursor-pointer touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      {/* Barra de tonos */}
      <div
        className="absolute inset-y-[10px] inset-x-0 rounded-full"
        style={{
          background: `linear-gradient(to right, ${track})`,
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)",
        }}
      />
      {/* Glass thumb */}
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
      <Icon className="size-3.5" />
      <span className="text-xs font-medium text-muted-foreground">
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
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [step, setStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [animating, setAnimating] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [customHue, setCustomHue] = useState(240);
  const [selectedFont, setSelectedFont] = useState<string>("default");
  const [customRadius, setCustomRadius] = useState(DEFAULT_RADIUS);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill on open
  useEffect(() => {
    if (open && profile && !initialized) {
      setFullName(profile.full_name || "");
      setNickname(profile.nickname || "");
      setLocalAvatarPreview(null);
      const saved = profile.accent_color_1;
      // Un id retirado se muestra como el tema al que hoy apunta.
      setSelectedTheme(saved === "custom" ? saved : findPreset(saved)?.id ?? null);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalAvatarPreview(URL.createObjectURL(file));
    uploadAvatar.mutate(file);
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
    (value: "light" | "dark" | "system") => {
      setTheme(value);
      const newMode =
        value === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
          : value;
      setTimeout(() => {
        applyThemePreview(selectedTheme, newMode, { hue: customHue });
      }, 50);
    },
    [selectedTheme, setTheme, customHue]
  );

  const handleRemoveAvatar = () => {
    removeAvatar.mutate(undefined, { onSuccess: () => setLocalAvatarPreview(null) });
  };

  const handleSave = () => {
    updateProfile.mutate(
      {
        full_name: fullName || null,
        nickname: nickname || null,
        accent_color_1: selectedTheme,
        accent_color_2: buildCustomSettings(),
        onboarding_completed: true,
      },
      {
        onSuccess: () => {
          const name = nickname || fullName;
          if (mode === "onboarding" && name) toast.success(`Listo, bienvenido ${name}!`);
          else if (mode === "edit") toast.success("Perfil actualizado");
          onOpenChange(false);
        },
      },
    );
  };

  const handleSkipAll = () => {
    updateProfile.mutate(
      { onboarding_completed: true },
      {
        onSuccess: () => {
          clearThemeOverrides();
          onOpenChange(false);
        },
      },
    );
  };

  const saving = updateProfile.isPending;
  const uploading = uploadAvatar.isPending || removeAvatar.isPending;

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
              aria-label={s.label}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                i > step && "text-muted-foreground"
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
              <Avatar className="size-28 rounded-full ring-2 ring-border">
                {currentAvatarSrc && (
                  <AvatarImage
                    src={currentAvatarSrc}
                    alt=""
                    className="rounded-full object-cover"
                  />
                )}
                <AvatarFallback className="rounded-full text-xl font-medium">
                  {displayInitials}
                </AvatarFallback>
              </Avatar>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
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
            {/* ── Claro / Oscuro / Sistema: el único lugar donde se elige ── */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-muted">
              {([
                { value: "light", label: "Claro", icon: Sun },
                { value: "dark", label: "Oscuro", icon: Moon },
                { value: "system", label: "Sistema", icon: Monitor },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleToggleMode(value)}
                  className={cn(
                    "flex h-9 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors",
                    (theme ?? "system") === value
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* ── Color ───────────────────────────────────────── */}
            <div>
              <SectionLabel icon={Palette}>Color</SectionLabel>
              <div className="grid grid-cols-4 gap-2 p-0.5">
                {/* Default Rindo */}
                <ThemePreviewCard
                  palette={RINDO_PREVIEW[currentMode]}
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
                {/* Custom: la miniatura muestra el tono del slider */}
                <ThemePreviewCard
                  palette={customPalette}
                  name="Custom"
                  selected={selectedTheme === "custom"}
                  onClick={() => handleSelectTheme("custom")}
                />
              </div>

              {/* Hue slider — slides in when custom selected */}
              {selectedTheme === "custom" && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <HueSlider value={customHue} onChange={handleCustomHue} mode={currentMode} />
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
                      "relative flex flex-col items-start px-3 py-2 rounded-card border transition-all duration-200 text-left",
                      selectedFont !== font.id &&
                        "hover:border-border active:scale-[0.97]"
                    )}
                  >
                    {selectedFont === font.id && (
                      <div className="absolute top-2 right-2 size-4 rounded-full flex items-center justify-center">
                        <Check className="size-2.5 text-foreground" />
                      </div>
                    )}
                    <span
                      className="text-sm font-medium leading-tight"
                      style={{ fontFamily: font.family }}
                    >
                      {font.name}
                    </span>
                    <span
                      className="text-xs text-muted-foreground mt-0.5"
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
                  <Circle className="size-3.5" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Redondez
                  </span>
                </div>
                {/* Live mini preview */}
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-7 h-5 border-2 transition-all duration-150"
                    style={{ borderRadius: `${customRadius * 0.6}rem` }}
                  />
                  <div
                    className="w-10 h-5 border-2 transition-all duration-150"
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
              <div className="flex justify-between mt-1.5 text-xs">
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
