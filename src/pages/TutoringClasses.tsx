import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from "@tanstack/react-table";
import {
  Plus,
  Search,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Check,
  Clock,
  CircleCheckBig,
  CircleX,
  DollarSign,
  UserPlus,
  GraduationCap,
  CalendarDays,
  TrendingUp,
  CircleDollarSign,
  AlertCircle,
  Users,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  StickyNote,
  ArrowUp,
} from "lucide-react";
import {
  useTutoringClasses,
  TutoringClass,
  TutoringStudent,
} from "@/hooks/useTutoringClasses";
import { format, subDays, addDays, startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval } from "date-fns";
import { InlineDateTimePicker } from "@/components/ui/date-time-picker";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useSearchFocusShortcut } from "@/hooks/useSearchFocusShortcut";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSoundFX } from "@/hooks/useSoundFX";
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from "@heroicons/react/24/outline";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { parseWhisper } from "@/lib/whisper";
import "@/components/whisper.css";

// ── Status config ──────────────────────────────────────────

const statusConfig = {
  scheduled: { label: "Agendada", icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  completed: { label: "Realizada", icon: CircleCheckBig, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  cancelled: { label: "Cancelada", icon: CircleX, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
};

// ── Avatar helpers ──────────────────────────────────────────

const AVATAR_PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#f97316", "#14b8a6",
];

function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// ── Date group helpers ──────────────────────────────────────

function formatGroupDate(dayKey: string): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  if (dayKey === today) return "Hoy";
  if (dayKey === yesterday) return "Ayer";
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(amount);

// ── Composers al estilo Whisper ─────────────────────────────
// La clase se anota en una línea: el precio por hora (y, si quieres, el
// nombre del alumno: "25000 Juan" lo elige solo). El resto va en pastillas.

type ClassForm = {
  student_id: string;
  date: Date;
  duration_hours: string;
  price_per_hour: string;
  status: TutoringClass["status"];
  is_paid: boolean;
  notes: string;
  cancellation_reason: string;
};

const DURATIONS = [
  { value: "0.5", label: "30 min" },
  { value: "1", label: "1 hora" },
  { value: "1.5", label: "1,5 horas" },
  { value: "2", label: "2 horas" },
  { value: "2.5", label: "2,5 horas" },
  { value: "3", label: "3 horas" },
];

const STATUS_ACCENT: Record<TutoringClass["status"], string> = {
  scheduled: "#60a5fa",
  completed: "#4ade80",
  cancelled: "#f87171",
};

const localDateTime = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

function ClassComposer({
  open,
  onOpenChange,
  form,
  onChange,
  students,
  mode,
  editing,
  pending,
  onSubmit,
  onNewStudent,
  isPrivacyMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ClassForm;
  onChange: (values: Partial<ClassForm>) => void;
  students: TutoringStudent[];
  /** quick: anotar una clase de hoy; edit: todos los estados */
  mode: "quick" | "edit";
  editing: boolean;
  pending: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onNewStudent?: () => void;
  isPrivacyMode: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const reducedMotion = useReducedMotion();
  const { playTap } = useSoundFX();

  const price = parseInt(form.price_per_hour, 10) || 0;
  const hours = parseFloat(form.duration_hours) || 0;
  const total = price * hours;
  const student = students.find((s) => s.id === form.student_id);
  const statuses = (mode === "quick" ? ["scheduled", "completed"] : ["scheduled", "completed", "cancelled"]) as TutoringClass["status"][];
  const ready = price > 0 && !!form.student_id && !pending;
  const durationLabel = DURATIONS.find((d) => d.value === form.duration_hours)?.label ?? `${form.duration_hours} h`;

  useEffect(() => {
    if (!open) return;
    setText(form.price_per_hour ? String(parseInt(form.price_per_hour, 10) || "") : "");
    setExpanded(false);
    setError("");
    // Solo al abrir: el texto vive acá mientras se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // "25000" o "25000 Juan": el monto va al precio y el nombre elige al alumno.
  const handleText = (value: string) => {
    setText(value);
    setError("");
    const parsed = parseWhisper(value);
    const values: Partial<ClassForm> = { price_per_hour: parsed ? String(parsed.amount) : "" };
    if (parsed?.detail) {
      const needle = parsed.detail.toLowerCase();
      const match = students.find((s) => s.name.toLowerCase().startsWith(needle)) ?? students.find((s) => s.name.toLowerCase().includes(needle));
      if (match) values.student_id = match.id;
    }
    onChange(values);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!price) {
      setError("Escribe el precio por hora en pesos.");
      inputRef.current?.focus();
      return;
    }
    if (!form.student_id) {
      setError("Elige al alumno.");
      return;
    }
    onSubmit(event);
  };

  const caption = [
    student ? student.name : "elige al alumno",
    format(form.date, "EEE d MMM · HH:mm", { locale: es }).replace(".", ""),
    statusConfig[form.status].label.toLowerCase(),
    form.is_paid ? "pagada" : null,
  ].filter(Boolean).join(" · ");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="whisper-backdrop" />
        <Dialog.Content
          data-scrollable
          className="whisper-composer"
          style={{ "--whisper-accent": STATUS_ACCENT[form.status] } as React.CSSProperties}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">{editing ? "Editar clase" : "Agregar clase"}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Escribe el precio por hora y, si quieres, el nombre del alumno. Abajo eliges alumno, duración, estado y si está pagada. En más opciones están la fecha y las notas.
          </Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar">
            <X size={16} />
          </Dialog.Close>

          <form onSubmit={submit} className="whisper-form">
            <div className="whisper-type" data-static>
              <span className="whisper-dot" aria-hidden="true" />
              <span>{editing ? "Editar clase" : "Clase"}</span>
            </div>

            <div className="whisper-entry">
              <input
                ref={inputRef}
                aria-label="Precio por hora y alumno"
                aria-describedby={error ? "class-error class-shortcuts" : "class-shortcuts"}
                aria-invalid={!!error}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={80}
                value={text}
                onChange={(event) => handleText(event.target.value)}
                placeholder={students[0] ? `25000 ${students[0].name}` : "25000"}
                className={cn("whisper-input", isPrivacyMode && text && "privacy-blur")}
              />
              <div className={cn("whisper-preview", isPrivacyMode && price > 0 && "privacy-blur")} aria-hidden="true">
                {price > 0 && (
                  <span>
                    {durationLabel} × {formatCurrency(price)} = {formatCurrency(total)}
                  </span>
                )}
              </div>
            </div>

            <div className="whisper-category-space">
              <div className="whisper-categories" role="group" aria-label="Alumno">
                {students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="whisper-category"
                    aria-pressed={form.student_id === s.id}
                    style={{ "--whisper-accent": getAvatarColor(s.name) } as React.CSSProperties}
                    onClick={() => {
                      onChange({ student_id: s.id });
                      playTap();
                      inputRef.current?.focus();
                    }}
                  >
                    <span className="whisper-category-dot" aria-hidden="true" />
                    {s.name}
                    {form.student_id === s.id && <Check size={12} aria-hidden="true" />}
                  </button>
                ))}
                {onNewStudent && (
                  <button type="button" className="whisper-more-categories" onClick={onNewStudent}>
                    <UserPlus size={12} aria-hidden="true" /> Alumno
                  </button>
                )}
              </div>

              <div className="whisper-categories whisper-counts" role="group" aria-label="Duración">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className="whisper-category"
                    aria-pressed={form.duration_hours === d.value}
                    onClick={() => {
                      onChange({ duration_hours: d.value });
                      playTap();
                      inputRef.current?.focus();
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="whisper-categories whisper-counts" role="group" aria-label="Estado y pago">
                {statuses.map((s) => {
                  const Icon = statusConfig[s].icon;
                  return (
                    <button
                      key={s}
                      type="button"
                      className="whisper-category"
                      aria-pressed={form.status === s}
                      style={{ "--whisper-accent": STATUS_ACCENT[s] } as React.CSSProperties}
                      onClick={() => {
                        onChange({ status: s });
                        if (s === "cancelled") setExpanded(true);
                        playTap();
                      }}
                    >
                      <Icon size={12} aria-hidden="true" />
                      {statusConfig[s].label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="whisper-category"
                  aria-pressed={form.is_paid}
                  style={{ "--whisper-accent": STATUS_ACCENT.completed } as React.CSSProperties}
                  onClick={() => {
                    onChange({ is_paid: !form.is_paid });
                    playTap();
                  }}
                >
                  <DollarSign size={12} aria-hidden="true" />
                  Pagada
                </button>
              </div>

              <p className="whisper-caption" aria-live="polite">{caption}</p>
            </div>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  className="whisper-options"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.18 }}
                >
                  <label>
                    Fecha y hora
                    <input
                      type="datetime-local"
                      value={localDateTime(form.date)}
                      onChange={(event) => {
                        const next = new Date(event.target.value);
                        if (Number.isFinite(next.getTime())) onChange({ date: next });
                      }}
                      aria-label="Fecha y hora de la clase"
                    />
                  </label>
                  <label>
                    Notas
                    <input value={form.notes} onChange={(event) => onChange({ notes: event.target.value })} placeholder="Opcional" aria-label="Notas" />
                  </label>
                  {form.status === "cancelled" && (
                    <label className="whisper-class-wide">
                      Razón de cancelación
                      <input
                        value={form.cancellation_reason}
                        onChange={(event) => onChange({ cancellation_reason: event.target.value })}
                        placeholder="¿Por qué se canceló?"
                        aria-label="Razón de cancelación"
                      />
                    </label>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p id="class-error" role="alert" className="whisper-error">
                {error}
              </p>
            )}

            <div className="whisper-actions">
              <button type="button" className="whisper-options-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? "Menos opciones" : "Más opciones"}
                <ChevronDown size={12} className={cn(expanded && "rotate-180")} />
              </button>
              <button type="submit" className="whisper-submit" disabled={!ready} aria-label="Guardar clase">
                {pending ? "Guardando…" : editing ? "Guardar cambios" : "Agregar clase"}
                <span className="hidden sm:inline" aria-hidden="true">↵</span>
                <ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
              </button>
            </div>
            <p id="class-shortcuts" className="whisper-shortcuts">
              <span><kbd>↵</kbd> guardar</span>
              <span><kbd>Esc</kbd> cerrar</span>
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StudentComposer({
  open,
  onOpenChange,
  name,
  onName,
  students,
  pending,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onName: (name: string) => void;
  students: TutoringStudent[];
  pending: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onDelete: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ready = name.trim().length > 0 && !pending;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="whisper-backdrop" />
        <Dialog.Content
          data-scrollable
          className="whisper-composer"
          style={{ "--whisper-accent": name.trim() ? getAvatarColor(name.trim()) : "#a3a3a3" } as React.CSSProperties}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Nuevo alumno</Dialog.Title>
          <Dialog.Description className="sr-only">Escribe el nombre del alumno. Abajo están los que ya tienes; cada uno se puede eliminar.</Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar">
            <X size={16} />
          </Dialog.Close>

          <form onSubmit={onSubmit} className="whisper-form">
            <div className="whisper-type" data-static>
              <span className="whisper-dot" aria-hidden="true" />
              <span>Alumno</span>
            </div>
            <div className="whisper-entry">
              <input
                ref={inputRef}
                aria-label="Nombre del alumno"
                autoComplete="off"
                spellCheck={false}
                maxLength={80}
                value={name}
                onChange={(event) => onName(event.target.value)}
                placeholder="Nombre del alumno"
                className="whisper-input"
              />
              <div className="whisper-preview" aria-hidden="true">
                {name.trim() && <span>se agrega a tus alumnos</span>}
              </div>
            </div>
            {students.length > 0 && (
              <div className="whisper-category-space">
                <div className="whisper-categories" role="list" aria-label="Alumnos existentes">
                  {students.map((s) => (
                    <span key={s.id} role="listitem" className="whisper-class-student">
                      <i className="whisper-class-avatar" style={{ background: getAvatarColor(s.name) }} aria-hidden="true" />
                      {s.name}
                      <button type="button" aria-label={`Eliminar a ${s.name}`} onClick={() => onDelete(s.id)}>
                        <X size={11} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
                <p className="whisper-caption">Tus alumnos · la × los elimina</p>
              </div>
            )}
            <div className="whisper-actions">
              <button type="submit" className="whisper-submit" disabled={!ready} aria-label="Agregar alumno">
                {pending ? "Guardando…" : "Agregar alumno"}
                <span className="hidden sm:inline" aria-hidden="true">↵</span>
                <ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
              </button>
            </div>
            <p className="whisper-shortcuts">
              <span><kbd>↵</kbd> guardar</span>
              <span><kbd>Esc</kbd> cerrar</span>
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Component ───────────────────────────────────────────────

export default function TutoringClasses() {
  const {
    students,
    addStudent,
    deleteStudent,
    classes,
    isLoading,
    addClass,
    updateClass,
    updateClassSilent,
    deleteClass,
  } = useTutoringClasses();

  const { isPrivacyMode } = usePrivacyMode();
  const isMobile = useIsMobile();
  const { playToggleOff, playTap } = useSoundFX();

  // ── State ─────────────────────────────────────────────────

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<TutoringClass | null>(null);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchFocusShortcut(searchInputRef);
  const [statusFilter, setStatusFilter] = useState("all");
  const [studentFilter, setStudentFilter] = useState("all");
  const [paidFilter, setPaidFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: false }]);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [viewMode, setViewMode] = useState<"list" | "students">("students");

  // ── Keyboard shortcut: C → quick add ──────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if modifier keys held
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Skip if inside input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      // Skip if any dialog/modal is open
      if (document.querySelector("[role='dialog'][data-state='open']")) return;

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        resetQuickForm();
        setIsQuickAddOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Quick Add form ────────────────────────────────────────

  const [quickForm, setQuickForm] = useState({
    student_id: "",
    date: new Date(),
    duration_hours: "1",
    price_per_hour: "",
    status: "completed" as TutoringClass["status"],
    is_paid: false,
    notes: "",
    cancellation_reason: "",
  });

  // ── Full form (for edit modal) ────────────────────────────

  const [formData, setFormData] = useState({
    student_id: "",
    date: new Date(),
    duration_hours: "1",
    price_per_hour: "",
    status: "scheduled" as TutoringClass["status"],
    is_paid: false,
    notes: "",
    cancellation_reason: "",
  });

  const resetForm = () => {
    setFormData({
      student_id: "",
      date: new Date(),
      duration_hours: "1",
      price_per_hour: "",
      status: "scheduled",
      is_paid: false,
      notes: "",
      cancellation_reason: "",
    });
  };

  const resetQuickForm = () => {
    setQuickForm({
      student_id: "",
      date: new Date(),
      duration_hours: "1",
      price_per_hour: "",
      status: "completed",
      is_paid: false,
      notes: "",
      cancellation_reason: "",
    });
  };

  // ── Handlers ──────────────────────────────────────────────

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseInt(quickForm.price_per_hour.replace(/\D/g, ""), 10);
    if (!quickForm.student_id || isNaN(priceNum)) return;

    await addClass.mutateAsync({
      student_id: quickForm.student_id,
      date: quickForm.date.toISOString(),
      duration_hours: parseFloat(quickForm.duration_hours),
      price_per_hour: priceNum,
      status: quickForm.status,
      is_paid: quickForm.is_paid,
      notes: quickForm.notes || null,
      cancellation_reason: null,
    });

    playToggleOff();
    resetQuickForm();
    setIsQuickAddOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseInt(formData.price_per_hour.replace(/\D/g, ""), 10);
    if (!formData.student_id || isNaN(priceNum)) return;

    const payload = {
      student_id: formData.student_id,
      date: formData.date.toISOString(),
      duration_hours: parseFloat(formData.duration_hours),
      price_per_hour: priceNum,
      status: formData.status,
      is_paid: formData.is_paid,
      notes: formData.notes || null,
      cancellation_reason: formData.status === "cancelled" ? (formData.cancellation_reason || null) : null,
    };

    if (editingClass) {
      await updateClass.mutateAsync({ id: editingClass.id, ...payload });
    } else {
      await addClass.mutateAsync(payload);
    }

    setIsAddOpen(false);
    setEditingClass(null);
    resetForm();
  };

  const handleEdit = (cls: TutoringClass) => {
    setEditingClass(cls);
    setFormData({
      student_id: cls.student_id,
      date: new Date(cls.date),
      duration_hours: cls.duration_hours.toString(),
      price_per_hour: cls.price_per_hour.toString(),
      status: cls.status,
      is_paid: cls.is_paid,
      notes: cls.notes || "",
      cancellation_reason: cls.cancellation_reason || "",
    });
    setIsAddOpen(true);
  };

  const handleDelete = (id: string) => setConfirmDelete({ open: true, id });

  const confirmDeleteAction = async () => {
    if (confirmDelete.id) await deleteClass.mutateAsync(confirmDelete.id);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    await addStudent.mutateAsync(newStudentName.trim());
    setNewStudentName("");
    setIsStudentDialogOpen(false);
  };

  const handleInlineUpdate = useCallback(
    async (id: string, field: keyof TutoringClass, value: unknown) => {
      await updateClassSilent.mutateAsync({ id, [field]: value });
    },
    [updateClassSilent]
  );

  // Quick-add class for a specific student (pre-filled, +7 days from last class)
  const handleQuickAddForStudent = useCallback(
    async (studentId: string, pricePerHour: number, duration: number, lastDate: string) => {
      const nextDate = addDays(new Date(lastDate), 7);
      await addClass.mutateAsync({
        student_id: studentId,
        date: nextDate.toISOString(),
        duration_hours: duration,
        price_per_hour: pricePerHour,
        status: "scheduled",
        is_paid: false,
        notes: null,
        cancellation_reason: null,
      });
      playToggleOff();
    },
    [addClass, playToggleOff]
  );

  // ── Filtering ─────────────────────────────────────────────

  const monthLabel = selectedMonth ? format(selectedMonth, "MMMM yyyy", { locale: es }) : "Todo";

  const filteredData = useMemo(() => {
    let data = classes;
    // Month filter (only if a month is selected)
    if (selectedMonth) {
      const ms = startOfMonth(selectedMonth);
      const me = endOfMonth(selectedMonth);
      data = data.filter((c) => {
        const d = new Date(c.date);
        return isWithinInterval(d, { start: ms, end: me });
      });
    }
    if (searchValue) {
      const q = searchValue.toLowerCase();
      data = data.filter(
        (c) =>
          (c.student_name || "").toLowerCase().includes(q) ||
          (c.notes || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") data = data.filter((c) => c.status === statusFilter);
    if (studentFilter !== "all") data = data.filter((c) => c.student_id === studentFilter);
    if (paidFilter !== "all") {
      if (paidFilter === "paid") data = data.filter((c) => c.is_paid);
      if (paidFilter === "unpaid") data = data.filter((c) => !c.is_paid && c.status !== "cancelled");
    }
    return data;
  }, [classes, searchValue, statusFilter, studentFilter, paidFilter, selectedMonth]);

  // ── Dashboard stats (based on filtered data) ──────────────

  const stats = useMemo(() => {
    const completed = filteredData.filter((c) => c.status === "completed");
    const totalEarned = completed.reduce(
      (sum, c) => sum + c.duration_hours * c.price_per_hour,
      0
    );
    const totalPaid = completed
      .filter((c) => c.is_paid)
      .reduce((sum, c) => sum + c.duration_hours * c.price_per_hour, 0);
    const totalPending = completed
      .filter((c) => !c.is_paid)
      .reduce((sum, c) => sum + c.duration_hours * c.price_per_hour, 0);
    const totalHours = completed.reduce((sum, c) => sum + c.duration_hours, 0);
    const scheduledClasses = filteredData.filter((c) => c.status === "scheduled");
    const scheduled = scheduledClasses.length;
    const scheduledValue = scheduledClasses.reduce((sum, c) => sum + c.duration_hours * c.price_per_hour, 0);
    const cancelled = filteredData.filter((c) => c.status === "cancelled").length;
    const grandTotal = totalEarned + scheduledValue;

    return { completed: completed.length, totalEarned, totalPaid, totalPending, totalHours, scheduled, scheduledValue, cancelled, grandTotal };
  }, [filteredData]);

  // ── Student breakdown (class-based, not week-based) ───────

  const studentBreakdown = useMemo(() => {
    if (filteredData.length === 0 || students.length === 0) return [];

    return students.map((student) => {
      const studentClasses = filteredData
        .filter((c) => c.student_id === student.id)
        .sort((a, b) => a.date.localeCompare(b.date));
      const completedClasses = studentClasses.filter((c) => c.status === "completed");
      const totalHours = completedClasses.reduce((s, c) => s + c.duration_hours, 0);
      const totalEarned = completedClasses.reduce((s, c) => s + c.duration_hours * c.price_per_hour, 0);
      const totalPaid = completedClasses.filter((c) => c.is_paid).reduce((s, c) => s + c.duration_hours * c.price_per_hour, 0);
      const totalPending = totalEarned - totalPaid;
      const lastClass = studentClasses[studentClasses.length - 1];
      const pricePerHour = lastClass?.price_per_hour ?? 0;
      const lastDuration = lastClass?.duration_hours ?? 1;

      return {
        student,
        pricePerHour,
        lastDuration,
        totalClasses: completedClasses.length,
        totalHours,
        totalEarned,
        totalPaid,
        totalPending,
        classes: studentClasses,
      };
    }).filter((s) => s.classes.length > 0);
  }, [filteredData, students]);

  // ── Columns ───────────────────────────────────────────────

  const columns = useMemo<ColumnDef<TutoringClass>[]>(
    () => [
      // Date
      {
        accessorKey: "date",
        size: 120,
        header: ({ column }) => (
          <div
            className="flex items-center cursor-pointer hover:bg-muted rounded px-2 py-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-xs font-semibold">Fecha</span>
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </div>
        ),
        cell: ({ row }) => {
          const d = new Date(row.original.date);
          return (
            <div className={cn("font-medium text-sm", isPrivacyMode && "privacy-blur-light")}>
              <InlineDateTimePicker
                value={d}
                onChange={(newDate) => handleInlineUpdate(row.original.id, "date", newDate.toISOString())}
                showTime={true}
              />
            </div>
          );
        },
      },

      // Student (inline-editable dropdown)
      {
        accessorKey: "student_name",
        size: 180,
        header: "Alumno",
        cell: ({ row }) => {
          const name = row.original.student_name || "—";
          const initial = name.charAt(0).toUpperCase();
          const avatarColor = getAvatarColor(name);

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2.5 px-2 py-1 rounded-md transition-all",
                    "hover:bg-muted/80 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                    isPrivacyMode && "privacy-blur"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold select-none flex-shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initial}
                  </div>
                  <span className="text-sm font-medium truncate">{name}</span>
                  <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                {students.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => handleInlineUpdate(row.original.id, "student_id", s.id)}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ backgroundColor: getAvatarColor(s.name) }}
                    >
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    {s.name}
                    {s.id === row.original.student_id && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },

      // Duration (inline-editable dropdown)
      {
        accessorKey: "duration_hours",
        size: 100,
        header: "Duración",
        cell: ({ row }) => {
          const hours = row.original.duration_hours;
          const label = hours === 0.5 ? "30 min" : `${hours}h`;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded-md transition-all hover:bg-muted/80 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[120px]">
                {[0.5, 1, 1.5, 2, 2.5, 3].map((h) => (
                  <DropdownMenuItem
                    key={h}
                    onClick={() => handleInlineUpdate(row.original.id, "duration_hours", h)}
                    className="flex items-center gap-2"
                  >
                    {h === 0.5 ? "30 min" : `${h} hora${h > 1 ? "s" : ""}`}
                    {h === hours && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },

      // Status
      {
        accessorKey: "status",
        size: 130,
        header: "Estado",
        cell: ({ row }) => {
          const status = row.original.status;
          const cfg = statusConfig[status];
          const Icon = cfg.icon;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/80 transition-all cursor-pointer focus:outline-none">
                  <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                  <span className={cn("text-sm font-medium", cfg.color)}>{cfg.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(Object.entries(statusConfig) as [TutoringClass["status"], typeof statusConfig.scheduled][]).map(
                  ([key, val]) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => handleInlineUpdate(row.original.id, "status", key)}
                      className="flex items-center gap-2"
                    >
                      <val.icon className={cn("h-4 w-4", val.color)} />
                      {val.label}
                      {key === status && <Check className="h-4 w-4 ml-auto" />}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },

      // Paid
      {
        accessorKey: "is_paid",
        size: 80,
        header: "Pagado",
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.original.is_paid}
              onCheckedChange={(checked) =>
                handleInlineUpdate(row.original.id, "is_paid", !!checked)
              }
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5"
            />
          </div>
        ),
      },

      // Total
      {
        id: "total",
        size: 130,
        header: ({ column }) => (
          <div className="text-right text-xs font-semibold">Total</div>
        ),
        cell: ({ row }) => {
          const total = row.original.duration_hours * row.original.price_per_hour;
          return (
            <div className={cn("text-right font-semibold font-mono tabular-nums text-sm", isPrivacyMode && "privacy-blur")}>
              <span className={row.original.status === "cancelled" ? "text-muted-foreground line-through" : "text-emerald-500"}>
                {formatCurrency(total)}
              </span>
            </div>
          );
        },
      },

      // Actions
      {
        id: "actions",
        size: 60,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-40 hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDelete(row.original.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isPrivacyMode, handleInlineUpdate, students]
  );

  // ── Table ─────────────────────────────────────────────────

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    initialState: { pagination: { pageSize: 50 } },
    autoResetPageIndex: false,
    getRowId: (row) => row.id,
  });

  // ── Date grouping ─────────────────────────────────────────

  const isDateSorted = sorting.length === 0 || sorting[0].id === "date";

  const groupedRows = useMemo(() => {
    const rows = table.getRowModel().rows;
    if (!isDateSorted) return null;

    const groups: { dayKey: string; rows: typeof rows }[] = [];
    for (const row of rows) {
      const dayKey = format(new Date(row.original.date), "yyyy-MM-dd");
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.dayKey === dayKey) {
        lastGroup.rows.push(row);
      } else {
        groups.push({ dayKey, rows: [row] });
      }
    }
    return groups;
  }, [table.getRowModel().rows, isDateSorted]);

  // ── Render rows helper ────────────────────────────────────

  const renderRow = (row: ReturnType<typeof table.getRowModel>["rows"][0]) => (
    <tr
      key={row.id}
      className="hover:bg-muted/40 transition-colors"
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className="px-4 py-1.5 overflow-hidden"
          style={{ width: cell.column.getSize() }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );

  // ── Render ────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-0.5">Clases</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Trackea tus clases particulares
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2"
              onClick={() => setIsStudentDialogOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Alumno</span>
            </Button>
            <Button
              className="rounded-full h-10 w-10 p-0 md:w-auto md:h-12 md:px-6"
              onClick={() => {
                resetQuickForm();
                setIsQuickAddOpen(true);
              }}
            >
              <Plus className="h-5 w-5 md:mr-2" />
              <span className="hidden md:inline">Agregar</span>
            </Button>
          </div>
        </div>

        {/* Next class indicator */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const upcoming = classes
            .filter((c) => c.status === "scheduled" && new Date(c.date) >= today)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const next = upcoming[0];
          const after = upcoming[1];
          if (!next) return null;
          const nextDate = new Date(next.date);
          const todayStr = format(new Date(), "yyyy-MM-dd");
          const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
          const nextDayStr = format(nextDate, "yyyy-MM-dd");
          const dayLabel = nextDayStr === todayStr ? "Hoy" : nextDayStr === tomorrowStr ? "Mañana" : format(nextDate, "EEEE d", { locale: es });
          const timeLabel = format(nextDate, "HH:mm") !== "00:00" ? ` a las ${format(nextDate, "HH:mm")}` : "";

          return (
            <div className="flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <Clock className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-xs sm:text-sm min-w-0">
                <span className="text-blue-500 font-medium">{dayLabel}{timeLabel}</span>
                <span className="text-muted-foreground">—</span>
                <span className="font-medium truncate">{next.student_name}</span>
                <span className="text-muted-foreground text-[11px] hidden sm:inline">({next.duration_hours}h · {formatCurrency(next.price_per_hour)}/h)</span>
              </div>
              {after && (
                <span className="text-[11px] text-muted-foreground/60 ml-auto hidden md:block flex-shrink-0">
                  luego {after.student_name} · {format(new Date(after.date), "EEE d", { locale: es })}
                </span>
              )}
            </div>
          );
        })()}

        {/* Toolbar — row 1: toggle + search + month */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-border/50 p-0.5 flex-shrink-0">
              <Button
                variant={viewMode === "students" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2.5 sm:px-3 rounded-md gap-1.5"
                onClick={() => setViewMode("students")}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">Alumnos</span>
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2.5 sm:px-3 rounded-md gap-1.5"
                onClick={() => setViewMode("list")}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">Tabla</span>
              </Button>
            </div>

            {/* Month filter */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border/50 px-1 h-9 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={!selectedMonth}
                onClick={() => setSelectedMonth((m) => m ? subMonths(m, 1) : null)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <button
                className={cn(
                  "text-xs font-medium px-1 sm:px-2 capitalize transition-colors min-w-[60px] sm:min-w-[100px] text-center",
                  selectedMonth ? "text-foreground hover:text-muted-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setSelectedMonth((m) => m ? null : new Date())}
                title={selectedMonth ? "Mostrar todo" : "Filtrar por mes"}
              >
                {monthLabel}
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={!selectedMonth}
                onClick={() => setSelectedMonth((m) => m ? addMonths(m, 1) : null)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") e.currentTarget.blur();
                }}
                className="pl-9 w-36 sm:w-56"
              />
              {searchValue && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchValue("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Toolbar — row 2: filters */}
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="scheduled">Agendadas</SelectItem>
                <SelectItem value="completed">Realizadas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={studentFilter} onValueChange={setStudentFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9">
                <SelectValue placeholder="Alumno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={paidFilter} onValueChange={setPaidFilter}>
              <SelectTrigger className="w-full sm:w-[130px] h-9">
                <SelectValue placeholder="Pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagados</SelectItem>
                <SelectItem value="unpaid">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Students View ───────────────────────────────── */}
        {viewMode === "students" && (
          <div className="space-y-2">
            {studentBreakdown.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No hay datos de alumnos aún
              </div>
            ) : (
              <>
                {/* Legend — once at top */}
                <div className="flex items-center gap-4 px-1 pb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/30 ring-1 ring-emerald-500/40" />
                    <span className="text-[10px] text-muted-foreground">Pagada</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/20" />
                    <span className="text-[10px] text-muted-foreground">Realizada</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500/20" />
                    <span className="text-[10px] text-muted-foreground">Agendada</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-muted/50 border border-dashed border-border/40" />
                    <span className="text-[10px] text-muted-foreground">Sin clase</span>
                  </div>
                </div>

                {studentBreakdown.map(({ student, pricePerHour, lastDuration, totalClasses, totalHours, totalEarned, totalPaid, totalPending, classes: studentClasses }) => {
                  const avatarColor = getAvatarColor(student.name);
                  const initial = student.name.charAt(0).toUpperCase();

                  return (
                    <div key={student.id} className="rounded-lg border border-border/50 bg-card px-4 py-3 overflow-hidden">
                      {/* Desktop: single row | Mobile: stacked */}
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                        {/* Avatar + Name */}
                        <div className="flex items-center gap-3 md:w-40 md:flex-shrink-0">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold select-none flex-shrink-0"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0 md:flex-initial">
                            <h3 className="font-semibold text-sm truncate">{student.name}</h3>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {formatCurrency(pricePerHour)}/h · {totalClasses} clase{totalClasses !== 1 ? "s" : ""} · {totalHours}h
                            </p>
                          </div>
                          {/* Totals — mobile only (right side of header) */}
                          <div className={cn("text-right flex-shrink-0 md:hidden", isPrivacyMode && "privacy-blur")}>
                            <p className="text-sm font-bold font-mono tabular-nums text-emerald-500">{formatCurrency(totalEarned)}</p>
                            {totalPending > 0 && (
                              <p className="text-[10px] text-amber-500 font-medium">
                                {formatCurrency(totalPending)} pend.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Class squares */}
                        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto py-0.5">
                          {studentClasses.map((cls) => {
                            const cfg = statusConfig[cls.status];
                            const StatusIcon = cfg.icon;
                            const dateLabel = format(new Date(cls.date), "dd MMM", { locale: es });

                            return (
                              <DropdownMenu key={cls.id}>
                                <DropdownMenuTrigger asChild>
                                  <button className="flex flex-col items-center gap-0.5 min-w-[38px] cursor-pointer focus:outline-none group">
                                    <div className="relative">
                                      <div
                                        className={cn(
                                          "w-7 h-7 rounded-md flex items-center justify-center transition-all group-hover:scale-110",
                                          cfg.bg,
                                          "border",
                                          cfg.border,
                                          cls.is_paid && cls.status === "completed" && "ring-1 ring-emerald-500/30"
                                        )}
                                      >
                                        {cls.status === "completed" && cls.is_paid ? (
                                          <DollarSign className="h-3 w-3 text-emerald-500" />
                                        ) : (
                                          <StatusIcon className={cn("h-3 w-3", cfg.color)} />
                                        )}
                                      </div>
                                      {cls.notes && (
                                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-card" />
                                      )}
                                    </div>
                                    <span className={cn("text-[9px] font-medium leading-none", cfg.color)}>{dateLabel}</span>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center" className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                  {(Object.entries(statusConfig) as [TutoringClass["status"], typeof statusConfig.scheduled][]).map(
                                    ([key, val]) => (
                                      <DropdownMenuItem
                                        key={key}
                                        onClick={() => handleInlineUpdate(cls.id, "status", key)}
                                        className="flex items-center gap-2"
                                      >
                                        <val.icon className={cn("h-3.5 w-3.5", val.color)} />
                                        <span className="text-sm">{val.label}</span>
                                        {key === cls.status && <Check className="h-3.5 w-3.5 ml-auto" />}
                                      </DropdownMenuItem>
                                    )
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleInlineUpdate(cls.id, "is_paid", !cls.is_paid)}
                                    className="flex items-center gap-2"
                                  >
                                    <DollarSign className={cn("h-3.5 w-3.5", cls.is_paid ? "text-emerald-500" : "text-muted-foreground")} />
                                    <span className="text-sm">{cls.is_paid ? "No pagada" : "Pagada"}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {/* Post-it notes */}
                                  <div
                                    className="mx-1.5 my-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15 p-2"
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <StickyNote className="h-3 w-3 text-amber-500/70" />
                                      <span className="text-[10px] font-semibold text-amber-500/70">Notas</span>
                                    </div>
                                    <textarea
                                      className="w-full bg-transparent text-xs font-mono leading-relaxed resize-none placeholder:text-muted-foreground/30 focus:outline-none min-h-[48px] text-foreground/80"
                                      placeholder="Escribe una nota..."
                                      defaultValue={cls.notes || ""}
                                      rows={2}
                                      onBlur={(e) => {
                                        const val = e.target.value.trim();
                                        if (val !== (cls.notes || "")) {
                                          handleInlineUpdate(cls.id, "notes", val || null);
                                        }
                                      }}
                                    />
                                  </div>
                                  <DropdownMenuSeparator />
                                  {/* Date picker */}
                                  <div className="px-1 py-1">
                                    <InlineDateTimePicker
                                      value={new Date(cls.date)}
                                      onChange={(newDate) => handleInlineUpdate(cls.id, "date", newDate.toISOString())}
                                      showTime={true}
                                    />
                                  </div>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleEdit(cls)}
                                    className="flex items-center gap-2"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span className="text-sm">Editar todo</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(cls.id)}
                                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="text-sm">Eliminar</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          })}

                          {/* Quick-add + button */}
                          <button
                            className="flex flex-col items-center gap-0.5 min-w-[38px] cursor-pointer group"
                            onClick={() => {
                              const lastCls = studentClasses[studentClasses.length - 1];
                              handleQuickAddForStudent(student.id, pricePerHour, lastDuration, lastCls?.date || new Date().toISOString());
                            }}
                            title="Agendar clase"
                          >
                            <div className="w-7 h-7 rounded-md border border-dashed border-border/40 flex items-center justify-center transition-all group-hover:border-primary/50 group-hover:bg-primary/5 group-hover:scale-110">
                              <Plus className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-[9px] text-muted-foreground/30 leading-none group-hover:text-primary/60">nueva</span>
                          </button>
                        </div>

                        {/* Totals — desktop only (end of row) */}
                        <div className={cn("text-right flex-shrink-0 pl-3 hidden md:block", isPrivacyMode && "privacy-blur")}>
                          <p className="text-sm font-bold font-mono tabular-nums text-emerald-500">{formatCurrency(totalEarned)}</p>
                          {totalPending > 0 && (
                            <p className="text-[10px] text-amber-500 font-medium">
                              {formatCurrency(totalPending)} pend.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── Mobile Card List ─────────────────────────────── */}
        {viewMode === "list" && (isMobile ? (
          <div className="space-y-1">
            {filteredData.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No se encontraron clases
              </div>
            ) : (
              filteredData.map((cls) => {
                const cfg = statusConfig[cls.status];
                const StatusIcon = cfg.icon;
                const name = cls.student_name || "—";
                const initial = name.charAt(0).toUpperCase();
                const avatarColor = getAvatarColor(name);
                const total = cls.duration_hours * cls.price_per_hour;

                return (
                  <div
                    key={cls.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer",
                      cls.status === "cancelled" && "opacity-60"
                    )}
                    onClick={() => handleEdit(cls)}
                  >
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold select-none flex-shrink-0"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {initial}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{name}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0 rounded-full", cfg.color, cfg.border)}
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{format(new Date(cls.date), "dd MMM", { locale: es })}</span>
                        <span>·</span>
                        <span>{cls.duration_hours}h</span>
                        {cls.is_paid && (
                          <>
                            <span>·</span>
                            <Check className="h-3 w-3 text-emerald-500" />
                          </>
                        )}
                      </div>
                    </div>

                    {/* Total */}
                    <div className={cn("text-right flex-shrink-0", isPrivacyMode && "privacy-blur")}>
                      <span
                        className={cn(
                          "font-semibold font-mono text-sm",
                          cls.status === "cancelled" ? "text-muted-foreground line-through" : "text-emerald-500"
                        )}
                      >
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* ── Desktop Table ─────────────────────────────── */
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-card border-b border-border sticky top-0 z-10 shadow-sm">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left text-xs font-semibold text-foreground"
                          style={{
                            width: header.column.columnDef.size,
                            minWidth: header.column.columnDef.minSize,
                            maxWidth: header.column.columnDef.maxSize,
                          }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-border/50 bg-card">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No se encontraron clases
                      </td>
                    </tr>
                  ) : groupedRows ? (
                    groupedRows.map((group) => (
                      <React.Fragment key={group.dayKey}>
                        <tr>
                          <td
                            colSpan={columns.length}
                            className="px-4 py-0.5 bg-muted/20"
                          >
                            <span className="text-[11px] font-medium text-muted-foreground/70 capitalize">
                              {formatGroupDate(group.dayKey)}
                            </span>
                          </td>
                        </tr>
                        {group.rows.map(renderRow)}
                      </React.Fragment>
                    ))
                  ) : (
                    table.getRowModel().rows.map(renderRow)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Pagination */}
        {viewMode === "list" && table.getPageCount() > 1 && (
          <div className="flex items-center justify-between px-2">
            <p className="text-xs text-muted-foreground">
              {filteredData.length} clase{filteredData.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="h-8 w-8 p-0">
                <ChevronDoubleLeftIcon className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-8 px-3">
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-8 px-3">
                Siguiente
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="h-8 w-8 p-0">
                <ChevronDoubleRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Dashboard Summary ─────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <Card className="rounded-xl border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <GraduationCap className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">Clases</span>
              </div>
              <p className="text-xl font-bold">{stats.completed}</p>
              {stats.scheduled > 0 && (
                <p className="text-[10px] text-blue-500 mt-0.5">{stats.scheduled} agendada{stats.scheduled > 1 ? "s" : ""}</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">Horas</span>
              </div>
              <p className="text-xl font-bold">{stats.totalHours}h</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <CircleDollarSign className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">Cobrado</span>
              </div>
              <p className={cn("text-xl font-bold text-emerald-500", isPrivacyMode && "privacy-blur")}>
                {formatCurrency(stats.totalPaid)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">Por cobrar</span>
              </div>
              <p className={cn("text-xl font-bold", stats.totalPending > 0 ? "text-amber-500" : "text-muted-foreground", isPrivacyMode && "privacy-blur")}>
                {formatCurrency(stats.totalPending)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">Por ganar</span>
              </div>
              <p className={cn("text-xl font-bold text-blue-500", isPrivacyMode && "privacy-blur")}>
                {formatCurrency(stats.scheduledValue)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">Total</span>
              </div>
              <p className={cn("text-xl font-bold", isPrivacyMode && "privacy-blur")}>
                {formatCurrency(stats.grandTotal)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Agregar clase (rápido) ───────────────────────── */}
      <ClassComposer
        open={isQuickAddOpen}
        onOpenChange={setIsQuickAddOpen}
        form={quickForm}
        onChange={(values) => setQuickForm((previous) => ({ ...previous, ...values }))}
        students={students}
        mode="quick"
        editing={false}
        pending={addClass.isPending}
        onSubmit={handleQuickSubmit}
        onNewStudent={() => setIsStudentDialogOpen(true)}
        isPrivacyMode={isPrivacyMode}
      />

      {/* ── Editar clase ─────────────────────────────────── */}
      <ClassComposer
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setEditingClass(null);
            resetForm();
          }
        }}
        form={formData}
        onChange={(values) => setFormData((previous) => ({ ...previous, ...values }))}
        students={students}
        mode="edit"
        editing={!!editingClass}
        pending={addClass.isPending || updateClass.isPending}
        onSubmit={handleSubmit}
        isPrivacyMode={isPrivacyMode}
      />

      {/* ── Nuevo alumno ─────────────────────────────────── */}
      <StudentComposer
        open={isStudentDialogOpen}
        onOpenChange={setIsStudentDialogOpen}
        name={newStudentName}
        onName={setNewStudentName}
        students={students}
        pending={addStudent.isPending}
        onSubmit={handleAddStudent}
        onDelete={(id) => deleteStudent.mutate(id)}
      />

      {/* ── Confirm Delete ───────────────────────────────── */}
      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: null })}
        onConfirm={confirmDeleteAction}
        title="¿Eliminar clase?"
        description="Esta acción no se puede deshacer. La clase será eliminada permanentemente."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </Layout>
  );
}
