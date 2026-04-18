import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useNavPreferences } from "@/hooks/useNavPreferences";

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
  const { getVisibleRoutes } = useNavPreferences();

  const visibleRoutes = getVisibleRoutes();
  const routePaths = visibleRoutes.map((r) => r.url);
  const maxShortcut = Math.min(routePaths.length, 9);

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
          const upIndex = routePaths.indexOf(location.pathname);
          const prevIndex = upIndex <= 0 ? routePaths.length - 1 : upIndex - 1;
          navigate(routePaths[prevIndex]);
          break;
        }

        case "ArrowDown": {
          e.preventDefault();
          const downIndex = routePaths.indexOf(location.pathname);
          const nextIndex = downIndex >= routePaths.length - 1 ? 0 : downIndex + 1;
          navigate(routePaths[nextIndex]);
          break;
        }

        default:
          // 1-9 → Navigate to section (dynamic based on visible order)
          if (e.key >= "1" && e.key <= "9") {
            const index = parseInt(e.key) - 1;
            if (index < maxShortcut && routePaths[index]) {
              e.preventDefault();
              navigate(routePaths[index]);
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
    routePaths,
    maxShortcut,
    onToggleCommandBar,
    onToggleShortcutsPopover,
    onToggleWhisper,
    togglePrivacyMode,
  ]);
}
