import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LearningSession } from "./useLearningSessions";
import type { ContentType } from "@/lib/learning-config";
import {
  HEARTBEAT_MS,
  IDLE_AUTO_PAUSE_MS,
  STALE_HEARTBEAT_MS,
  comprehensionScore,
  inferDifficulty,
} from "@/lib/learning-config";

export interface StartSessionInput {
  goal_id: string;
  content_type: ContentType;
  content_url?: string | null;
  external_id?: string | null;
  content_title?: string | null;
  content_author?: string | null;
  content_thumbnail?: string | null;
  content_duration_seconds?: number | null;
  /** Punto de arranque, si el link traía un ?t=. */
  last_position_seconds?: number;
}

/**
 * La comprensión puede quedar en null: si dejas un contenido a medias y lo
 * guardas sin evaluar, la sesión cuenta con su tiempo pero no inventa una
 * nota. Es la única métrica honesta de progreso, así que vale más un hueco
 * que un número puesto por cumplir.
 */
export interface ReflectionInput {
  comp_main_idea: number | null;
  comp_subtitles: number | null;
  comp_explain: number | null;
  main_idea_text: string | null;
}

const OPEN_SESSION_KEY = ["learning-open-session"];

/**
 * El reloj de la sesión.
 *
 * Dos pausas distintas, que es la idea central del producto:
 *  - Pausar el video para investigar una expresión → sigues estudiando,
 *    el tiempo efectivo NO se detiene.
 *  - Pausar la sesión → dejaste de estudiar, el tiempo efectivo se detiene.
 *
 * El tiempo efectivo se acumula en `effective_seconds` (comprometido) más el
 * tramo abierto desde `last_resumed_at`. Vive en la base, así que sobrevive a
 * recargas y cambios de dispositivo.
 */
