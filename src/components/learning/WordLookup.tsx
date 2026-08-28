import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Volume2, Loader2, BookOpen, Languages } from "lucide-react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDictionary, usePronunciation } from "@/hooks/useDictionary";
import { useTranslations } from "@/hooks/useTranslation";

interface WordLookupProps {
  term: string;
  /** La frase donde apareció, para traducirla y ver el uso real. */
  contextSentence?: string | null;
  onUseDefinition: (definition: string) => void;
  /** Se avisa hacia arriba para guardarla junto con la expresión. */
  onTranslation?: (translation: string | null) => void;
  /** En banda: la identidad a la izquierda, el sentido a la derecha. */
  compact?: boolean;
  className?: string;
}

const LANG_PREF_KEY = "rindo:learning-lookup-lang";

/**
 * Definición rápida de la palabra elegida, en español o en inglés.
 *
 * Traducir la palabra suelta no basta: "come across" da "cruzar", que es el
 * sentido literal equivocado. Por eso se traducen también la definición y la
 * frase donde apareció, que son las que desambiguan el uso real.
 */
export function WordLookup({
  term,
  contextSentence,
  onUseDefinition,
  onTranslation,
  compact,
  className,
}: WordLookupProps) {
  const { data, isLoading, isError } = useDictionary(term);

  // dictionaryapi.dev solo tiene palabras sueltas y no siempre trae fonética.
  // Cuando falta, se busca en Wiktionary, que sí cubre las expresiones.
  const { data: extra } = usePronunciation(
    term,
    !isLoading && (!data?.phonetic || !data?.audioUrl)
  );

  const phonetic = data?.phonetic ?? extra?.phonetic ?? null;
  const audioUrl = data?.audioUrl ?? extra?.audioUrl ?? null;
  const approximate = !data?.phonetic && !!extra?.approximate;

  const phoneticLabel = phonetic && (approximate ? `≈ ${phonetic}` : phonetic);
  const phoneticTitle = approximate
    ? "Aproximada: la armé juntando la fonética de cada palabra, porque las expresiones no tienen la suya"
    : undefined;

  const [inSpanish, setInSpanish] = useState(
    () => localStorage.getItem(LANG_PREF_KEY) !== "en"
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Dos acepciones bastan: son las que de verdad se leen, y así el panel de
  // captura entra completo sin scrollear.
  const senses = (data?.senses ?? []).slice(0, 2);

  // Se traduce la palabra, sus definiciones y la frase de una sola vez.
  const toTranslate = [
    term,
    ...senses.flatMap((s) =>
      [s.definition, s.example].filter((x): x is string => !!x)
    ),
    ...(contextSentence ? [contextSentence] : []),
  ];
  const { data: translations = {}, isFetching: translating } =
    useTranslations(toTranslate);

  const termTranslation = translations[term.trim()] ?? null;

  // Avisa hacia arriba para que se guarde con la expresión
  useEffect(() => {
    onTranslation?.(termTranslation);
  }, [termTranslation, onTranslation]);

  /**
   * El significado se toma solo de la primera acepción.
   *
   * Antes había que hacer clic en una definición para "usarla": un paso de más
   * justo cuando lo único que quieres es guardar y volver al video. Tocar otra
   * acepción sigue funcionando, para las palabras donde la primera no es la
   * que se dijo.
   */
  const suggested = senses[0]
    ? (inSpanish ? translations[senses[0].definition] : null) ??
      senses[0].definition
    : null;
  const useDefinition = useRef(onUseDefinition);
  useDefinition.current = onUseDefinition;
  useEffect(() => {
    if (suggested) useDefinition.current(suggested);
  }, [suggested]);

  const say = (text: string) => (inSpanish ? translations[text] ?? text : text);

  /**
   * Reproduce la pronunciación grabada.
   *
   * Los errores se avisan: antes se tragaban en silencio y el botón parecía
   * roto —el archivo puede no existir, o ser un .ogg que el navegador no lee.
   */
  const playAudio = () => {
    if (!audioUrl) return;

    audioRef.current?.pause();
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const fail = () => {
      setPlaying(false);
      toast.error("No pude reproducir la pronunciación", {
        description: "El audio de esta palabra no está disponible.",
      });
    };

    setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onerror = fail;
    audio.play().catch(fail);
  };

  const pronunciation = (phonetic || audioUrl) && (
    <div className="-mt-0.5">
      {audioUrl ? (
        <button
          onClick={playAudio}
          title={phoneticTitle ?? "Escuchar cómo se pronuncia"}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
        >
          {playing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="text-[11px] font-mono">
            {phoneticLabel ?? "Escuchar"}
          </span>
        </button>
      ) : (
        <p
          title={phoneticTitle}
          className="text-[11px] text-muted-foreground font-mono"
        >
          {phoneticLabel}
        </p>
      )}
    </div>
  );

  const toggleLang = () => {
    setInSpanish((prev) => {
      localStorage.setItem(LANG_PREF_KEY, prev ? "en" : "es");
      return !prev;
    });
  };

  /** Las acepciones. Solo existen para palabras sueltas. */
  const meanings = (
    <div className="min-w-0 space-y-1">
      {senses.map((sense, index) => (
        <button
          key={index}
          onClick={() => onUseDefinition(say(sense.definition))}
          title="Usar esta acepción como significado"
          className="group block w-full text-left"
        >
          <p className="line-clamp-2 text-[13px] leading-snug">
            {sense.partOfSpeech && (
              <span className="mr-1.5 italic text-muted-foreground">
                {sense.partOfSpeech}
              </span>
            )}
            <span className="transition-colors group-hover:text-primary">
              {say(sense.definition)}
            </span>
          </p>
        </button>
      ))}
    </div>
  );

  /** La frase donde apareció, ya en español. */
  const quoted = contextSentence && translations[contextSentence.trim()];
  const quote = quoted && (
    <Peek full={quoted}>
      <p className="line-clamp-3 border-l-2 border-primary/30 pl-2 text-[12px] italic leading-snug text-muted-foreground">
        “{inSpanish ? quoted : contextSentence}”
      </p>
    </Peek>
  );

  /**
   * La banda: la expresión a la izquierda, lo que significa a la derecha.
   *
   * Con una forma para cada cosa. Una palabra suelta tiene diccionario, así que
   * su identidad es corta y el ancho es para las acepciones. Una frase no lo
   * tiene —ninguno los tiene— y ahí la mitad ancha se gastaba en avisar que no
   * la encontró, mientras la frase y su traducción, que es todo lo que hay que
   * leer, se apretaban en doce rem y salían cortadas.
   */
  if (compact) {
    // Se decide por el texto y no por la respuesta del diccionario: así la
    // banda no cambia de forma a mitad de camino cuando llega la búsqueda.
    const isPhrase = /\s/.test(term.trim());

    return (
      <div className={cn("flex min-h-0 gap-4", className)}>
        <div className={cn("min-w-0", isPhrase ? "flex-1" : "w-[12rem] shrink-0")}>
          <div className="flex items-baseline gap-2">
            <Peek full={data?.term ?? term} className="min-w-0 flex-1">
              <p
                className={cn(
                  "font-semibold leading-snug",
                  isPhrase ? "line-clamp-2 text-[17px]" : "truncate text-lg"
                )}
              >
                {data?.term ?? term}
              </p>
            </Peek>

            <button
              onClick={toggleLang}
              title={inSpanish ? "Ver en inglés" : "Ver en español"}
              className={cn(
                "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                inSpanish
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {inSpanish ? "ES" : "EN"}
            </button>
          </div>

          <Peek full={termTranslation ?? ""}>
            <p
              className={cn(
                "font-medium leading-snug text-primary",
                isPhrase ? "line-clamp-2 text-[15px]" : "truncate text-[15px]"
              )}
            >
              {termTranslation ?? (translating ? "traduciendo…" : " ")}
            </p>
          </Peek>

          <div className="mt-1">{pronunciation}</div>
        </div>

        {isPhrase ? (
          quote && (
            <div className="min-w-0 flex-1 border-l border-border/50 pl-4">
              {quote}
            </div>
          )
        ) : (
          <div className="min-w-0 flex-1 space-y-1.5 border-l border-border/50 pl-4">
            {isLoading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando…
              </p>
            ) : senses.length ? (
              meanings
            ) : (
              <p className="text-[13px] leading-snug text-muted-foreground">
                El diccionario no la tiene. Guárdala igual con su frase: el
                contexto suele enseñar más que la definición.
              </p>
            )}
            {quote}
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5",
          "flex items-center gap-2 text-xs text-muted-foreground",
          className
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Buscando “{term}”…
      </div>
    );
  }

  // Sin definición todavía puede haber traducción, que ya sirve
  if (isError || !data) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 space-y-1.5",
          className
        )}
      >
        {termTranslation ? (
          <p className="text-sm">
            <span className="font-semibold">{term}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="text-primary font-medium">{termTranslation}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sin definición en el diccionario. Guárdala igual con su frase — el
            contexto suele enseñar más que la definición.
          </p>
        )}

        {pronunciation}

        {contextSentence && translations[contextSentence.trim()] && (
          <p className="text-[11px] text-muted-foreground italic">
            “{translations[contextSentence.trim()]}”
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 space-y-2",
        className
      )}
    >
      {/* Cabecera: palabra, traducción, fonética, audio */}
      <div className="flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-sm font-semibold truncate">{data.term}</span>

        {termTranslation && (
          <>
            <span className="text-muted-foreground text-xs shrink-0">·</span>
            <span className="text-sm text-primary font-medium truncate">
              {termTranslation}
            </span>
          </>
        )}

        <div className="flex-1" />

        <button
          onClick={toggleLang}
          aria-label={inSpanish ? "Ver en inglés" : "Ver en español"}
          title={inSpanish ? "Ver en inglés" : "Ver en español"}
          className={cn(
            "flex items-center gap-1 shrink-0 rounded-md px-1.5 py-0.5",
            "text-[10px] font-bold transition-colors",
            inSpanish
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Languages className="h-3 w-3" />
          {inSpanish ? "ES" : "EN"}
        </button>
      </div>

      {pronunciation}

      {/* La frase donde apareció, en español */}
      {contextSentence && translations[contextSentence.trim()] && inSpanish && (
        <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/30 pl-2">
          “{translations[contextSentence.trim()]}”
        </p>
      )}

      {/* Definiciones */}
      <div className="space-y-1.5">
        {senses.map((sense, index) => (
          <button
            key={index}
            onClick={() => onUseDefinition(say(sense.definition))}
            title="Usar como significado"
            className="w-full text-left group"
          >
            <p className="text-xs leading-relaxed">
              {sense.partOfSpeech && (
                <span className="text-muted-foreground italic mr-1.5">
                  {sense.partOfSpeech}
                </span>
              )}
              <span className="group-hover:text-primary transition-colors">
                {say(sense.definition)}
              </span>
            </p>
            {sense.example && (
              <p className="text-[11px] text-muted-foreground italic mt-0.5">
                “{say(sense.example)}”
              </p>
            )}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        {translating
          ? "Traduciendo…"
          : "Toca una definición para copiarla al significado."}
      </p>
    </div>
  );
}


/**
 * El texto entero al pasar por encima, cuando no cabe.
 *
 * El del navegador tarda casi un segundo y aparece donde quiere; este sale al
 * tiro y se ve como el resto. Va en un portal a propósito: la banda de captura
 * recorta lo que se salga de ella, así que ahí dentro cualquier globo quedaría
 * cortado por la mitad.
 */
function Peek({
  children,
  full,
  className,
}: {
  children: ReactNode;
  full: string;
  className?: string;
}) {
  const worth = full.trim().length > 18;

  if (!worth) return <div className={cn("min-w-0", className)}>{children}</div>;

  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <div className={cn("min-w-0 cursor-default", className)}>{children}</div>
      </TooltipTrigger>
      <TooltipPrimitive.Portal>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-sm text-[13px] leading-snug"
        >
          {full}
        </TooltipContent>
      </TooltipPrimitive.Portal>
    </Tooltip>
  );
}
