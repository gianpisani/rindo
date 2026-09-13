import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BoardWorkspace } from "@/pages/Graficos";
import { boardSchema, factory, type Board } from "@/lib/graficos/model";
import type { Transaction } from "@/hooks/useTransactions";
import { Toaster } from "@/components/ui/sonner";
import "@/index.css";

const categories = [
  { name: "Comida", color: "#e11d48" },
  { name: "Supermercado", color: "#f59e0b" },
  { name: "Transporte", color: "#0ea5e9" },
  { name: "Casa", color: "#8b5cf6" },
  { name: "Viajes", color: "#10b981" },
  { name: "Sueldo", color: "#10b981" },
];
const cards = [{ id: "demo-card", name: "Mi tarjeta", color: "#0ea5e9" }];
const transactions: Transaction[] = [];
const today = new Date();
for (let m = 0; m < 12; m++) {
  const date = new Date(today.getFullYear(), today.getMonth() - 11 + m, 1, 12);
  const add = (
    amount: number,
    type: Transaction["type"],
    category: string,
    day: number,
  ) =>
    transactions.push({
      id: `demo-${m}-${day}-${type}`,
      date: new Date(
        date.getFullYear(),
        date.getMonth(),
        day,
        12,
      ).toISOString(),
      amount,
      type,
      category_name: category,
      detail:
        category === "Sueldo"
          ? "Ingreso del mes"
          : `Movimiento de ${category.toLowerCase()}`,
      user_id: "demo",
      created_at: date.toISOString(),
      card_id: type === "Gasto" ? "demo-card" : null,
      installment_id: null,
      reimbursement_for_category: null,
      bank_description: null,
    });
  add(2200000, "Ingreso", "Sueldo", 1);
  categories
    .slice(0, 5)
    .forEach((c, i) =>
      add(
        [210000, 320000, 90000, 520000, 130000][i] +
          ((m * 731 + i * 129) % 11) * 8000,
        "Gasto",
        c.name,
        2 + i,
      ),
    );
}
function Preview() {
  const [board, setBoard] = useState<Board>(() => {
    try {
      const parsed = boardSchema.safeParse(
        JSON.parse(localStorage.getItem("graficos-demo") || "null"),
      );
      if (parsed.success) return parsed.data as Board;
    } catch {
      /* A broken preview cache is safe to replace with examples. */
    }
    return factory();
  });
  const [dark, setDark] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const change = (next: Board) => {
    setBoard(next);
    localStorage.setItem("graficos-demo", JSON.stringify(next));
  };
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-3 text-xs">
        <span>
          <strong>rindo</strong>
          <span className="ml-3 text-muted-foreground">
            Vista local · datos de ejemplo
          </span>
        </span>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setDark(!dark);
              document.documentElement.classList.toggle("dark", !dark);
            }}
          >
            Tema {dark ? "claro" : "oscuro"}
          </button>
          <button onClick={() => setNarrow(!narrow)}>
            {narrow ? "Escritorio" : "Móvil"}
          </button>
          <button onClick={() => setPrivacy(!privacy)}>
            {privacy ? "Mostrar montos" : "Ocultar montos"}
          </button>
          <button onClick={() => change(factory())}>Restablecer ejemplo</button>
          <a href="/graficos" className="text-primary">
            Ver mis movimientos
          </a>
        </div>
      </div>
      <main
        className="mx-auto p-5 md:p-8"
        style={{ maxWidth: narrow ? 390 : 1320 }}
      >
        <BoardWorkspace
          board={board}
          change={change}
          transactions={transactions}
          categories={categories}
          cards={cards}
          privateMode={privacy}
        />
      </main>
      <Toaster />
    </>
  );
}
if (import.meta.env.DEV)
  createRoot(document.getElementById("root")!).render(<Preview />);
