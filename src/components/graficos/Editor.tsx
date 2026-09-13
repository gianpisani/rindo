import { toast } from "sonner";
import { useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  X,
  SlidersHorizontal,
  Table2,
  ChartNoAxesCombined,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  chartTypes,
  periodLabels,
  measures,
  titleFor,
  type Block,
  type Spec,
} from "@/lib/graficos/model";
import {
  columns,
  columnsFor,
  specForColumns,
  type Column,
} from "@/lib/graficos/columns";
import { TRANSACTION_TYPES } from "@/lib/ledger";
import {
  run,
  dateKey,
  formatValue,
  type NamedColor,
} from "@/lib/graficos/engine";
import type { Transaction } from "@/hooks/useTransactions";
import { ChartView } from "./ChartView";
import { icons } from "./chart-icons";

function MenuSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className="h-9 w-auto min-w-28 gap-3 text-xs"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-2 text-xs ${selected.length ? "border-primary/40 text-primary" : ""}`}
        >
          <Filter size={13} />
          {selected.length === 1
            ? options.find((o) => o.id === selected[0])?.label || selected[0]
            : label}
          {selected.length > 1 && ` (${selected.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="flex justify-between text-xs font-medium">
          <span>{label}</span>
          <button onClick={() => onChange([])} className="text-primary">
            Todas
          </button>
        </div>
        <Input
          aria-label={`Buscar ${label.toLowerCase()}`}
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8"
        />
        <div className="max-h-56 overflow-auto">
          {options
            .filter((o) =>
              o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
            )
            .map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-2 text-xs hover:bg-accent"
              >
                <Checkbox
                  checked={selected.includes(o.id)}
                  onCheckedChange={(v) =>
                    onChange(
                      v
                        ? [...selected, o.id]
                        : selected.filter((x) => x !== o.id),
                    )
                  }
                />
                {o.label}
              </label>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
export function Editor({
  block,
  isNew = false,
  onSave,
  onClose,
  transactions,
  categories,
  cards,
  privateMode,
}: {
  block: Block;
  isNew?: boolean;
  onSave: (block: Block) => void;
  onClose: () => void;
  transactions: Transaction[];
  categories: NamedColor[];
  cards: NamedColor[];
  privateMode: boolean;
}) {
  const [draft, setDraft] = useState(block);
  const [selected, setSelected] = useState<Column[]>(
    isNew && !block.title ? [] : columnsFor(block.spec),
  );
  const preview = selected.length > 0;
  const previewPane = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [focusIds, setFocusIds] = useState<string[] | null>(null);
  const s = draft.spec;
  const update = (patch: Partial<Spec>) => {
    setDraft((current) => ({
      ...current,
      spec: { ...current.spec, ...patch },
    }));
    setPage(0);
    setFocusIds(null);
  };
  const result = useMemo(
    () => run(s, transactions, cards),
    [s, transactions, cards],
  );
  const rows = useMemo(() => {
    const ids = new Set(focusIds || result.ids);
    return transactions
      .filter((t) => ids.has(t.id))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [result.ids, transactions, focusIds]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(currentPage * 50, (currentPage + 1) * 50);
  const categoryOptions = useMemo(
    () =>
      [
        ...new Set([
          ...categories.map((c) => c.name),
          ...transactions.map((t) => t.category_name),
        ]),
      ]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ id: name, label: name })),
    [categories, transactions],
  );
  const derived = ["ahorro", "diario", "patrimonio"].includes(s.medida);
  const toggleColumn = (id: Column) => {
    const next = selected.includes(id)
      ? selected.filter((c) => c !== id)
      : [...selected, id];
    // Up to two text/date columns + amount: one axis, one comparison, one value.
    if (next.filter((c) => c !== "monto").length > 2) {
      toast(
        "Puedes comparar dos columnas de datos y Monto. Desmarca una para cambiarla.",
      );
      return;
    }
    setSelected(next);
    update(specForColumns(s, next));
  };
  const dates = (key: "fechaDesde" | "fechaHasta", value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    update({
      periodo: "rango",
      fechaDesde: key === "fechaDesde" ? value : result.from,
      fechaHasta: key === "fechaHasta" ? value : result.to,
      desde: (key === "fechaDesde" ? value : result.from).slice(0, 7),
      hasta: (key === "fechaHasta" ? value : result.to).slice(0, 7),
    });
  };
  const chooseType = (value: string) => {
    const type = value as Spec["grafico"];
    update({
      grafico: type,
      ...(type === "anillos" && s.series === "ninguna"
        ? { series: "tipo" as const }
        : {}),
      ...((s.medida === "promedio" &&
        ["torta", "dona", "anillos"].includes(type)) ||
      (["ahorro", "diario"].includes(s.medida) && type !== "numero") ||
      (s.medida === "patrimonio" &&
        !["numero", "lineas", "area"].includes(type))
        ? { medida: "monto" as const }
        : {}),
    });
    if (type === "anillos" && s.series === "ninguna")
      setSelected([...new Set([...selected, "tipo" as const])]);
  };
  const summary = selected
    .map((c) => columns.find((x) => x.id === c)?.label)
    .join(" + ");
  const dateFormat = new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const rangeDescription = `${dateFormat.format(new Date(`${result.from}T12:00:00Z`))} al ${dateFormat.format(new Date(`${result.to}T12:00:00Z`))}`;
  const description = [
    titleFor({ ...draft, title: "" }),
    s.medida === "cantidad" ? "Cantidad de movimientos" : measures[s.medida],
    s.categorias.length ? s.categorias.join(", ") : "Todas las categorías",
    s.tarjetas.length
      ? s.tarjetas
          .map((id) => cards.find((c) => c.id === id)?.name || "Sin tarjeta")
          .join(", ")
      : "",
    rangeDescription,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="chart-builder flex h-[94dvh] max-h-[94dvh] w-[96vw] max-w-[1440px] flex-col gap-0 p-0"
        hideClose
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <DialogTitle>
              {isNew
                ? "Crea un gráfico con tus movimientos"
                : "Editar datos y gráfico"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              Filtra tus movimientos y haz clic en las columnas que quieres
              graficar.
            </DialogDescription>
          </div>
          <button
            aria-label="Cerrar editor"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-accent"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-5 py-3">
          <MenuSelect
            label="Período"
            value={s.periodo}
            options={periodLabels}
            onChange={(v) =>
              update({
                periodo: v as Spec["periodo"],
                fechaDesde: undefined,
                fechaHasta: undefined,
                ...(v === "rango"
                  ? {
                      desde: result.from.slice(0, 7),
                      hasta: result.to.slice(0, 7),
                    }
                  : {}),
              })
            }
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Desde
            <input
              aria-label="Desde"
              type="date"
              value={
                s.periodo === "rango"
                  ? s.fechaDesde || `${s.desde}-01`
                  : result.from
              }
              onInput={(e) => dates("fechaDesde", e.currentTarget.value)}
              onChange={(e) => dates("fechaDesde", e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Hasta
            <input
              aria-label="Hasta"
              type="date"
              value={
                s.periodo === "rango" ? s.fechaHasta || result.to : result.to
              }
              max={dateKey(new Date())}
              onInput={(e) => dates("fechaHasta", e.currentTarget.value)}
              onChange={(e) => dates("fechaHasta", e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            />
          </label>
          {!derived && (
            <>
              <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
              <MenuSelect
                label="Tipo de movimiento"
                value={s.tipo}
                options={{
                  todos: "Todos los tipos",
                  ...Object.fromEntries(TRANSACTION_TYPES.map((t) => [t, t])),
                }}
                onChange={(v) => update({ tipo: v as Spec["tipo"] })}
              />
              <FilterMenu
                label="Categorías"
                options={categoryOptions}
                selected={s.categorias}
                onChange={(categorias) => update({ categorias })}
              />
              <FilterMenu
                label="Tarjetas"
                options={[
                  { id: "sin-tarjeta", label: "Sin tarjeta" },
                  ...cards.map((c) => ({ id: c.id, label: c.name })),
                ]}
                selected={s.tarjetas}
                onChange={(tarjetas) => update({ tarjetas })}
              />
            </>
          )}
        </div>
        <div className="chart-builder-body grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:overflow-hidden">
          <div className="flex min-h-[330px] min-w-0 flex-col border-b border-border lg:min-h-0 lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 items-center justify-between gap-2 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Table2 size={16} className="text-muted-foreground" />
                Tus movimientos
                <span className="text-xs font-normal text-muted-foreground">
                  {rows.length.toLocaleString("es-CL")}
                </span>
              </div>
              {selected.length > 0 && (
                <button
                  onClick={() => {
                    setSelected([]);
                    update(specForColumns(s, []));
                  }}
                  className="text-xs text-primary"
                >
                  Limpiar columnas
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="chart-source-table w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="w-9 border-y border-border bg-muted px-2 text-right text-[10px] font-normal text-muted-foreground">
                      #
                    </th>
                    {columns.map((c) => (
                      <th
                        key={c.id}
                        className={`border border-border ${selected.includes(c.id) ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                      >
                        <button
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                          aria-label={`Seleccionar columna ${c.label}`}
                          aria-pressed={selected.includes(c.id)}
                          onClick={() => toggleColumn(c.id)}
                        >
                          <span>
                            <span
                              className={`mb-0.5 block text-[9px] ${selected.includes(c.id) ? "opacity-70" : "text-muted-foreground"}`}
                            >
                              {c.letter}
                            </span>
                            {c.label}
                          </span>
                          {selected.includes(c.id) ? (
                            <Check size={13} />
                          ) : (
                            <Plus size={13} className="opacity-40" />
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {privateMode ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-muted-foreground"
                      >
                        Movimientos ocultos por el modo privado.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((t, i) => (
                      <tr key={t.id} className="border-b border-border/40">
                        <td className="bg-muted/30 px-2 text-right text-[10px] text-muted-foreground">
                          {currentPage * 50 + i + 1}
                        </td>
                        {columns.map((c) => {
                          const value =
                            c.id === "fecha"
                              ? dateKey(t.date)
                              : c.id === "categoria"
                                ? t.category_name
                                : c.id === "detalle"
                                  ? t.detail || "—"
                                  : c.id === "tipo"
                                    ? t.type
                                    : c.id === "monto"
                                      ? formatValue(Number(t.amount), "monto")
                                      : cards.find(
                                          (card) => card.id === t.card_id,
                                        )?.name || "Sin tarjeta";
                          return (
                            <td
                              key={c.id}
                              title={String(value)}
                              className={`max-w-52 truncate border-r border-border/30 px-3 py-3 ${selected.includes(c.id) ? "bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-foreground" : ""} ${c.id === "monto" ? "text-right font-mono tabular-nums" : "text-muted-foreground"}`}
                            >
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                  {!privateMode && !rows.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-muted-foreground"
                      >
                        {result.error ||
                          "No hay movimientos con estos filtros."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              <span>
                {focusIds ? (
                  <button
                    onClick={() => {
                      setFocusIds(null);
                      setPage(0);
                    }}
                    className="text-primary"
                  >
                    Ver todos los movimientos filtrados
                  </button>
                ) : (
                  `${summary || "Selecciona columnas en la cabecera"}${selected.length && !selected.includes("monto") ? " · Se contarán movimientos" : ""}`
                )}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  aria-label="Página anterior"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                  className="p-1 disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                {currentPage + 1} / {pageCount}
                <button
                  aria-label="Página siguiente"
                  disabled={currentPage === pageCount - 1}
                  onClick={() => setPage(currentPage + 1)}
                  className="p-1 disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
          <div
            ref={previewPane}
            className="flex min-h-[380px] min-w-0 flex-col overflow-auto bg-background/35 p-5 lg:min-h-0"
          >
            {!preview ? (
              <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
                <ChartNoAxesCombined
                  size={32}
                  strokeWidth={1.25}
                  className="mb-4 text-primary"
                />
                <h3 className="text-lg font-semibold">
                  ¿Qué columnas quieres ver?
                </h3>
                <p className="mt-2 max-w-64 text-sm leading-relaxed text-muted-foreground">
                  Marca las columnas de la tabla. Por ejemplo, Fecha y Monto
                  para ver tus montos mes a mes. El gráfico aparece al instante.
                </p>
              </div>
            ) : (
              <>
                <Input
                  aria-label="Nombre del gráfico"
                  maxLength={120}
                  value={draft.title}
                  placeholder={titleFor(draft)}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  className="h-9 border-transparent bg-transparent px-0 text-base font-semibold shadow-none focus-visible:border-input focus-visible:px-2"
                />
                <p
                  aria-live="polite"
                  className="mt-1 text-xs leading-relaxed text-muted-foreground"
                >
                  {description}
                </p>
                <div className="mt-3 flex shrink-0 flex-wrap gap-1">
                  {Object.entries(chartTypes).map(([key, label]) => {
                    const Icon = icons[key];
                    return (
                      <button
                        key={key}
                        aria-label={`Mostrar ${label.toLowerCase()}`}
                        aria-pressed={s.grafico === key}
                        onClick={() => chooseType(key)}
                        title={label}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs ${s.grafico === key ? "bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-primary" : "text-muted-foreground hover:bg-accent"}`}
                      >
                        <Icon size={15} />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div
                  className="mt-4 min-h-60 flex-1"
                  style={{ minHeight: 260 }}
                >
                  <ChartView
                    spec={s}
                    result={result}
                    categories={categories}
                    cards={cards}
                    privateMode={privateMode}
                    onColorChange={(key, color) =>
                      update({ colores: { ...s.colores, [key]: color } })
                    }
                    onInspect={(ids) => {
                      setFocusIds(ids);
                      setPage(0);
                    }}
                  />
                </div>
                <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{summary}</span>
                  {selected.includes("fecha") && (
                    <MenuSelect
                      label="Mostrar fechas por"
                      value={s.agrupar}
                      options={{
                        mes: "Por mes",
                        año: "Por año",
                        trimestre: "Por trimestre",
                        semana: "Por día de la semana",
                      }}
                      onChange={(v) =>
                        update({ agrupar: v as Spec["agrupar"] })
                      }
                    />
                  )}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Toca un color de la leyenda para cambiarlo. Toca el gráfico
                  para ver sus movimientos.
                </p>
                <details className="mt-4 shrink-0 border-t border-border pt-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <SlidersHorizontal size={13} />
                    Más opciones
                  </summary>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <MenuSelect
                      label="Cálculo"
                      value={s.medida}
                      options={
                        s.grafico === "numero"
                          ? measures
                          : {
                              monto: "Sumar montos",
                              cantidad: "Contar movimientos",
                              ...(!["torta", "dona", "anillos"].includes(
                                s.grafico,
                              )
                                ? { promedio: "Promedio por movimiento" }
                                : {}),
                            }
                      }
                      onChange={(v) => {
                        update({
                          medida: v as Spec["medida"],
                          ...(["ahorro", "diario", "patrimonio"].includes(v)
                            ? {
                                tipo: "todos",
                                categorias: [],
                                tarjetas: [],
                                series: "ninguna",
                                agrupar: "mes",
                              }
                            : {}),
                        });
                        setSelected(
                          v === "cantidad"
                            ? selected.filter((c) => c !== "monto")
                            : [...new Set([...selected, "monto" as const])],
                        );
                      }}
                    />
                    {!derived && s.medida !== "cantidad" && (
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={s.neto}
                          onCheckedChange={(v) => update({ neto: !!v })}
                        />
                        Descontar reembolsos
                      </label>
                    )}
                  </div>
                </details>
                {(derived || s.neto) && (
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                    {s.medida === "patrimonio"
                      ? "Incluye el saldo anterior al período. Aportes y rescates no crean patrimonio."
                      : s.medida === "ahorro"
                        ? "Ahorro = (ingresos − gastos) ÷ ingresos, según las fechas de tus movimientos."
                        : s.medida === "diario"
                          ? "Gasto del período dividido por los días calendario transcurridos."
                          : "Los reembolsos de la tabla se descuentan de la categoría a la que corresponden."}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {preview
              ? "La tabla y el gráfico usan los mismos movimientos."
              : "Puedes elegir dos columnas de datos y Monto."}
          </p>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {preview && (
              <button
                className="mr-auto text-xs text-primary lg:hidden"
                onClick={() =>
                  previewPane.current?.scrollIntoView({
                    block: "start",
                    behavior: "smooth",
                  })
                }
              >
                Ver gráfico
              </button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!selected.length || !!result.error}
              onClick={() =>
                onSave({
                  ...draft,
                  spec: { ...draft.spec, columnas: selected },
                })
              }
            >
              {isNew ? "Guardar en mi tablero" : "Guardar cambios"}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
