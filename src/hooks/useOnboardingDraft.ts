import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useUserProfile } from "./useUserProfile";
import { useThemeDraft } from "./useThemeDraft";
import { clearThemeOverrides } from "@/lib/theme";
import { profileInitials, themeChoiceFromProfile } from "@/lib/theme-choice";

export type OnboardingMode = "onboarding" | "edit";

export function useOnboardingDraft({
  open,
  mode,
  onOpenChange,
  restartSteps,
}: {
  open: boolean;
  mode: OnboardingMode;
  onOpenChange: (open: boolean) => void;
  restartSteps: () => void;
}) {
  const { profile, updateProfile, uploadAvatar, removeAvatar, avatarUrl } = useUserProfile();
  const themeDraft = useThemeDraft();
  const loadTheme = themeDraft.load;

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (open && profile && !initialized) {
      setFullName(profile.full_name || "");
      setNickname(profile.nickname || "");
      setLocalAvatarPreview(null);
      loadTheme(themeChoiceFromProfile(profile.accent_color_1, profile.accent_color_2));
      if (mode === "edit") restartSteps();
      setInitialized(true);
    }
    if (!open) setInitialized(false);
  }, [open, profile, mode, initialized, loadTheme, restartSteps]);

  const selectAvatarFile = (file: File) => {
    setLocalAvatarPreview(URL.createObjectURL(file));
    uploadAvatar.mutate(file);
  };

  const removeAvatarPhoto = () => {
    removeAvatar.mutate(undefined, { onSuccess: () => setLocalAvatarPreview(null) });
  };

  const save = () => {
    updateProfile.mutate(
      {
        full_name: fullName || null,
        nickname: nickname || null,
        accent_color_1: themeDraft.selectedTheme,
        accent_color_2: themeDraft.buildCustomSettings(),
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

  const skipAll = () => {
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

  return {
    fullName,
    setFullName,
    nickname,
    setNickname,
    initials: profileInitials(nickname, fullName),
    avatarSrc: localAvatarPreview || avatarUrl,
    uploading: uploadAvatar.isPending || removeAvatar.isPending,
    saving: updateProfile.isPending,
    selectAvatarFile,
    removeAvatarPhoto,
    save,
    skipAll,
    themeDraft,
  };
}
