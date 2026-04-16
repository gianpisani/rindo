import { useState, useRef, useEffect, useCallback } from "react";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  THEME_PRESETS,
  applyThemePreview,
  clearThemeOverrides,
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
} from "lucide-react";
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

// Mini preview card for a theme palette
function ThemePreviewCard({
  palette,
  name,
  selected,
  onClick,
}: {
  palette: { background: string; card: string; primary: string; foreground: string; muted: string; border: string };
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition-all",
        selected ? "ring-2 ring-primary/40 bg-primary/5" : "hover:bg-muted/50"
      )}
    >
      {/* Mini app preview */}
      <div
        className="w-full aspect-[4/3] rounded-lg overflow-hidden border"
        style={{
          backgroundColor: palette.background,
          borderColor: palette.border,
        }}
      >
        {/* Mini sidebar */}
        <div className="flex h-full">
          <div
            className="w-1/4 h-full"
            style={{ backgroundColor: palette.muted }}
          >
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
          {/* Mini content */}
          <div className="flex-1 p-1.5 space-y-1">
            <div
              className="w-3/4 h-1 rounded-full"
              style={{ backgroundColor: palette.foreground, opacity: 0.7 }}
            />
            <div
              className="w-full h-4 rounded"
              style={{ backgroundColor: palette.card, border: `0.5px solid ${palette.border}` }}
            >
              <div
                className="w-1/2 h-0.5 rounded-full mt-1 ml-1"
                style={{ backgroundColor: palette.primary }}
              />
            </div>
            <div
              className="w-full h-3 rounded"
              style={{ backgroundColor: palette.card, border: `0.5px solid ${palette.border}` }}
            />
          </div>
        </div>
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">
        {name}
      </span>
    </button>
  );
}

export function OnboardingModal({
  open,
  onOpenChange,
  mode = "onboarding",
}: OnboardingModalProps) {
  const { profile, updateProfile, uploadAvatar, avatarUrl } = useUserProfile();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(
    null
  );
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill ONLY on open (not on profile changes, fixing the race condition)
  useEffect(() => {
    if (open && profile && !initialized) {
      setFullName(profile.full_name || "");
      setNickname(profile.nickname || "");
      setLocalAvatarPreview(null);
      setSelectedTheme(profile.accent_color_1 || null);
      if (mode === "edit") setStep(0);
      setInitialized(true);
    }
    if (!open) {
      setInitialized(false);
    }
  }, [open, profile, mode, initialized]);

  const displayInitials = (nickname || fullName || "?")
    .slice(0, 2)
    .toUpperCase();
  const currentAvatarSrc = localAvatarPreview || avatarUrl;
  const currentMode = (resolvedTheme || "dark") as "light" | "dark";

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
      applyThemePreview(themeId, currentMode);
    },
    [currentMode]
  );

  const handleToggleMode = useCallback(
    (newMode: "light" | "dark") => {
      setTheme(newMode);
      // Re-apply selected theme with new mode (effect runs after theme resolves)
      setTimeout(() => {
        applyThemePreview(selectedTheme, newMode);
      }, 50);
    },
    [selectedTheme, setTheme]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        full_name: fullName || null,
        nickname: nickname || null,
        accent_color_1: selectedTheme,
        accent_color_2: null,
        onboarding_completed: true,
      });
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

  return (
    <BaseModal
      open={open}
      onOpenChange={mode === "onboarding" ? undefined! : onOpenChange}
      title={mode === "edit" ? "Editar perfil" : "Personaliza tu experiencia"}
      description={
        mode === "onboarding" ? "Haz que Rindo se sienta tuyo" : undefined
      }
      maxWidth="md"
    >
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                i === step
                  ? "bg-primary/10 text-primary"
                  : i < step
                    ? "text-primary/60"
                    : "text-muted-foreground"
              )}
            >
              {i < step ? (
                <Check className="size-3.5" />
              ) : (
                <Icon className="size-3.5" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

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

      {/* Step 2: Theme */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Light / Dark toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleToggleMode("light")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium",
                currentMode === "light"
                  ? "border-primary/30 bg-primary/5 text-foreground"
                  : "border-border/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <Sun className="size-4" />
              Light
            </button>
            <button
              onClick={() => handleToggleMode("dark")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium",
                currentMode === "dark"
                  ? "border-primary/30 bg-primary/5 text-foreground"
                  : "border-border/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <Moon className="size-4" />
              Dark
            </button>
          </div>

          {/* Theme presets */}
          <div className="space-y-2">
            <Label>Tema</Label>
            <div className="grid grid-cols-3 gap-2">
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
              {/* Custom presets */}
              {THEME_PRESETS.map((preset) => {
                const palette =
                  currentMode === "dark" ? preset.dark : preset.light;
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
            </div>
          </div>
        </div>
      )}

      {/* Navigation footer */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
        <div>
          {step > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(step - 1)}
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
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {mode === "edit" ? "Guardar" : "Empezar"}
            </Button>
          ) : (
            <Button
              onClick={() => setStep(step + 1)}
              size="sm"
              className="gap-1"
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
