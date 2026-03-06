import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAllRoutePaths, getMaxShortcutNumber } from "@/lib/routes-config";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";

interface UseKeyboardShortcutsOptions {
  onToggleCommandBar: () => void;
  onToggleShortcutsPopover: () => void;
  onToggleWhisper: () => void;
}

export function useKeyboardShortcuts({
  onToggleCommandBar,
  onToggleShortcutsPopover,
  onToggleWhisper,
}: UseKeyboardShortcutsOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const { togglePrivacyMode } = usePrivacyMode();
  const { openQuickAdd, openReconciliation } = useGlobalDrawers();

  const routes = getAllRoutePaths();
  const maxShortcut = getMaxShortcutNumber();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Cmd+K → Command palette (modifier shortcut, always active)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onToggleCommandBar();
        return;
      }

      // All single-key shortcuts: ignore when inside inputs
      if (isInputField) return;

      // Don't fire single-key shortcuts when modifiers are held
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "n":
        case "N":
          e.preventDefault();
          openQuickAdd();
          break;

        case "r":
        case "R":
          e.preventDefault();
          openReconciliation();
          break;

        case "w":
        case "W":
          e.preventDefault();
          onToggleWhisper();
          break;

        case "p":
        case "P":
          e.preventDefault();
          togglePrivacyMode();
          break;

        case "?":
          e.preventDefault();
          onToggleShortcutsPopover();
          break;

        case "ArrowUp": {
          e.preventDefault();
          const currentIndex = routes.indexOf(location.pathname);
          if (currentIndex > 0) {
            navigate(routes[currentIndex - 1]);
          }
          break;
        }

        case "ArrowDown": {
          e.preventDefault();
          const currentIndex = routes.indexOf(location.pathname);
          if (currentIndex < routes.length - 1) {
            navigate(routes[currentIndex + 1]);
          }
          break;
        }

        default:
          // 1-8 → Navigate to section
          if (e.key >= "1" && e.key <= maxShortcut.toString()) {
            e.preventDefault();
            const index = parseInt(e.key) - 1;
            if (routes[index]) {
              navigate(routes[index]);
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    navigate,
    location.pathname,
    routes,
    maxShortcut,
    onToggleCommandBar,
    onToggleShortcutsPopover,
    onToggleWhisper,
    togglePrivacyMode,
    openQuickAdd,
    openReconciliation,
  ]);
}
