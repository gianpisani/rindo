import Papa from "papaparse";
import { format } from "date-fns";

interface ExportableTransaction {
  date: string;
  detail: string | null;
  category_name: string;
  type: string;
  amount: number;
}

export function transactionsCsv(transactions: ExportableTransaction[]) {
  return Papa.unparse(
    transactions.map((t) => ({
      Fecha: format(new Date(t.date), "dd/MM/yyyy"),
      Detalle: t.detail || "",
      Categoría: t.category_name,
      Tipo: t.type,
      Monto: `$${Number(t.amount).toLocaleString("es-CL")}`,
    })),
  );
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export function exportTransactionsCsv(transactions: ExportableTransaction[]) {
  downloadCsv(transactionsCsv(transactions), `transacciones_${format(new Date(), "yyyy-MM-dd")}.csv`);
}
