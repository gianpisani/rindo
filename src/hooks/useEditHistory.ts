import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { create } from "zustand";
import { transactionsQuery, useTransactionWrites, type Transaction, type TransactionPatch } from "@/hooks/useTransactions";
import { withManualCategorySource } from "@/lib/auto-category-policy";
import {
  changedFields,
  describeDuplicate,
  describeRemoval,
  describeUpdate,
  emptyHistory,
  forget,
  record,
  revertPatch,
  stepBack,
  stepForward,
  type History,
} from "@/lib/edit-history";
import { errorMessage } from "@/lib/errors";

type Operation =
  | { kind: "patch"; patches: TransactionPatch[] }
  | { kind: "remove"; rows: Transaction[] }
  | { kind: "restore"; rows: Transaction[] };

interface Entry {
  label: string;
  undo: Operation;
  redo: Operation;
}

const TOAST_ID = "edit-history";
const TOAST_MS = 5000;

const useHistoryStore = create<{ history: History<Entry> }>(() => ({ history: emptyHistory() }));

const setHistory = (update: (history: History<Entry>) => History<Entry>) =>
  useHistoryStore.setState(({ history }) => ({ history: update(history) }));

export const clearEditHistory = () => useHistoryStore.setState({ history: emptyHistory() });

export type TransactionChanges = Partial<Omit<Transaction, "id" | "user_id" | "created_at" | "isPending">>;

export function useEditHistory() {
  const queryClient = useQueryClient();
  const { updateTransactions, deleteTransactions, restoreTransactions, duplicateTransactions } = useTransactionWrites();
  const { mutateAsync: patch } = updateTransactions;
  const { mutateAsync: remove } = deleteTransactions;
  const { mutateAsync: restore } = restoreTransactions;
  const { mutateAsync: duplicateRows } = duplicateTransactions;

  const cachedRows = useCallback((ids: string[]) =>
    (queryClient.getQueryData<Transaction[]>(transactionsQuery.queryKey) ?? []).filter((t) => ids.includes(t.id)),
  [queryClient]);

  const run = useCallback((operation: Operation): Promise<unknown> => {
    if (operation.kind === "patch") return patch(operation.patches);
    if (operation.kind === "remove") return remove(operation.rows.map((t) => t.id));
    return restore(operation.rows);
  }, [patch, remove, restore]);

  return useMemo(() => {
    const announce = (label: string, action: { label: string; onClick: () => void }) =>
      toast(label, { id: TOAST_ID, action, duration: TOAST_MS });

    const fail = (title: string, entry: Entry) => (error: unknown) => {
      setHistory((history) => forget(history, entry));
      toast.error(title, { id: TOAST_ID, description: errorMessage(error) });
    };

    const commit = (entry: Entry) => {
      setHistory((history) => record(history, entry));
      announce(entry.label, { label: "Deshacer", onClick: undo });
      return run(entry.redo).catch(fail("No se pudo guardar el cambio", entry));
    };

    const undo = () => {
      const step = stepBack(useHistoryStore.getState().history);
      if (!step) return;
      useHistoryStore.setState({ history: step.history });
      announce(`Deshecho: ${step.entry.label}`, { label: "Rehacer", onClick: redo });
      void run(step.entry.undo).catch(fail("No se pudo deshacer", step.entry));
    };

    const redo = () => {
      const step = stepForward(useHistoryStore.getState().history);
      if (!step) return;
      useHistoryStore.setState({ history: step.history });
      announce(step.entry.label, { label: "Deshacer", onClick: undo });
      void run(step.entry.redo).catch(fail("No se pudo rehacer", step.entry));
    };

    const update = (ids: string[], changes: TransactionChanges) => {
      const edits = cachedRows(ids)
        .map((before) => ({ before, changes: changedFields(before, changes) }))
        .filter((edit) => Object.keys(edit.changes).length > 0)
        .map(({ before, changes }) => {
          const forward = withManualCategorySource(changes);
          return { forward: { id: before.id, ...forward }, inverse: { id: before.id, ...revertPatch(before, forward) } };
        });
      if (edits.length === 0) return;
      void commit({
        label: describeUpdate(changes, edits.length),
        redo: { kind: "patch", patches: edits.map((edit) => edit.forward) },
        undo: { kind: "patch", patches: edits.map((edit) => edit.inverse) },
      });
    };

    const removeRows = (ids: string[]) => {
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
        announce(entry.label, { label: "Deshacer", onClick: undo });
      }, (error: unknown) => toast.error("No se pudo duplicar", { id: TOAST_ID, description: errorMessage(error) }));
    };

    return { update, remove: removeRows, duplicate, undo, redo };
  }, [cachedRows, run, duplicateRows]);
}

export type EditHistory = ReturnType<typeof useEditHistory>;
