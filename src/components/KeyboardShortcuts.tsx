import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface KeyboardShortcutsProps {
  onAddTransaction?: () => void;
}

const routes = ["/", "/dashboard", "/transactions", "/categories", "/bulk-recategorize"];

export function KeyboardShortcuts({ onAddTransaction }: KeyboardShortcutsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + ← / → para navegar entre tabs
      if ((e.metaKey || e.ctrlKey) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const currentIndex = routes.indexOf(location.pathname);
        
        if (e.key === "ArrowLeft" && currentIndex > 0) {
          navigate(routes[currentIndex - 1]);
        } else if (e.key === "ArrowRight" && currentIndex < routes.length - 1) {
          navigate(routes[currentIndex + 1]);
        }
      }

      // Cmd/Ctrl + 1-5 para navegar directo
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        navigate(routes[parseInt(e.key) - 1]);
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [navigate, location.pathname, onAddTransaction]);

  return null;
}

