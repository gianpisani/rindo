import { useState, useRef, useEffect } from "react";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useCustomTheme, PRESET_GRADIENTS } from "@/hooks/useCustomTheme";
import { useTheme } from "next-themes";
import {
  Camera,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Sparkles,
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

export function OnboardingModal({
  open,
  onOpenChange,
  mode = "onboarding",
}: OnboardingModalProps) {
  const { profile, updateProfile, uploadAvatar, avatarUrl } = useUserProfile();
  const { theme, setTheme } = useTheme();

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedGradient, setSelectedGradient] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill in edit mode
  useEffect(() => {
    if (open && profile) {
      setFullName(profile.full_name || "");
      setNickname(profile.nickname || "");
      setLocalAvatarPreview(null);

      // Find matching preset
      if (profile.accent_color_1) {
        const idx = PRESET_GRADIENTS.findIndex(
          (g) => g.color1 === profile.accent_color_1
        );
        setSelectedGradient(idx >= 0 ? idx : 0);
      } else {
        setSelectedGradient(0);
      }

      if (mode === "edit") setStep(0);
    }
  }, [open, profile, mode]);

  const displayInitials = (nickname || fullName || "?").slice(0, 2).toUpperCase();
  const currentAvatarSrc = localAvatarPreview || avatarUrl;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview immediately
    setLocalAvatarPreview(URL.createObjectURL(file));

    setUploading(true);
    try {
      await uploadAvatar.mutateAsync(file);
    } finally {
      setUploading(false);
    }
  };

  const applyGradientPreview = (index: number) => {
    setSelectedGradient(index);
    const gradient = PRESET_GRADIENTS[index];
    const root = document.documentElement;

    if (!gradient.color1) {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--accent-gradient");
      root.style.removeProperty("--ring");
    } else {
      const c1 = gradient.color1;
      const c2 = gradient.color2 || c1;
      root.style.setProperty("--primary", c1);
      root.style.setProperty("--sidebar-primary", c1);
      root.style.setProperty("--ring", c1);
      root.style.setProperty(
        "--accent-gradient",
        `linear-gradient(135deg, ${c1}, ${c2})`
      );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const gradient = PRESET_GRADIENTS[selectedGradient];
      await updateProfile.mutateAsync({
        full_name: fullName || null,
        nickname: nickname || null,
        accent_color_1: gradient.color1,
        accent_color_2: gradient.color2,
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
      // Reset any live preview
      const root = document.documentElement;
      root.style.removeProperty("--primary");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--accent-gradient");
      root.style.removeProperty("--ring");
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
        mode === "onboarding"
          ? "Haz que Rindo se sienta tuyo"
          : undefined
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
          {/* Gradient presets */}
          <div className="space-y-2">
            <Label>Acento</Label>
            <div className="grid grid-cols-4 gap-3">
              {PRESET_GRADIENTS.map((gradient, i) => {
                const isDefault = !gradient.color1;
                const bg = isDefault
                  ? "linear-gradient(135deg, oklch(0.586 0.253 17.585), oklch(0.645 0.246 16.439))"
                  : `linear-gradient(135deg, ${gradient.color1}, ${gradient.color2})`;

                return (
                  <button
                    key={gradient.name}
                    onClick={() => applyGradientPreview(i)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all",
                      selectedGradient === i
                        ? "bg-primary/10 ring-2 ring-primary/30"
                        : "hover:bg-muted"
                    )}
                  >
                    <div
                      className="size-10 rounded-full ring-1 ring-border/50"
                      style={{ background: bg }}
                    />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {gradient.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Light / Dark toggle */}
          <div className="space-y-2">
            <Label>Modo</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-medium",
                  theme === "light"
                    ? "border-primary/30 bg-primary/5 text-foreground"
                    : "border-border/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <Sun className="size-4" />
                Rindo Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-medium",
                  theme === "dark"
                    ? "border-primary/30 bg-primary/5 text-foreground"
                    : "border-border/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <Moon className="size-4" />
                Rindo Dark
              </button>
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
                <Sparkles className="size-4" />
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