export function useActiveLearningSession() {
  const queryClient = useQueryClient();

  // Reloj local: fuerza un re-render por segundo mientras hay sesión abierta.
  const [now, setNow] = useState(() => Date.now());

  // Estado del reproductor, reportado desde el player embebido.
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Acumuladores que se vuelcan a la base cada latido.
  const consumedRef = useRef(0);
  /**
   * La posición MÁS LEJANA alcanzada, no la última.
   * Retroceder para re-escuchar un pasaje es parte de estudiar; si guardáramos
   * la última, ver el 90% y volver al minuto 3 dejaría el video registrado
   * como visto en un 3%.
   */
  const positionRef = useRef(0);
  const lastReportedPositionRef = useRef<number | null>(null);
  const lastActivityRef = useRef(Date.now());
  const recoveryDoneRef = useRef(false);

  // ── Sesión abierta ────────────────────────────────────────

  const { data: session, isLoading } = useQuery({
    queryKey: OPEN_SESSION_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_sessions")
        .select("*")
        .in("status", ["active", "paused"])
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as LearningSession | null;
    },
    staleTime: 1000 * 30,
  });

  const setSessionCache = useCallback(
    (next: LearningSession | null) => {
      queryClient.setQueryData(OPEN_SESSION_KEY, next);
    },
    [queryClient]
  );

  // Al cargar una sesión, sincroniza los acumuladores locales con la base.
  useEffect(() => {
    if (!session) {
      consumedRef.current = 0;
      positionRef.current = 0;
      lastReportedPositionRef.current = null;
      recoveryDoneRef.current = false;
      return;
    }
    consumedRef.current = session.consumed_seconds;
    positionRef.current = session.last_position_seconds;
    lastActivityRef.current = Date.now();
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Escrituras ────────────────────────────────────────────

  const patch = useCallback(
    async (id: string, updates: Partial<LearningSession>) => {
      const { data, error } = await supabase
        .from("learning_sessions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as LearningSession;
    },
    []
  );

  /** Cierra el tramo activo en un instante dado y devuelve el efectivo total. */
  const commitEffective = useCallback(
    (s: LearningSession, atMs: number) => {
      if (s.status !== "active" || !s.last_resumed_at) return s.effective_seconds;
      const resumedMs = new Date(s.last_resumed_at).getTime();
      const delta = Math.max(0, Math.floor((atMs - resumedMs) / 1000));
      return s.effective_seconds + delta;
    },
    []
  );

  // ── Recuperación de sesiones huérfanas ────────────────────
  // Si cerraste la pestaña, la sesión quedó "activa" pero sin latidos. Al
  // volver, el tiempo se corta en el último latido, no en ahora.

  useEffect(() => {
    if (!session || recoveryDoneRef.current) return;
    if (session.status !== "active") return;

    const beat = session.last_heartbeat_at
      ? new Date(session.last_heartbeat_at).getTime()
      : new Date(session.started_at).getTime();

    if (Date.now() - beat <= STALE_HEARTBEAT_MS) return;

    recoveryDoneRef.current = true;
    const effective = commitEffective(session, beat);
    patch(session.id, {
      status: "paused",
      effective_seconds: effective,
      last_resumed_at: null,
      pause_count: session.pause_count + 1,
    })
      .then((next) => {
        setSessionCache(next);
        toast.info("Retomé una sesión que quedó abierta", {
          description: "Conté hasta la última señal de actividad.",
        });
      })
      .catch(() => {});
  }, [session, commitEffective, patch, setSessionCache]);

  // ── Salir de la página pausa la sesión ────────────────────
  //
  // Si te vas por el menú, dejaste de estudiar. Sin esto la sesión quedaba
  // "activa" sin nadie contando y al volver saltaba la recuperación de
  // sesiones huérfanas —que existe para cuando se cierra la pestaña, no para
  // una navegación normal— recortando el tiempo y avisando de algo que no
  // pasó. `patch` y `commitEffective` son estables, así que esto solo corre
  // al desmontar de verdad.

  const sessionRef = useRef<LearningSession | null>(null);
  useEffect(() => {
    sessionRef.current = session ?? null;
  }, [session]);

  useEffect(() => {
    return () => {
      const open = sessionRef.current;
      if (!open || open.status !== "active") return;

      // El componente ya no existe, pero la petición sí llega: no hay que
      // esperarla, solo dispararla con los valores correctos.
      void patch(open.id, {
        status: "paused",
        effective_seconds: commitEffective(open, Date.now()),
        last_resumed_at: null,
        consumed_seconds: Math.round(consumedRef.current),
        last_position_seconds: Math.round(positionRef.current),
        pause_count: open.pause_count + 1,
      }).catch(() => {});
    };
  }, [commitEffective, patch]);

  // ── Tick de un segundo ────────────────────────────────────

  const isOpen = !!session && session.status !== "completed";

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isOpen]);

  // ── Latido: vuelca consumo y posición ─────────────────────

  useEffect(() => {
    if (!session || session.status !== "active") return;

    const id = setInterval(() => {
      patch(session.id, {
        consumed_seconds: Math.round(consumedRef.current),
        last_position_seconds: Math.round(positionRef.current),
        last_heartbeat_at: new Date().toISOString(),
      }).catch(() => {});
    }, HEARTBEAT_MS);

    return () => clearInterval(id);
  }, [session?.id, session?.status, patch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Acciones ──────────────────────────────────────────────

  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const pauseMutation = useMutation({
    mutationFn: async ({ atMs }: { atMs?: number } = {}) => {
      if (!session || session.status !== "active") return null;
      const effective = commitEffective(session, atMs ?? Date.now());
      return patch(session.id, {
        status: "paused",
        effective_seconds: effective,
        last_resumed_at: null,
        consumed_seconds: Math.round(consumedRef.current),
        last_position_seconds: Math.round(positionRef.current),
        pause_count: session.pause_count + 1,
      });
    },
    onSuccess: (next) => next && setSessionCache(next),
    onError: (error: Error) => toast.error(error.message),
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      if (!session || session.status !== "paused") return null;
      return patch(session.id, {
        status: "active",
        last_resumed_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
      });
    },
    onSuccess: (next) => {
      if (next) {
        setSessionCache(next);
        registerActivity();
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // ── Auto-pausa por inactividad ────────────────────────────
  // Solo cuando el video NO está corriendo: si está sonando, estás estudiando.
  // El tiempo se corta en la última actividad real, no al detectarlo.

  useEffect(() => {
    if (!session || session.status !== "active" || isVideoPlaying) return;

    const id = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor < IDLE_AUTO_PAUSE_MS) return;

      pauseMutation.mutate({ atMs: lastActivityRef.current });
      toast.info("Pausé la sesión sola", {
        description: "No vi actividad en 5 minutos. El tiempo se cortó ahí.",
      });
    }, 15_000);

    return () => clearInterval(id);
  }, [session?.id, session?.status, isVideoPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useMutation({
    mutationFn: async (input: StartSessionInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("learning_sessions")
        .insert({
          ...input,
          user_id: userData.user.id,
          status: "active",
          started_at: nowIso,
          last_resumed_at: nowIso,
          last_heartbeat_at: nowIso,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Ya tienes una sesión abierta. Termínala primero.");
        }
        throw error;
      }
      return data as LearningSession;
    },
    onSuccess: (next) => {
      setSessionCache(next);
      registerActivity();
      setIsVideoPlaying(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const finish = useMutation({
    mutationFn: async (reflection: ReflectionInput) => {
      if (!session) throw new Error("No hay sesión abierta");

      const endMs = Date.now();
      const effective = commitEffective(session, endMs);
      const elapsed = Math.max(
        0,
        Math.floor((endMs - new Date(session.started_at).getTime()) / 1000)
      );

      return patch(session.id, {
        ...reflection,
        // La dificultad ya no se pregunta: sale del puntaje.
        difficulty: inferDifficulty(comprehensionScore(reflection)),
        status: "completed",
        ended_at: new Date(endMs).toISOString(),
        last_resumed_at: null,
        effective_seconds: effective,
        elapsed_seconds: elapsed,
        consumed_seconds: Math.round(consumedRef.current),
        last_position_seconds: Math.round(positionRef.current),
      });
    },
    onSuccess: (completed) => {
      setSessionCache(null);
      queryClient.invalidateQueries({ queryKey: ["learning-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["learning-sightings-by-session"] });
      queryClient.invalidateQueries({ queryKey: ["learning-last-session"] });
      queryClient.invalidateQueries({ queryKey: ["learning-items"] });
      return completed;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const discard = useMutation({
    mutationFn: async () => {
      if (!session) return;
      const { error } = await supabase
        .from("learning_sessions")
        .delete()
        .eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSessionCache(null);
      queryClient.invalidateQueries({ queryKey: ["learning-items"] });
      toast.success("Sesión descartada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /**
   * El reproductor entrega título, canal y duración cuando está listo.
   * Se guardan una sola vez, sin pedirle nada al usuario.
   */
  const saveMeta = useCallback(
    (meta: { title: string | null; author: string | null; durationSeconds: number | null }) => {
      if (!session) return;

      const updates: Partial<LearningSession> = {};
      if (meta.title && !session.content_title) updates.content_title = meta.title;
      if (meta.author && !session.content_author) updates.content_author = meta.author;
      if (meta.durationSeconds && !session.content_duration_seconds) {
        updates.content_duration_seconds = meta.durationSeconds;
      }
      if (Object.keys(updates).length === 0) return;

      patch(session.id, updates)
        .then(setSessionCache)
        .catch(() => {});
    },
    [session, patch, setSessionCache]
  );

  // ── Reporte del reproductor ───────────────────────────────

  /**
   * Lo llama el player embebido. El consumo se mide por diferencia de
   * posición, así respeta la velocidad de reproducción e ignora los saltos.
   */
  const reportPlayback = useCallback(
    (positionSeconds: number, playing: boolean) => {
      setIsVideoPlaying(playing);
      positionRef.current = Math.max(positionRef.current, positionSeconds);

      const last = lastReportedPositionRef.current;
      lastReportedPositionRef.current = positionSeconds;

      if (playing) {
        lastActivityRef.current = Date.now();
        if (last !== null) {
          const delta = positionSeconds - last;
          // Un salto (seek) o un retroceso no cuentan como contenido visto.
          if (delta > 0 && delta <= 5) consumedRef.current += delta;
        }
      }
    },
    []
  );

  // ── Derivados en vivo ─────────────────────────────────────

  const liveEffectiveSeconds = (() => {
    if (!session) return 0;
    if (session.status !== "active" || !session.last_resumed_at) {
      return session.effective_seconds;
    }
    const delta = Math.max(
      0,
      Math.floor((now - new Date(session.last_resumed_at).getTime()) / 1000)
    );
    return session.effective_seconds + delta;
  })();

  const liveElapsedSeconds = session
    ? Math.max(0, Math.floor((now - new Date(session.started_at).getTime()) / 1000))
    : 0;

  return {
    session,
    isLoading,
    hasOpenSession: isOpen,
    isActive: session?.status === "active",
    isPaused: session?.status === "paused",
    isVideoPlaying,

    liveEffectiveSeconds,
    liveElapsedSeconds,
    liveConsumedSeconds: consumedRef.current,
    lastPositionSeconds: positionRef.current,

    start,
    pause: () => pauseMutation.mutate({}),
    resume: () => resumeMutation.mutate(),
    finish,
    discard,
    reportPlayback,
    registerActivity,
    saveMeta,
  };
}
