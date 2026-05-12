import { useState, useRef, useCallback } from "react";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isImporting: boolean;
  onImport: (file: File) => void;
}

const TEMPLATE_COLUMNS = ["Fecha", "Detalle", "Categoría", "Tipo", "Monto"] as const;

const SAMPLE_ROWS = [
  ["01/05/2026", "Sueldo mayo", "Sueldo", "Ingreso", "1.500.000"],
  ["02/05/2026", "Supermercado Lider", "Alimentación", "Gasto", "45.000"],
  ["03/05/2026", "Netflix", "Entretenimiento", "Gasto", "8.500"],
  ["05/05/2026", "Aporte APV", "APV", "Inversión", "100.000"],
];

const COLUMN_META: Record<string, { required: boolean; hint: string }> = {
  Fecha: { required: true, hint: "DD/MM/YYYY" },
  Detalle: { required: false, hint: "Texto libre" },
  Categoría: { required: true, hint: "Se crea si no existe" },
  Tipo: { required: true, hint: "Ingreso · Gasto · Inversión" },
  Monto: { required: true, hint: "Número positivo" },
};

function generateTemplateCSV(): string {
  const header = TEMPLATE_COLUMNS.join(",");
  const rows = SAMPLE_ROWS.map((row) => row.join(","));
  return [header, ...rows].join("\n");
}

function downloadTemplate() {
  const csv = generateTemplateCSV();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla_transacciones.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportCSVModal({
  open,
  onOpenChange,
  isImporting,
  onImport,
}: ImportCSVModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) return;
      setSelectedFile(file);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleConfirmImport = () => {
    if (selectedFile) {
      onImport(selectedFile);
    }
  };

  const resetState = (openState: boolean) => {
    if (!openState) {
      setSelectedFile(null);
      setIsDragging(false);
    }
    onOpenChange(openState);
  };

  return (
    <BaseModal
      open={open}
      onOpenChange={resetState}
      title="Importar Transacciones"
      description="Sube un archivo CSV con tus transacciones"
      maxWidth="xl"
    >
      <div className="space-y-5">
        {/* Excel-like preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">Formato esperado</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 rounded-full"
              onClick={downloadTemplate}
            >
              <Download className="h-3 w-3" />
              Descargar plantilla
            </Button>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            {/* Spreadsheet header bar */}
            <div className="bg-emerald-500/10 dark:bg-emerald-500/5 border-b border-border px-3 py-1.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
              </div>
              <span className="text-[10px] text-muted-foreground font-mono ml-1">
                plantilla_transacciones.csv
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/60 dark:bg-muted/30">
                    <th className="w-8 px-2 py-2 text-center text-muted-foreground/60 font-normal border-r border-border/50">
                      #
                    </th>
                    {TEMPLATE_COLUMNS.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left font-semibold border-r border-border/50 last:border-r-0"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1">
                            {col}
                            {COLUMN_META[col].required && (
                              <span className="text-destructive text-[10px]">*</span>
                            )}
                          </span>
                          <span className="font-normal text-muted-foreground text-[10px]">
                            {COLUMN_META[col].hint}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_ROWS.map((row, i) => (
                    <tr
                      key={i}
                      className={cn(
                        "border-t border-border/30",
                        i % 2 === 0 ? "bg-background" : "bg-muted/20"
                      )}
                    >
                      <td className="w-8 px-2 py-1.5 text-center text-muted-foreground/50 border-r border-border/50 tabular-nums">
                        {i + 1}
                      </td>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className={cn(
                            "px-3 py-1.5 border-r border-border/30 last:border-r-0 font-mono",
                            j === 3 &&
                              (cell === "Ingreso"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : cell === "Gasto"
                                ? "text-red-500 dark:text-red-400"
                                : "text-blue-500 dark:text-blue-400"),
                            j === 4 && "text-right tabular-nums"
                          )}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 ml-1">
            <span className="text-destructive">*</span> Columnas obligatorias
            &nbsp;·&nbsp; Detalle es opcional &nbsp;·&nbsp; Las categorías nuevas
            se crean automáticamente
          </p>
        </div>

        {/* Drop zone / file picker */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isImporting && fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer",
            "flex flex-col items-center justify-center gap-2 text-center",
            isDragging
              ? "border-emerald-500 bg-emerald-500/5 scale-[1.01]"
              : selectedFile
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30",
            isImporting && "pointer-events-none opacity-60"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
            disabled={isImporting}
          />

          {isImporting ? (
            <>
              <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
              <p className="text-sm font-medium">Importando transacciones...</p>
              <p className="text-xs text-muted-foreground">
                Esto puede tomar unos segundos
              </p>
            </>
          ) : selectedFile ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB · Click para cambiar
                archivo
              </p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">
                Arrastra tu archivo CSV aquí
              </p>
              <p className="text-xs text-muted-foreground">
                o haz click para seleccionar
              </p>
            </>
          )}
        </div>

        {/* Import button */}
        {selectedFile && !isImporting && (
          <Button
            onClick={handleConfirmImport}
            className="w-full rounded-xl h-11 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Upload className="h-4 w-4" />
            Importar transacciones
          </Button>
        )}
      </div>
    </BaseModal>
  );
}
