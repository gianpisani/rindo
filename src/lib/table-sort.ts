export type SortRule = { id: string; desc: boolean };

export const DEFAULT_SORT: SortRule[] = [{ id: "date", desc: true }];

const FIRST_CLICK_DESC: Record<string, boolean> = { date: false, amount: true };

export const isDefaultSort = (sort: SortRule[]) =>
  sort.length === 0 || (sort[0].id === "date" && sort[0].desc);

export function nextSort(current: SortRule[], id: string): SortRule[] {
  const active = isDefaultSort(current) ? undefined : current[0];
  const firstDesc = FIRST_CLICK_DESC[id] ?? false;
  if (active?.id !== id) return [{ id, desc: firstDesc }];
  if (active.desc === firstDesc) return [{ id, desc: !firstDesc }];
  return DEFAULT_SORT;
}

export function consecutiveSections<T>(items: T[], keyOf: (item: T) => string) {
  const sections: { key: string; start: number; items: T[] }[] = [];
  items.forEach((item, index) => {
    const key = keyOf(item);
    const last = sections[sections.length - 1];
    if (last?.key === key) last.items.push(item);
    else sections.push({ key, start: index, items: [item] });
  });
  return sections;
}
