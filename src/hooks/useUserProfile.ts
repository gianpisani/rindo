import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { toast } from "sonner";
import { optimistic } from "./optimistic";

export type NavPreferencesData = {
  sidebarOrder: string[];
  hiddenRoutes: string[];
  mobileTabs: string[];
};

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_path: string | null;
  accent_color_1: string | null;
  accent_color_2: string | null;
  onboarding_completed: boolean;
  nav_preferences: NavPreferencesData | null;
  period_start_day: number;
  created_at: string;
  updated_at: string;
}

function squareCropped(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = maxSize;
      canvas.height = maxSize;
      const ctx = canvas.getContext("2d")!;

      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to resize image"));
        },
        "image/png",
        0.9
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

type ProfilePatch = Partial<Omit<UserProfile, "id" | "user_id" | "created_at" | "updated_at">>;

const PROFILE_KEY = ["user-profile"];
const AVATAR_SIZE = 256;

export const userProfileQuery = queryOptions({
  queryKey: PROFILE_KEY,
  queryFn: async () => {
    const userId = await requireUserId();
    const { data, error } = await supabase.from("user_profiles").select("*").eq("user_id", userId).single();
    if (error) throw error;
    return data as UserProfile;
  },
  staleTime: 1000 * 60 * 5,
});

async function updateOwnProfile(changes: ProfilePatch) {
  const userId = await requireUserId();
  const { error } = await supabase.from("user_profiles").update(changes).eq("user_id", userId);
  if (error) throw error;
  return userId;
}

export function useUserProfile() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery(userProfileQuery);
  const refresh = () => queryClient.invalidateQueries({ queryKey: PROFILE_KEY });

  const updateProfile = useMutation({
    mutationFn: updateOwnProfile,
    ...optimistic<UserProfile, ProfilePatch>(queryClient, PROFILE_KEY, (current, changes) => ({ ...current, ...changes })),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const userId = await requireUserId();
      const avatarPath = `${userId}/avatar.png`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(avatarPath, await squareCropped(file, AVATAR_SIZE), { upsert: true, contentType: "image/png" });
      if (error) throw error;
      await updateOwnProfile({ avatar_path: avatarPath });
    },
    onSuccess: () => toast.success("Avatar actualizado"),
    onSettled: refresh,
  });

  const removeAvatar = useMutation({
    mutationFn: async () => {
      if (profile?.avatar_path) {
        const { error } = await supabase.storage.from("avatars").remove([profile.avatar_path]);
        if (error) console.warn("No se pudo borrar el archivo del avatar", error);
      }
      await updateOwnProfile({ avatar_path: null });
    },
    onSettled: refresh,
  });

  const avatarUrl = profile?.avatar_path
    ? `${supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl}?t=${profile.updated_at}`
    : null;

  return { profile, isLoading, updateProfile, uploadAvatar, removeAvatar, avatarUrl };
}
