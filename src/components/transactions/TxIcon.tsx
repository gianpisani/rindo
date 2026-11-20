import { tint } from "@/lib/category-color";
import { cn } from "@/lib/utils";

interface Props {
  emoji: string;
  color?: string | null;
  thinking?: boolean;
  bot?: boolean;
  className?: string;
}

export function TxIcon({ emoji, color, thinking = false, bot = false, className }: Props) {
  return (
    <span className={cn("inicio-ico", thinking && "is-thinking", className)} style={tint(thinking ? "var(--inicio-violet)" : color)}>
      <span key={thinking ? "thinking" : emoji} className="glyph">
        {thinking ? "⚡" : emoji}
      </span>
      {bot && <span className="inicio-bot" title="Detectado por el bot">🤖</span>}
    </span>
  );
}
