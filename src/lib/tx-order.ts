type Ordered = { date: string; created_at: string };

export const byNewest = (a: Ordered, b: Ordered) =>
  new Date(b.date).getTime() - new Date(a.date).getTime() ||
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
