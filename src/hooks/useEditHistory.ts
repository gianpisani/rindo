import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { create } from "zustand";
import { transactionsQuery, useTransactionWrites, type Transaction, type TransactionPatch } from "@/hooks/useTransactions";
import { useIsMobile } from "@/hooks/useIsMobile";
import { flashRows } from "@/hooks/useRowFlash";
import { withManualCategorySource } from "@/lib/auto-category-policy";
import {
  applicablePart,
  changedFields,
  describeDuplicate,
  describeMissing,
  describeRemoval,
  describeUndone,
  describeUpdate,
  emptyHistory,
  forget,
  historySize,
  historyStorageKey,
  isApplePlatform,
  isEditEntry,
  keepNewest,
  parseStoredHistory,
  record,
  returnToFuture,
  returnToPast,
  revertPatch,
  serializeHistory,
  stepBack,
  stepForward,
  touchedIds,
  undoShortcuts,
  type EditEntry,
  type EditOperation,
  type History,
  type Step,
} from "@/lib/edit-history";
import { errorMessage, MissingRowsError } from "@/lib/errors";
import { readJson, readStorage, writeStorage } from "@/lib/storage";

type Operation = EditOperation<Transaction, TransactionPatch>;
type Entry = EditEntry<Transaction, TransactionPatch>;
type Direction = "undo" | "redo";

const TOAST_ID = "edit-history";
const TOAST_MS = 6000;

export const UNDO_SHORTCUTS = undoShortcuts(typeof navigator !== "undefined" && isApplePlatform(navigator.userAgent));

const useHistoryStore = create<{ userId: string | null; history: History<Entry> }>(() => ({
  userId: null,
  history: emptyHistory(),
}));

function persist(userId: string, history: History<Entry>) {
  const key = historyStorageKey(userId);
  for (let keep = historySize(history); ; keep = Math.floor(keep / 2)) {
    const kept = keepNewest(history, keep);
    if (writeStorage(key, historySize(kept) > 0 ? serializeHistory(kept) : null) || keep === 0) return;
  }
}

useHistoryStore.subscribe((state, previous) => {
  if (state.userId && state.history !== previous.history) persist(state.userId, state.history);
});

const setHistory = (update: (history: History<Entry>) => History<Entry>) =>
  useHistoryStore.setState(({ history }) => ({ history: update(history) }));

export function loadEditHistory(userId: string) {
  if (useHistoryStore.getState().userId === userId) return;
  const key = historyStorageKey(userId);
  const hasStored = readStorage(key) !== null;
  const stored = hasStored ? parseStoredHistory(readJson<unknown>(key), isEditEntry) : null;
  if (hasStored && !stored) writeStorage(key, null);
  useHistoryStore.setState({ userId, history: (stored as History<Entry> | null) ?? emptyHistory() });
}

export function clearEditHistory() {
  const { userId } = useHistoryStore.getState();
  useHistoryStore.setState({ userId: null, history: emptyHistory() });
  if (userId) writeStorage(historyStorageKey(userId), null);
}

export function useNextEdits() {
  const undoLabel = useHistoryStore((state) => state.history.past.at(-1)?.label);
  const redoLabel = useHistoryStore((state) => state.history.future[0]?.label);
  return { undoLabel, redoLabel };
}

export type TransactionChanges = Partial<Omit<Transaction, "id" | "user_id" | "created_at" | "isPending">>;

