import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────

export interface TutoringStudent {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface TutoringClass {
  id: string;
  user_id: string;
  student_id: string;
  date: string;
  duration_hours: number;
  price_per_hour: number;
  status: "scheduled" | "completed" | "cancelled";
  is_paid: boolean;
  notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  // Joined
  student_name?: string;
}

// ── Hook ────────────────────────────────────────────────────

export function useTutoringClasses() {
  const queryClient = useQueryClient();

  // ── Students ──────────────────────────────────────────────

  const { data: students = [] } = useQuery({
    queryKey: ["tutoring-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoring_students")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as TutoringStudent[];
    },
  });

  const addStudent = useMutation({
    mutationFn: async (name: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("tutoring_students")
        .insert({ name, user_id: userData.user.id })
        .select()
        .single();
      if (error) throw error;
      return data as TutoringStudent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoring-students"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteStudent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutoring_students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoring-students"] });
      queryClient.invalidateQueries({ queryKey: ["tutoring-classes"] });
      toast.success("Alumno eliminado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // ── Classes ───────────────────────────────────────────────

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["tutoring-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoring_classes")
        .select("*, tutoring_students(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((c) => ({
        ...c,
        student_name: c.tutoring_students?.name ?? "—",
      })) as TutoringClass[];
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const addClass = useMutation({
    mutationFn: async (
      cls: Omit<TutoringClass, "id" | "user_id" | "created_at" | "student_name">
    ) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("tutoring_classes")
        .insert({ ...cls, user_id: userData.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoring-classes"] });
      toast.success("Clase agregada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateClass = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TutoringClass> & { id: string }) => {
      // Remove joined fields
      const { student_name, ...clean } = updates as any;
      const { data, error } = await supabase
        .from("tutoring_classes")
        .update(clean)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoring-classes"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateClassSilent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TutoringClass> & { id: string }) => {
      const { student_name, ...clean } = updates as any;
      const { data, error } = await supabase
        .from("tutoring_classes")
        .update(clean)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoring-classes"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteClass = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutoring_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoring-classes"] });
      toast.success("Clase eliminada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    students,
    addStudent,
    deleteStudent,
    classes,
    isLoading,
    addClass,
    updateClass,
    updateClassSilent,
    deleteClass,
  };
}
