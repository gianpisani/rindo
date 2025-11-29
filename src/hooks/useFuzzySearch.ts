import { useMemo } from "react";
import Fuse from "fuse.js";
import { Transaction } from "./useTransactions";

export function useFuzzySearch(
  transactions: Transaction[],
  searchQuery: string
) {
  const fuse = useMemo(() => {
    return new Fuse(transactions, {
      keys: [
        { name: "detail", weight: 2 },
        { name: "category_name", weight: 1.5 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
      shouldSort: true,
    });
  }, [transactions]);

  const results = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      return [];
    }

    const fuzzyResults = fuse.search(searchQuery);
    return fuzzyResults.map((result) => result.item);
  }, [fuse, searchQuery]);

  return results;
}