export function useEditHistory() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { updateTransactions, deleteTransactions, restoreTransactions, duplicateTransactions } = useTransactionWrites();
  const { mutateAsync: patch } = updateTransactions;
  const { mutateAsync: remove } = deleteTransactions;
  const { mutateAsync: restore } = restoreTransactions;
  const { mutateAsync: duplicateRows } = duplicateTransactions;

  const cached = useCallback(() => queryClient.getQueryData<Transaction[]>(transactionsQuery.queryKey), [queryClient]);

  const cachedRows = useCallback((ids: string[]) => (cached() ?? []).filter((t) => ids.includes(t.id)), [cached]);

  const existsInCache = useCallback(() => {
    const list = cached();
    if (!list) return () => true;
    const ids = new Set(list.map((t) => t.id));
    return (id: string) => ids.has(id);
  }, [cached]);

  const run = useCallback((operation: Operation): Promise<unknown> => {
    if (operation.kind === "patch") return patch(operation.patches);
    if (operation.kind === "remove") return remove(operation.rows.map((t) => t.id));
    return restore(operation.rows);
  }, [patch, remove, restore]);

  return useMemo(() => {
    const shortcutHint = (direction: Direction) =>
      isMobile ? undefined : `${UNDO_SHORTCUTS[direction]} para ${direction === "undo" ? "deshacer" : "rehacer"}`;

    const offerUndo = (label: string) =>
      toast(label, { id: TOAST_ID, duration: TOAST_MS, description: shortcutHint("undo"), action: { label: "Deshacer", onClick: undo } });

    const offerRedo = (label: string) =>
      toast(describeUndone(label), { id: TOAST_ID, duration: TOAST_MS, description: shortcutHint("redo"), action: { label: "Rehacer", onClick: redo } });

    const dropMissing = (entry: Entry, count: number) => {
      setHistory((history) => forget(history, entry));
      toast.error(describeMissing(count), { id: TOAST_ID });
    };

    const commit = (entry: Entry): Promise<void> => {
      setHistory((history) => record(history, entry));
      offerUndo(entry.label);
      return run(entry.redo).then(() => undefined, (error: unknown) => {
        setHistory((history) => forget(history, entry));
        toast.error("No se pudo guardar el cambio", { id: TOAST_ID, description: errorMessage(error) });
      });
    };

    const travel = (step: Step<Entry> | null, direction: Direction) => {
      if (!step) return;
      const { entry } = step;
      const operation = direction === "undo" ? entry.undo : entry.redo;
      const applicable = applicablePart(operation, existsInCache());
      if (!applicable && operation.kind === "patch") {
        dropMissing(entry, operation.patches.length);
        return;
      }
      useHistoryStore.setState({ history: step.history });
      if (direction === "undo") offerRedo(entry.label);
      else offerUndo(entry.label);
      if (!applicable) return;
      flashRows(touchedIds(applicable));
      run(applicable).catch((error: unknown) => {
        if (error instanceof MissingRowsError) {
          dropMissing(entry, error.missing);
          return;
        }
        setHistory((history) => (direction === "undo" ? returnToPast(history, entry) : returnToFuture(history, entry)));
        toast.error(direction === "undo" ? "No se pudo deshacer" : "No se pudo rehacer", {
          id: TOAST_ID,
          description: errorMessage(error),
          action: { label: "Reintentar", onClick: direction === "undo" ? undo : redo },
        });
      });
    };

    const undo = () => travel(stepBack(useHistoryStore.getState().history), "undo");
    const redo = () => travel(stepForward(useHistoryStore.getState().history), "redo");

    const update = (ids: string[], changes: TransactionChanges): Promise<void> => {
      const edits = cachedRows(ids)
        .map((before) => ({ before, changes: changedFields(before, changes) }))
        .filter((edit) => Object.keys(edit.changes).length > 0);
      if (edits.length === 0) return Promise.resolve();
      const changed = Object.assign({}, ...edits.map((edit) => edit.changes)) as TransactionChanges;
      if (changed.category_name !== undefined) flashRows(edits.map((edit) => edit.before.id));
      const patches = edits.map(({ before, changes }) => {
        const forward = withManualCategorySource(changes);
        return { forward: { id: before.id, ...forward }, inverse: { id: before.id, ...revertPatch(before, forward) } };
      });
      return commit({
        label: describeUpdate(changed, edits.length),
        redo: { kind: "patch", patches: patches.map((p) => p.forward) },
        undo: { kind: "patch", patches: patches.map((p) => p.inverse) },
      });
    };

    const removeRows = (ids: string[]): Promise<void> => {
      const rows = cachedRows(ids);
      if (rows.length === 0) return Promise.resolve();
      return commit({
        label: describeRemoval(rows.length),
        redo: { kind: "remove", rows },
        undo: { kind: "restore", rows },
      });
    };

    const duplicate = (ids: string[]) => {
      duplicateRows(ids).then((copies) => {
        const entry: Entry = {
          label: describeDuplicate(copies.length),
          redo: { kind: "restore", rows: copies },
          undo: { kind: "remove", rows: copies },
        };
        setHistory((history) => record(history, entry));
        flashRows(copies.map((copy) => copy.id));
        offerUndo(entry.label);
      }, (error: unknown) => toast.error("No se pudo duplicar", { id: TOAST_ID, description: errorMessage(error) }));
    };

    return { update, remove: removeRows, duplicate, undo, redo };
  }, [cachedRows, existsInCache, run, duplicateRows, isMobile]);
}

export type EditHistory = ReturnType<typeof useEditHistory>;
