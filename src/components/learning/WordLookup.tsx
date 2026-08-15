import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Volume2, Loader2, BookOpen, Languages } from "lucide-react";
import { useDictionary } from "@/hooks/useDictionary";
import { useTranslations } from "@/hooks/useTranslation";

interface WordLookupProps {
  term: string;
  /** La frase donde apareció, para traducirla y ver el uso real. */
  contextSentence?: string | null;
  onUseDefinition: (definition: string) => void;
  /** Se avisa hacia arriba para guardarla junto con la expresión. */
  onTranslation?: (translation: string | null) => void;
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
  className,
}: WordLookupProps) {
  const { data, isLoading, isError } = useDictionary(term);

  const [inSpanish, setInSpanish] = useState(
    () => localStorage.getItem(LANG_PREF_KEY) !== "en"
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const say = (text: string) => (inSpanish ? translations[text] ?? text : text);

  const playAudio = () => {
    if (!data?.audioUrl) return;
    audioRef.current?.pause();
    audioRef.current = new Audio(data.audioUrl);
    audioRef.current.play().catch(() => {});
  };

  const toggleLang = () => {
    setInSpanish((prev) => {
      localStorage.setItem(LANG_PREF_KEY, prev ? "en" : "es");
      return !prev;
    });
  };

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

        {data.audioUrl && (
          <button
            onClick={playAudio}
            aria-label="Escuchar pronunciación"
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>
        )}

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

      {data.phonetic && (
        <p className="text-[11px] text-muted-foreground font-mono -mt-1">
          {data.phonetic}
        </p>
      )}

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
