import { create } from "zustand";

const FLASH_MS = 1000;

const useFlashStore = create<{ rows: ReadonlyMap<string, number> }>(() => ({ rows: new Map() }));

let lastFlash = 0;

export function flashRows(ids: string[]) {
  if (ids.length === 0) return;
  const flash = ++lastFlash;
  useFlashStore.setState(({ rows }) => ({ rows: new Map([...rows, ...ids.map((id) => [id, flash] as const)]) }));
  window.setTimeout(
    () => useFlashStore.setState(({ rows }) => ({ rows: new Map([...rows].filter(([, owner]) => owner !== flash)) })),
    FLASH_MS,
  );
}

export const useFlashedRows = () => useFlashStore((state) => state.rows);
