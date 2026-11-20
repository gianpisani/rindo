import { useRef, useState, type FormEvent } from "react";

export function useComposerSubmit() {
  const saving = useRef(false);
  const [error, setError] = useState("");

  const guardedSubmit = (save: () => Promise<void>, failure: string | (() => void)) => async (event: FormEvent) => {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    try {
      await save();
    } catch {
      if (typeof failure === "string") setError(failure);
      else failure();
    } finally {
      saving.current = false;
    }
  };

  return { error, setError, guardedSubmit };
}
