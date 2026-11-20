import { useEffect } from "react";
import { useEditHistory } from "@/hooks/useEditHistory";

const isTextEditing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

export function useUndoShortcuts() {
  const { undo, redo } = useEditHistory();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.defaultPrevented || isTextEditing(e.target)) return;
      const key = e.key.toLowerCase();
      const wantsRedo = (key === "z" && e.shiftKey) || (key === "y" && e.ctrlKey && !e.shiftKey);
      const wantsUndo = key === "z" && !e.shiftKey;
      if (!wantsUndo && !wantsRedo) return;
      e.preventDefault();
      if (wantsRedo) redo();
      else undo();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);
}
