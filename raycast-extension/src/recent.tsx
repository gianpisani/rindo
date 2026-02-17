import { Action, ActionPanel, List, showToast, Toast, Color, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { getAuthenticatedClient } from "./lib/supabase";

interface Transaction {
  id: string;
  date: string;
  detail: string | null;
  category_name: string;
  type: "Ingreso" | "Gasto" | "Inversión";
  amount: number;
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";

  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });
}

function getTypeIcon(type: string): { source: Icon; tintColor: Color } {
  switch (type) {
    case "Gasto":
      return { source: Icon.ArrowDown, tintColor: Color.Red };
    case "Ingreso":
      return { source: Icon.ArrowUp, tintColor: Color.Green };
    case "Inversión":
      return { source: Icon.LineChart, tintColor: Color.Blue };
    default:
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
  }
}

export default function Command() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    const auth = await getAuthenticatedClient();
    if (!auth) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No has iniciado sesión",
        message: "Usa el comando 'Iniciar Sesión' primero",
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await auth.client
        .from("transactions")
        .select("id, date, detail, category_name, type, amount")
        .order("date", { ascending: false })
        .limit(20);

      if (error) throw error;
      setTransactions(data as Transaction[]);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error al cargar",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Buscar transacciones...">
      {transactions.length === 0 && !isLoading ? (
        <List.EmptyView
          title="Sin transacciones"
          description="Agrega tu primera transacción con el comando 'Agregar Gasto'"
          icon={Icon.BankNote}
        />
      ) : (
        transactions.map((tx) => {
          const icon = getTypeIcon(tx.type);
          return (
            <List.Item
              key={tx.id}
              title={tx.detail || tx.category_name}
              subtitle={tx.category_name !== tx.detail ? tx.category_name : undefined}
              icon={icon}
              accessories={[
                {
                  text: {
                    value: `${tx.type === "Gasto" ? "-" : "+"}${formatCLP(tx.amount)}`,
                    color: tx.type === "Gasto" ? Color.Red : Color.Green,
                  },
                },
                { text: formatDate(tx.date), tooltip: new Date(tx.date).toLocaleString("es-CL") },
              ]}
              actions={
                <ActionPanel>
                  <Action title="Recargar" icon={Icon.ArrowClockwise} onAction={loadTransactions} />
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
