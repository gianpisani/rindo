import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_path: string | null;
  accent_color_1: string | null;
  accent_color_2: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = maxSize;
      canvas.height = maxSize;
      const ctx = canvas.getContext("2d")!;

      // Cover crop (center)
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

export function useUserProfile() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
    staleTime: 1000 * 60 * 5,
  });

  const updateProfile = useMutation({
    mutationFn: async (
      updates: Partial<
        Omit<UserProfile, "id" | "user_id" | "created_at" | "updated_at">
      >
    ) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("user_id", userData.user.id)
        .select()
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const resized = await resizeImage(file, 256);
      const filePath = `${userData.user.id}/avatar.png`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, resized, {
          upsert: true,
          contentType: "image/png",
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ avatar_path: filePath })
        .eq("user_id", userData.user.id);

      if (updateError) throw updateError;

      return filePath;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Avatar actualizado");
    },
    onError: (error: Error) => {
      toast.error(`Error al subir avatar: ${error.message}`);
    },
  });

  const removeAvatar = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      if (profile?.avatar_path) {
        await supabase.storage.from("avatars").remove([profile.avatar_path]);
      }

      const { error } = await supabase
        .from("user_profiles")
        .update({ avatar_path: null })
        .eq("user_id", userData.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar avatar: ${error.message}`);
    },
  });

  const avatarUrl = profile?.avatar_path
    ? supabase.storage
        .from("avatars")
        .getPublicUrl(profile.avatar_path).data.publicUrl +
      `?t=${profile.updated_at}`
    : null;

  return {
    profile,
    isLoading,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    avatarUrl,
  };
}
