import { useState, useCallback, useMemo } from "react";
import Layout from "@/components/Layout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import {
  useTutoringClasses,
  TutoringClass,
} from "@/hooks/useTutoringClasses";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, addWeeks, isWithinInterval, isSameWeek } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSoundFX } from "@/hooks/useSoundFX";
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from "@heroicons/react/24/outline";

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [studentFilter, setStudentFilter] = useState("all");
  const [paidFilter, setPaidFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  // ── Quick Add form ────────────────────────────────────────

  const [quickForm, setQuickForm] = useState({
    student_id: "",
    date: format(new Date(), "yyyy-MM-dd"),
    duration_hours: "1",
    price_per_hour: "",
    status: "completed" as TutoringClass["status"],
    is_paid: false,
    notes: "",
  });

  // ── Full form (for edit modal) ────────────────────────────

  const [formData, setFormData] = useState({
    student_id: "",
    date: format(new Date(), "yyyy-MM-dd"),
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
      date: format(new Date(), "yyyy-MM-dd"),
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
      date: format(new Date(), "yyyy-MM-dd"),
      duration_hours: "1",
      price_per_hour: "",
      status: "completed",
      is_paid: false,
      notes: "",
    });
  };

  // ── Handlers ──────────────────────────────────────────────

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseInt(quickForm.price_per_hour.replace(/\D/g, ""), 10);
    if (!quickForm.student_id || isNaN(priceNum)) return;

    await addClass.mutateAsync({
      student_id: quickForm.student_id,
      date: quickForm.date,
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
      date: formData.date,
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
      date: cls.date,
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

  // ── Filtering ─────────────────────────────────────────────

  const filteredData = useMemo(() => {
    let data = classes;
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
  }, [classes, searchValue, statusFilter, studentFilter, paidFilter]);

  // ── Dashboard stats (current month) ───────────────────────

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const thisMonth = classes.filter((c) => {
      const d = new Date(c.date);
      return isWithinInterval(d, { start: monthStart, end: monthEnd });
    });

    const completed = thisMonth.filter((c) => c.status === "completed");
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
    const scheduled = thisMonth.filter((c) => c.status === "scheduled").length;
    const cancelled = thisMonth.filter((c) => c.status === "cancelled").length;

    return { completed: completed.length, totalEarned, totalPaid, totalPending, totalHours, scheduled, cancelled };
  }, [classes]);

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
          const d = new Date(row.original.date + "T12:00:00");
          return (
            <span className={cn("text-sm font-medium", isPrivacyMode && "privacy-blur-light")}>
              {format(d, "dd MMM yyyy", { locale: es })}
            </span>
          );
        },
      },

      // Student
      {
        accessorKey: "student_name",
        size: 180,
        header: "Alumno",
        cell: ({ row }) => {
          const name = row.original.student_name || "—";
          const initial = name.charAt(0).toUpperCase();
          const avatarColor = getAvatarColor(name);

          return (
            <div className={cn("flex items-center gap-2.5", isPrivacyMode && "privacy-blur")}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold select-none flex-shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                {initial}
              </div>
              <span className="text-sm font-medium truncate">{name}</span>
            </div>
          );
        },
      },

      // Duration
      {
        accessorKey: "duration_hours",
        size: 90,
        header: "Duración",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.duration_hours}h
          </span>
        ),
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
      const dayKey = row.original.date;
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
      className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => handleEdit(row.original)}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className="px-3 py-2.5"
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Mis Clases</h1>
            <p className="text-sm text-muted-foreground">
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
              className="rounded-full h-12 w-12 p-0 md:w-auto md:px-6"
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

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9 w-48 sm:w-64"
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

          <div className="flex-1" />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
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
            <SelectTrigger className="w-[150px]">
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
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Pago" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="paid">Pagados</SelectItem>
              <SelectItem value="unpaid">Pendientes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Mobile Card List ─────────────────────────────── */}
        {isMobile ? (
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
                        <span>{format(new Date(cls.date + "T12:00:00"), "dd MMM", { locale: es })}</span>
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
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b bg-muted/30">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-3 py-2.5 text-left"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center text-sm text-muted-foreground">
                      No se encontraron clases
                    </td>
                  </tr>
                ) : groupedRows ? (
                  groupedRows.map((group) => (
                    <tbody key={group.dayKey}>
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/20 capitalize"
                        >
                          {formatGroupDate(group.dayKey)}
                        </td>
                      </tr>
                      {group.rows.map(renderRow)}
                    </tbody>
                  ))
                ) : (
                  table.getRowModel().rows.map(renderRow)
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {table.getPageCount() > 1 && (
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="rounded-xl border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <GraduationCap className="h-4 w-4" />
                <span className="text-xs font-medium">Clases este mes</span>
              </div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              {stats.scheduled > 0 && (
                <p className="text-xs text-blue-500 mt-0.5">{stats.scheduled} agendada{stats.scheduled > 1 ? "s" : ""}</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Horas este mes</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalHours}h</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CircleDollarSign className="h-4 w-4" />
                <span className="text-xs font-medium">Cobrado</span>
              </div>
              <p className={cn("text-2xl font-bold text-emerald-500", isPrivacyMode && "privacy-blur")}>
                {formatCurrency(stats.totalPaid)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Por cobrar</span>
              </div>
              <p className={cn("text-2xl font-bold", stats.totalPending > 0 ? "text-amber-500" : "text-muted-foreground", isPrivacyMode && "privacy-blur")}>
                {formatCurrency(stats.totalPending)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Quick Add Modal ──────────────────────────────── */}
      <BaseModal
        open={isQuickAddOpen}
        onOpenChange={setIsQuickAddOpen}
        title="Agregar Clase"
        description="Registra una clase rápidamente"
        maxWidth="md"
      >
        <form onSubmit={handleQuickSubmit} className="space-y-4">
          {/* Student select */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Alumno</Label>
            <div className="flex gap-2">
              <Select value={quickForm.student_id} onValueChange={(v) => setQuickForm({ ...quickForm, student_id: v })}>
                <SelectTrigger className="h-10 rounded-xl flex-1">
                  <SelectValue placeholder="Selecciona alumno" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl flex-shrink-0"
                onClick={() => setIsStudentDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Date + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fecha</Label>
              <Input
                type="date"
                value={quickForm.date}
                onChange={(e) => setQuickForm({ ...quickForm, date: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Duración</Label>
              <Select value={quickForm.duration_hours} onValueChange={(v) => setQuickForm({ ...quickForm, duration_hours: v })}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">30 min</SelectItem>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="1.5">1.5 horas</SelectItem>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="2.5">2.5 horas</SelectItem>
                  <SelectItem value="3">3 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price per hour */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Precio por hora</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={quickForm.price_per_hour ? parseInt(quickForm.price_per_hour).toLocaleString("es-CL") : ""}
                onChange={(e) => {
                  const number = e.target.value.replace(/\D/g, "");
                  setQuickForm({ ...quickForm, price_per_hour: number });
                }}
                className="h-10 rounded-xl pl-8"
              />
            </div>
            {quickForm.price_per_hour && quickForm.duration_hours && (
              <p className="text-xs text-muted-foreground">
                Total: {formatCurrency(parseInt(quickForm.price_per_hour.replace(/\D/g, ""), 10) * parseFloat(quickForm.duration_hours))}
              </p>
            )}
          </div>

          {/* Status + Paid row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-input hover:border-primary/50 transition-colors flex-1">
              <Checkbox
                id="quick-completed"
                checked={quickForm.status === "completed"}
                onCheckedChange={(checked) =>
                  setQuickForm({ ...quickForm, status: checked ? "completed" : "scheduled" })
                }
              />
              <label htmlFor="quick-completed" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <CircleCheckBig className="h-4 w-4 text-emerald-500" />
                Ya realizada
              </label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-input hover:border-primary/50 transition-colors flex-1">
              <Checkbox
                id="quick-paid"
                checked={quickForm.is_paid}
                onCheckedChange={(checked) => setQuickForm({ ...quickForm, is_paid: !!checked })}
              />
              <label htmlFor="quick-paid" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Ya pagada
              </label>
            </div>
          </div>

          {/* Notes */}
          <Input
            placeholder="Notas (opcional)"
            value={quickForm.notes}
            onChange={(e) => setQuickForm({ ...quickForm, notes: e.target.value })}
            className="h-10 rounded-xl"
          />

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-2xl bg-emerald-500 hover:bg-emerald-600"
            disabled={!quickForm.student_id || !quickForm.price_per_hour || addClass.isPending}
          >
            {addClass.isPending ? "Guardando..." : "Agregar Clase"}
          </Button>
        </form>
      </BaseModal>

      {/* ── Edit Modal ───────────────────────────────────── */}
      <BaseModal
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setEditingClass(null);
            resetForm();
          }
        }}
        title={editingClass ? "Editar Clase" : "Agregar Clase"}
        maxWidth="lg"
        footer={
          <Button
            type="submit"
            form="class-form"
            className="w-full"
            disabled={addClass.isPending || updateClass.isPending}
          >
            {editingClass ? "Guardar Cambios" : "Agregar"}
          </Button>
        }
      >
        <form id="class-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Alumno</Label>
            <Select value={formData.student_id} onValueChange={(v) => setFormData({ ...formData, student_id: v })}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Selecciona alumno" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fecha</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Duración</Label>
              <Select value={formData.duration_hours} onValueChange={(v) => setFormData({ ...formData, duration_hours: v })}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">30 min</SelectItem>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="1.5">1.5 horas</SelectItem>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="2.5">2.5 horas</SelectItem>
                  <SelectItem value="3">3 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Precio por hora</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={formData.price_per_hour ? parseInt(formData.price_per_hour).toLocaleString("es-CL") : ""}
                onChange={(e) => {
                  const number = e.target.value.replace(/\D/g, "");
                  setFormData({ ...formData, price_per_hour: number });
                }}
                className="h-10 rounded-xl pl-8"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Estado</Label>
            <Select value={formData.status} onValueChange={(v: TutoringClass["status"]) => setFormData({ ...formData, status: v })}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Agendada</SelectItem>
                <SelectItem value="completed">Realizada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.status === "cancelled" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Razón de cancelación</Label>
              <Input
                placeholder="¿Por qué se canceló?"
                value={formData.cancellation_reason}
                onChange={(e) => setFormData({ ...formData, cancellation_reason: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
          )}

          <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-input hover:border-primary/50 transition-colors">
            <Checkbox
              id="form-paid"
              checked={formData.is_paid}
              onCheckedChange={(checked) => setFormData({ ...formData, is_paid: !!checked })}
            />
            <label htmlFor="form-paid" className="text-sm font-medium cursor-pointer flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Pagada
            </label>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Notas</Label>
            <Input
              placeholder="Notas opcionales..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="h-10 rounded-xl"
            />
          </div>
        </form>
      </BaseModal>

      {/* ── Add Student Modal ────────────────────────────── */}
      <BaseModal
        open={isStudentDialogOpen}
        onOpenChange={setIsStudentDialogOpen}
        title="Nuevo Alumno"
        maxWidth="sm"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          <Input
            placeholder="Nombre del alumno"
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            className="h-10 rounded-xl"
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={!newStudentName.trim() || addStudent.isPending}>
            {addStudent.isPending ? "Guardando..." : "Agregar Alumno"}
          </Button>

          {/* Existing students list */}
          {students.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground font-medium">Alumnos existentes</p>
              {students.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: getAvatarColor(s.name) }}
                    >
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{s.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteStudent.mutate(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </form>
      </BaseModal>

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
