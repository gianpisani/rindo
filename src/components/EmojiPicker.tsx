import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES, EMOJI_SEARCH_TEXT } from "@/data/emojis";
import { Search } from "lucide-react";

/** El texto buscable viene sin tildes, así que la consulta también. */
const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface EmojiPickerProps {
  value: string;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ value, onSelect }: EmojiPickerProps) {
  const [search, setSearch] = useState("");

  // Busca por nombre y sinónimos de cada emoji. Si el término calza con el
  // nombre de la categoría, se muestra completa.
  const filteredCategories = useMemo(() => {
    const query = normalize(search.trim());
    if (!query) return EMOJI_CATEGORIES;

    return EMOJI_CATEGORIES.map((cat) => {
      if (normalize(cat.label).includes(query)) return cat;
      const emojis = cat.emojis.filter((emoji) =>
        (EMOJI_SEARCH_TEXT[emoji] ?? "").includes(query)
      );
      return { ...cat, emojis };
    }).filter((cat) => cat.emojis.length > 0);
  }, [search]);

  const EmojiGrid = ({ emojis }: { emojis: string[] }) => (
    <div className="grid grid-cols-8 gap-1">
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className={cn(
            "h-9 w-9 rounded-xl text-lg flex items-center justify-center transition-all duration-100",
            value === emoji
              ? "bg-foreground/10 ring-2 ring-foreground/30 scale-110"
              : "hover:bg-muted"
          )}
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar emoji..."
          className="h-8 pl-8 rounded-full text-sm"
        />
      </div>

      {/* Sin scroll propio: la grilla crece y scrollea el contenedor del modal.
          Un ScrollArea anidado dentro del Dialog no responde al touch en iOS,
          el mismo problema que ya resolvieron BaseModal y CategoryPickerInline. */}
      {search.trim() ? (
        filteredCategories.length > 0 ? (
          <div className="space-y-3">
            {filteredCategories.map((cat) => (
              <div key={cat.id}>
                <p className="text-xs text-muted-foreground mb-1">{cat.label}</p>
                <EmojiGrid emojis={cat.emojis} />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Sin resultados
          </div>
        )
      ) : (
        <Tabs defaultValue={EMOJI_CATEGORIES[0].id}>
          {/* Fija: la grilla es larga y sin esto habría que volver arriba
              cada vez que se quiere cambiar de categoría. */}
          <TabsList className="sticky top-0 z-10 w-full h-auto flex gap-0 p-1 bg-muted rounded-xl overflow-x-auto justify-start">
            {EMOJI_CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                title={cat.label}
                className="h-8 w-8 px-0 flex-shrink-0 rounded-lg text-base data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                {cat.icon}
              </TabsTrigger>
            ))}
          </TabsList>
          {EMOJI_CATEGORIES.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-2">
              <EmojiGrid emojis={cat.emojis} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
