import { useState } from "react";
import type { SyncResult, SyncMovementItem } from "@/lib/bank-sync";
import { creatableIndexes, selectedItemIds, toggleAllIndexes, toggleIndex } from "@/lib/bank-sync";

interface SyncResultSelectionParams {
  result: SyncResult | null;
  bank: string;
  onImportSkipped: (movements: SyncMovementItem[], bank?: string) => Promise<number>;
  onDeleteImported: (ids: string[]) => Promise<number>;
}

export function useSyncResultSelection({ result, bank, onImportSkipped, onDeleteImported }: SyncResultSelectionParams) {
  const [selectedSkipped, setSelectedSkipped] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importedSkippedCount, setImportedSkippedCount] = useState(0);
  const [selectedImported, setSelectedImported] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletedImportedCount, setDeletedImportedCount] = useState(0);

  function toggleSkipped(index: number) {
    setSelectedSkipped((prev) => toggleIndex(prev, index));
  }

  function toggleAllSkipped(skippedItems: SyncMovementItem[]) {
    const indexes = creatableIndexes(skippedItems);
    setSelectedSkipped((prev) => toggleAllIndexes(prev, indexes));
  }

  async function importSelected() {
    if (!result || "error" in result) return;
    const movements = result.skippedItems.filter((_, i) => selectedSkipped.has(i));
    if (movements.length === 0) return;
    setIsImporting(true);
    const count = await onImportSkipped(movements, bank);
    setImportedSkippedCount(count);
    setSelectedSkipped(new Set());
    setIsImporting(false);
  }

  function toggleImported(index: number) {
    setSelectedImported((prev) => toggleIndex(prev, index));
  }

  function toggleAllImported(importedItems: SyncMovementItem[]) {
    const indexes = importedItems.map((_, i) => i);
    setSelectedImported((prev) => toggleAllIndexes(prev, indexes));
  }

  async function deleteSelected() {
    if (!result || "error" in result) return;
    const ids = selectedItemIds(result.importedItems, selectedImported);
    if (ids.length === 0) return;
    setIsDeleting(true);
    const count = await onDeleteImported(ids);
    setDeletedImportedCount(count);
    setSelectedImported(new Set());
    setIsDeleting(false);
  }

  function reset() {
    setSelectedSkipped(new Set());
    setImportedSkippedCount(0);
    setSelectedImported(new Set());
    setDeletedImportedCount(0);
  }

  return {
    selectedSkipped,
    isImporting,
    importedSkippedCount,
    toggleSkipped,
    toggleAllSkipped,
    importSelected,
    selectedImported,
    isDeleting,
    deletedImportedCount,
    toggleImported,
    toggleAllImported,
    deleteSelected,
    reset,
  };
}

export type SyncResultSelection = ReturnType<typeof useSyncResultSelection>;
