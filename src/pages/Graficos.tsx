import { useEffect, useMemo, useRef, useState } from "react";
import GridLayout from "react-grid-layout";
import {
  Plus,
  SlidersHorizontal,
  GripVertical,
  Copy,
  Trash2,
  LayoutGrid,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Expand,
  Shrink,
  CloudUpload,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useGraficos, useChartTransactions } from "@/hooks/useGraficos";
import { useCategories } from "@/hooks/useCategories";
import { useCreditCards } from "@/hooks/useCreditCards";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import type { Transaction } from "@/hooks/useTransactions";
import {
  factory,
  newBlock,
  templates,
  titleFor,
  periodLabel,
  type Board,
  type Block,
  type Position,
} from "@/lib/graficos/model";
import {
  run,
  formatValue,
  dateKey,
  type NamedColor,
} from "@/lib/graficos/engine";
import { ChartView } from "@/components/graficos/ChartView";
import { Editor } from "@/components/graficos/Editor";
import { icons } from "@/components/graficos/chart-icons";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "@/components/graficos/graficos.css";

export default function Graficos() {
  const [userId, setUserId] = useState<string>();
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setUserId(data.session?.user.id));
  }, []);
  return (
    <Layout>
      {userId ? (
        <PersonalBoard key={userId} userId={userId} />
      ) : (
        <p className="text-sm text-muted-foreground">Cargando tus gráficos…</p>
      )}
    </Layout>
  );
}
function PersonalBoard({ userId }: { userId: string }) {
  const state = useGraficos(userId);
  const {
    data: transactions = [],
    isLoading,
    error,
    refetch,
  } = useChartTransactions(userId);
  const { categories } = useCategories();
  const { creditCards } = useCreditCards();
  const { isPrivacyMode } = usePrivacyMode();
  if (isLoading)
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Gráficos</h1>
        <p className="text-sm text-muted-foreground">
          Cargando todo tu historial…
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 h-80 animate-pulse rounded-xl bg-muted" />
          <div className="h-80 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  if (error)
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Gráficos</h1>
        <p>No pudimos cargar tus movimientos.</p>
        <Button onClick={() => refetch()}>Reintentar</Button>
      </div>
    );
  return (
    <BoardWorkspace
      {...state}
      transactions={transactions}
      categories={categories}
      cards={creditCards}
      privateMode={isPrivacyMode}
    />
  );
}
interface WorkspaceProps {
  board: Board;
  change: (board: Board) => void;
  transactions: Transaction[];
  categories: NamedColor[];
  cards: NamedColor[];
  privateMode?: boolean;
  status?: string;
  canSync?: boolean;
  sync?: () => void;
  conflict?: boolean;
  loadAccount?: () => void;
}
export function BoardWorkspace({
  board,
  change,
  transactions,
  categories,
  cards,
  privateMode = false,
  status = "Guardado en este dispositivo",
  canSync = false,
  sync,
  conflict = false,
  loadAccount,
}: WorkspaceProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [gallery, setGallery] = useState(false);
  const [newDraft, setNewDraft] = useState<Block | null>(null);
  const startNew = () => {
    const block = newBlock();
    setNewDraft({
      ...block,
      spec: { ...block.spec, neto: false, tipo: "todos" },
    });
  };
  const [arranging, setArranging] = useState(false);
  const [inspect, setInspect] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const [width, setWidth] = useState(0);
  const [undo, setUndo] = useState<Board | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const mode = width < 700 ? "mobile" : "desktop";
  const cols = mode === "mobile" ? 1 : 12;
  const positions = board.layouts[mode];
  const results = useMemo(
    () =>
      new Map(
        board.blocks.map((b) => [b.id, run(b.spec, transactions, cards)]),
      ),
    [board.blocks, transactions, cards],
  );
  const selected = newDraft || board.blocks.find((b) => b.id === editing);
  const visibleRows = useMemo(() => {
    const ids = new Set(inspect?.ids || []);
    return transactions
      .filter((t) => ids.has(t.id))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [inspect, transactions]);
  const changeBlock = (block: Block) =>
    change({
      ...board,
      blocks: board.blocks.map((b) => (b.id === block.id ? block : b)),
    });
  const add = (block: Block) => {
    if (board.blocks.length >= 100) {
      toast("El tablero admite hasta 100 gráficos.");
      return;
    }
    const layouts = { ...board.layouts };
    for (const m of ["desktop", "mobile"] as const) {
      const y = Math.max(0, ...layouts[m].map((p) => p.y + p.h));
      layouts[m] = [
        ...layouts[m],
        { i: block.id, x: 0, y, w: m === "mobile" ? 1 : 6, h: 9 },
      ];
    }
    change({ ...board, blocks: [...board.blocks, block], layouts });
    setGallery(false);
  };
  const remove = (id: string) => {
    setUndo(board);
    change({
      ...board,
      blocks: board.blocks.filter((b) => b.id !== id),
      layouts: {
        desktop: board.layouts.desktop.filter((p) => p.i !== id),
        mobile: board.layouts.mobile.filter((p) => p.i !== id),
      },
    });
    toast("Gráfico eliminado");
  };
  const saveLayout = (layout: Position[]) =>
    change({
      ...board,
      layouts: {
        ...board.layouts,
        [mode]: layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
      },
    });
  const reposition = (id: string, dx: number, dy: number, dw = 0, dh = 0) => {
    const next = positions.map((p) =>
      p.i === id
        ? {
            ...p,
            x: Math.max(0, Math.min(cols - p.w, p.x + dx)),
            y: Math.max(0, p.y + dy),
            w: Math.max(
              mode === "mobile" ? 1 : 3,
              Math.min(cols - p.x, p.w + dw),
            ),
            h: Math.max(4, Math.min(30, p.h + dh)),
          }
        : p,
    );
    const p = next.find((p) => p.i === id)!;
    if (
      next.some(
        (q) =>
          q.i !== id &&
          p.x < q.x + q.w &&
          p.x + p.w > q.x &&
          p.y < q.y + q.h &&
          p.y + p.h > q.y,
      )
    ) {
      toast(
        "Ese espacio ya está ocupado. Mueve el gráfico a un espacio libre.",
      );
      return;
    }
    saveLayout(next);
  };
  return (
    <div className="graficos-workspace space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gráficos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tus movimientos, a tu manera.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setGallery(true)}>
            Plantillas
          </Button>
          <Button
            variant={arranging ? "secondary" : "outline"}
            size="sm"
            onClick={() => setArranging(!arranging)}
          >
            {arranging ? <Check size={15} /> : <LayoutGrid size={15} />}
            <span className="ml-2">{arranging ? "Listo" : "Organizar"}</span>
          </Button>
          <Button
            size="sm"
            onClick={startNew}
            disabled={board.blocks.length >= 100}
          >
            <Plus size={16} />
            <span className="ml-2">Crear gráfico</span>
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="font-medium">Mis gráficos</span>
          <span className="text-muted-foreground">{board.blocks.length}</span>
          {undo && (
            <button
              className="ml-3 flex items-center gap-1 text-primary"
              onClick={() => {
                const restored = undo.blocks.filter(
                  (b) => !board.blocks.some((current) => current.id === b.id),
                );
                if (board.blocks.length + restored.length > 100) {
                  toast("El tablero admite hasta 100 gráficos.");
                  return;
                }
                const layouts = { ...board.layouts };
                for (const mode of ["desktop", "mobile"] as const) {
                  layouts[mode] = [...layouts[mode]];
                  for (const block of restored) {
                    const old = undo.layouts[mode].find(
                      (p) => p.i === block.id,
                    );
                    if (!old) continue;
                    const overlaps = layouts[mode].some(
                      (p) =>
                        old.x < p.x + p.w &&
                        old.x + old.w > p.x &&
                        old.y < p.y + p.h &&
                        old.y + old.h > p.y,
                    );
                    layouts[mode].push({
                      ...old,
                      y: overlaps
                        ? Math.max(0, ...layouts[mode].map((p) => p.y + p.h))
                        : old.y,
                    });
                  }
                }
                change({
                  ...board,
                  blocks: [...board.blocks, ...restored],
                  layouts,
                });
                setUndo(null);
              }}
            >
              <Undo2 size={12} />
              Deshacer eliminación
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span role="status">{status}</span>
          {conflict && (
            <button onClick={loadAccount} className="text-primary">
              Cargar versión de mi cuenta
            </button>
          )}
          {canSync && !conflict && (
            <button
              onClick={sync}
              className="flex items-center gap-1 text-primary"
            >
              <CloudUpload size={14} />
              Guardar en mi cuenta
            </button>
          )}
        </div>
      </div>
      {arranging && (
        <p className="text-xs text-muted-foreground">
          Arrastra desde el asa y estira desde la esquina. También puedes usar
          las flechas del teclado en el asa; con Mayús cambias el tamaño.
          {mode === "mobile" ? " Esta distribución solo cambia en móvil." : ""}
        </p>
      )}
      <div
        ref={root}
        className={`min-h-[300px] ${arranging ? "graficos-grid-editing" : ""}`}
      >
        {board.blocks.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border">
            <LayoutGrid className="text-primary" size={30} />
            <h2 className="text-lg font-semibold">
              Tu primer gráfico empieza aquí
            </h2>
            <p className="text-sm text-muted-foreground">
              Elige una plantilla o empieza desde cero.
            </p>
            <Button onClick={startNew}>Crear gráfico</Button>
          </div>
        ) : (
          width > 0 && (
            <GridLayout
              key={mode}
              width={width}
              cols={cols}
              rowHeight={24}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              layout={positions.map((p) => ({
                ...p,
                minW: mode === "mobile" ? 1 : 3,
                minH: 4,
                maxW: cols,
              }))}
              compactType={null}
              preventCollision
              isDraggable={arranging}
              isResizable={arranging}
              draggableHandle=".chart-drag-handle"
              onDragStop={(layout) => saveLayout(layout)}
              onResizeStop={(layout) => saveLayout(layout)}
            >
              {board.blocks.map((b) => {
                const result = results.get(b.id)!;
                return (
                  <section
                    key={b.id}
                    className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card"
                  >
                    <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-4">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold">
                          {titleFor(b)}
                        </h2>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {periodLabel(b.spec)}
                          {b.spec.categorias.length
                            ? ` · ${b.spec.categorias.join(", ")}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {arranging && (
                          <button
                            aria-label={`Mover ${titleFor(b)}`}
                            className="chart-drag-handle cursor-grab rounded p-1.5 text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary"
                            onKeyDown={(e) => {
                              if (
                                [
                                  "ArrowUp",
                                  "ArrowDown",
                                  "ArrowLeft",
                                  "ArrowRight",
                                ].includes(e.key)
                              ) {
                                e.preventDefault();
                                const dx =
                                  e.key === "ArrowLeft"
                                    ? -1
                                    : e.key === "ArrowRight"
                                      ? 1
                                      : 0;
                                const dy =
                                  e.key === "ArrowUp"
                                    ? -1
                                    : e.key === "ArrowDown"
                                      ? 1
                                      : 0;
                                reposition(
                                  b.id,
                                  e.shiftKey ? 0 : dx,
                                  e.shiftKey ? 0 : dy,
                                  e.shiftKey ? dx : 0,
                                  e.shiftKey ? dy : 0,
                                );
                              }
                            }}
                          >
                            <GripVertical size={15} />
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              aria-label={`Opciones de ${titleFor(b)}`}
                              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              <SlidersHorizontal size={15} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(b.id)}>
                              <SlidersHorizontal size={14} className="mr-2" />
                              Editar gráfico
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setInspect({
                                  ids: result.ids,
                                  label: titleFor(b),
                                })
                              }
                            >
                              Ver movimientos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                add({
                                  ...b,
                                  id: crypto.randomUUID(),
                                  title: `${titleFor(b)} (copia)`.slice(0, 120),
                                })
                              }
                            >
                              <Copy size={14} className="mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            {arranging && (
                              <>
                                <DropdownMenuSeparator />
                                {[
                                  [ArrowUp, "Subir", 0, -1],
                                  [ArrowDown, "Bajar", 0, 1],
                                  [ArrowLeft, "Izquierda", -1, 0],
                                  [ArrowRight, "Derecha", 1, 0],
                                ].map(([Icon, label, dx, dy]) => {
                                  const I = Icon as typeof ArrowUp;
                                  return (
                                    <DropdownMenuItem
                                      key={String(label)}
                                      onClick={() =>
                                        reposition(b.id, Number(dx), Number(dy))
                                      }
                                    >
                                      <I size={14} className="mr-2" />
                                      {String(label)}
                                    </DropdownMenuItem>
                                  );
                                })}
                                <DropdownMenuItem
                                  onClick={() => reposition(b.id, 0, 0, 0, 1)}
                                >
                                  <Expand size={14} className="mr-2" />
                                  Más alto
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => reposition(b.id, 0, 0, 0, -1)}
                                >
                                  <Shrink size={14} className="mr-2" />
                                  Más bajo
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => remove(b.id)}
                            >
                              <Trash2 size={14} className="mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 px-3 pb-3 pt-3">
                      <ChartView
                        spec={b.spec}
                        result={result}
                        categories={categories}
                        cards={cards}
                        privateMode={privateMode}
                        onInspect={(ids, label) => setInspect({ ids, label })}
                      />
                    </div>
                  </section>
                );
              })}
            </GridLayout>
          )
        )}
      </div>
      {selected && (
        <Editor
          key={selected.id}
          block={selected}
          isNew={!!newDraft}
          onSave={(block) => {
            if (newDraft) add(block);
            else changeBlock(block);
            setNewDraft(null);
            setEditing(null);
          }}
          onClose={() => {
            setEditing(null);
            setNewDraft(null);
          }}
          transactions={transactions}
          categories={categories}
          cards={cards}
          privateMode={privateMode}
        />
      )}
      <Dialog open={gallery} onOpenChange={setGallery}>
        <DialogContent className="max-w-2xl overflow-y-auto">
          <DialogTitle>¿Qué quieres ver?</DialogTitle>
          <DialogDescription>
            Empieza con una idea. Todo se puede cambiar después.
          </DialogDescription>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {templates.map((t, i) => {
              const Icon = icons[t.spec.grafico || "barras"];
              return (
                <button
                  key={t.title}
                  onClick={() => {
                    setNewDraft(newBlock(t));
                    setGallery(false);
                  }}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 ${i === 0 ? "border-primary/40 bg-primary/5" : "border-border/60"}`}
                >
                  <Icon size={20} className="mt-0.5 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">{t.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {t.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!inspect}
        onOpenChange={(open) => !open && setInspect(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogTitle>{inspect?.label}</DialogTitle>
          <DialogDescription>
            {visibleRows.length} movimientos detrás de este resultado.
          </DialogDescription>
          <div className="max-h-[60vh] overflow-auto">
            {privateMode ? (
              <p>Montos ocultos</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-card text-muted-foreground">
                  <tr>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Detalle</th>
                    <th className="p-2">Categoría</th>
                    <th className="p-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((t) => (
                    <tr key={t.id} className="border-t border-border/40">
                      <td className="whitespace-nowrap p-2">
                        {dateKey(t.date)}
                      </td>
                      <td className="p-2">{t.detail || t.type}</td>
                      <td className="p-2">
                        {t.category_name}
                        {t.reimbursement_for_category && (
                          <span className="block text-muted-foreground">
                            Devuelve: {t.reimbursement_for_category}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap p-2 text-right font-mono">
                        {formatValue(Number(t.amount), "monto")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
