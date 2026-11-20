import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES, EMOJI_SEARCH_TEXT } from "@/data/emojis";
import { Search } from "lucide-react";

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface EmojiPickerProps {
  value: string;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ value, onSelect }: EmojiPickerProps) {
  const [search, setSearch] = useState("");

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
            "h-9 w-9 rounded-card text-xl flex items-center justify-center transition-all duration-100",
            value === emoji
              ? "ring-2 scale-110"
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

      {search.trim() ? (
        filteredCategories.length > 0 ? (
          <ScrollArea className="h-[200px]">
            <div className="space-y-3 pr-2">
              {filteredCategories.map((cat) => (
                <div key={cat.id}>
                  <p className="text-xs text-muted-foreground mb-1">{cat.label}</p>
                  <EmojiGrid emojis={cat.emojis} />
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            Sin resultados
          </div>
        )
      ) : (
        <Tabs defaultValue={EMOJI_CATEGORIES[0].id}>
          <TabsList className="w-full h-auto flex gap-0 p-1 bg-muted rounded-full overflow-x-auto justify-start">
            {EMOJI_CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                title={cat.label}
                className="size-9 px-0 flex-shrink-0 rounded-full text-sm data-[state=active]:bg-background"
              >
                {cat.icon}
              </TabsTrigger>
            ))}
          </TabsList>
          {EMOJI_CATEGORIES.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-2">
              <ScrollArea className="h-[200px]">
                <div className="pr-2">
                  <EmojiGrid emojis={cat.emojis} />
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
