"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import {
  Plus, CheckCircle2, Circle, Trash2, ChevronDown,
  Repeat2, User, Calendar, X, ChevronRight, Pencil, Tag, Copy,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Tipos ─────────────────────────────────────────────────────────

type RecurrenceType = "daily" | "weekly_window" | "every_n_days" | "weekly" | "monthly" | "yearly";

interface RecurrenceRule {
  type: RecurrenceType;
  interval?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  month?: number;
}

interface TaskCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  visibility: string;
  ownerId: string;
  assigneeId?: string;
  dueDate?: string;
  recurrence?: RecurrenceRule;
  categoryId?: string;
}

interface FamilyMember { id: string; name: string; color: string }

export interface TaskFormValues {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  visibility: "personal" | "shared";
  assigneeId?: string;
  dueDate: string;
  recurrence: RecurrenceRule | null;
  categoryId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const priorityColors: Record<string, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};
const priorityLabel: Record<string, string> = {
  low: "Baja", medium: "Media", high: "Alta",
};

const DEFAULT_CATEGORY_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
];

function recurrenceLabel(r: RecurrenceRule): string {
  switch (r.type) {
    case "daily": return "Cada día";
    case "weekly_window": return "Cada semana";
    case "every_n_days": return `Cada ${r.interval ?? 2} días`;
    case "weekly": return `Cada ${DAYS_ES[r.dayOfWeek ?? 0]}`;
    case "monthly": return `Día ${r.dayOfMonth ?? 1} cada mes`;
    case "yearly": return `${r.dayOfMonth ?? 1} de ${MONTHS_ES[(r.month ?? 1) - 1]} cada año`;
  }
}

function taskToForm(t: Task): TaskFormValues {
  return {
    title: t.title,
    description: t.description ?? "",
    priority: t.priority as TaskFormValues["priority"],
    visibility: t.visibility as TaskFormValues["visibility"],
    assigneeId: t.assigneeId,
    dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
    recurrence: t.recurrence ?? null,
    categoryId: t.categoryId,
  };
}

const EMPTY_FORM: TaskFormValues = {
  title: "", description: "", priority: "medium", visibility: "personal",
  assigneeId: undefined, dueDate: "", recurrence: null, categoryId: undefined,
};

type SmartFilter = "all" | "mine" | "today" | "overdue" | "family" | "future" | "nodate";

const SMART_FILTERS: { id: SmartFilter; label: string; emoji: string }[] = [
  { id: "all",    label: "Todas",    emoji: "📋" },
  { id: "mine",   label: "Mías",     emoji: "👤" },
  { id: "today",  label: "Hoy",      emoji: "📅" },
  { id: "overdue",label: "Vencidas", emoji: "⚠️" },
  { id: "family", label: "Familia",  emoji: "👨‍👩‍👧" },
  { id: "future", label: "Futuras",  emoji: "🔮" },
  { id: "nodate", label: "Sin fecha", emoji: "∞" },
];

function applySmartFilter(tasks: Task[], smart: SmartFilter, userId: string): Task[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (smart) {
    case "mine":
      return tasks.filter((t) => t.ownerId === userId || t.assigneeId === userId);
    case "today":
      return tasks.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= today && d < tomorrow;
      });
    case "overdue":
      return tasks.filter((t) => {
        if (!t.dueDate || t.status === "done") return false;
        return new Date(t.dueDate) < today;
      });
    case "family":
      return tasks.filter((t) => t.visibility === "shared" || !!t.assigneeId);
    case "future":
      return tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= tomorrow);
    case "nodate":
      return tasks.filter((t) => !t.dueDate);
    default:
      return tasks;
  }
}

// ── Componente principal ──────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all" | "done" | "archived">("pending");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const [formMode, setFormMode] = useState<null | "create" | Task>(null);
  const [formValues, setFormValues] = useState<TaskFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadCategories = () =>
    api.get<TaskCategory[]>("/tasks/categories").then(setCategories).catch(() => {});

  useEffect(() => {
    Promise.all([
      api.get<Task[]>("/tasks").then(setTasks),
      api.get<FamilyMember[]>("/users").then(setMembers).catch(() => {}),
      loadCategories(),
    ]).finally(() => setLoading(false));
  }, []);

  const openCreate = () => { setFormValues(EMPTY_FORM); setFormMode("create"); };
  const openEdit = (task: Task) => { setFormValues(taskToForm(task)); setFormMode(task); };
  const closeForm = () => setFormMode(null);

  const handleSubmit = async () => {
    if (!formValues.title.trim() || saving) return;
    setSaving(true);
    const body = {
      title: formValues.title.trim(),
      description: formValues.description.trim() || undefined,
      priority: formValues.priority,
      visibility: formValues.visibility,
      assigneeId: formValues.assigneeId || undefined,
      dueDate: formValues.dueDate || undefined,
      recurrence: formValues.recurrence || undefined,
      categoryId: formValues.categoryId || undefined,
    };
    try {
      if (formMode === "create") {
        const created = await api.post<Task>("/tasks", body);
        setTasks((t) => [created, ...t]);
      } else if (formMode !== null) {
        const updated = await api.patch<Task>(`/tasks/${(formMode as Task).id}`, body);
        setTasks((t) => t.map((item) => (item.id === updated.id ? updated : item)));
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (task: Task) => {
    const updated = await api.patch<Task>(`/tasks/${task.id}`, {
      status: task.status === "done" ? "pending" : "done",
    });
    setTasks((t) => t.map((item) => (item.id === task.id ? updated : item)));
  };

  const duplicateTask = (task: Task) => {
    setFormValues({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority as TaskFormValues["priority"],
      visibility: task.visibility as TaskFormValues["visibility"],
      assigneeId: task.assigneeId,
      dueDate: "",
      recurrence: task.recurrence ?? null,
      categoryId: task.categoryId,
    });
    setFormMode("create");
  };

  const deleteTask = async (taskId: string) => {
    await api.delete(`/tasks/${taskId}`);
    setTasks((t) => t.filter((item) => item.id !== taskId));
    setArchivedTasks((t) => t.filter((item) => item.id !== taskId));
    if (formMode && formMode !== "create" && (formMode as Task).id === taskId) closeForm();
  };

  const switchFilter = (f: typeof filter) => {
    setFilter(f);
    if (f === "archived" && archivedTasks.length === 0) {
      setArchivedLoading(true);
      api.get<Task[]>("/tasks/archived")
        .then(setArchivedTasks)
        .finally(() => setArchivedLoading(false));
    }
  };

  const filteredTasks = (() => {
    if (filter === "archived") {
      const base = archivedTasks.filter((t) => categoryFilter ? t.categoryId === categoryFilter : true);
      return applySmartFilter(base, smartFilter, user?.id ?? "");
    }
    const base = tasks.filter((t) => {
      const statusOk = filter === "all" ? true : t.status === filter;
      const catOk = categoryFilter ? t.categoryId === categoryFilter : true;
      return statusOk && catOk;
    });
    return applySmartFilter(base, smartFilter, user?.id ?? "");
  })();

  const getMember = (id?: string) => members.find((m) => m.id === id);
  const getCategory = (id?: string) => categories.find((c) => c.id === id);
  const isEditing = formMode !== null && formMode !== "create";

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tareas</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryManager((v) => !v)}
            className={cn(
              "p-2 rounded-xl border transition-colors",
              showCategoryManager
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
            title="Gestionar categorías"
          >
            <Tag className="w-4 h-4" />
          </button>
          {filter !== "archived" && (
            <button
              onClick={formMode ? closeForm : openCreate}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                formMode ? "bg-muted text-foreground" : "bg-indigo-600 text-white hover:bg-indigo-700"
              )}
            >
              {formMode ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {formMode ? "Cancelar" : "Nueva tarea"}
            </button>
          )}
        </div>
      </div>

      {/* Gestor de categorías */}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onCreated={(cat) => setCategories((c) => [...c, cat])}
          onDeleted={(id) => {
            setCategories((c) => c.filter((cat) => cat.id !== id));
            if (categoryFilter === id) setCategoryFilter(null);
          }}
        />
      )}

      {/* Formulario crear / editar */}
      {formMode !== null && filter !== "archived" && (
        <TaskForm
          values={formValues}
          onChange={setFormValues}
          members={members}
          categories={categories}
          onSubmit={handleSubmit}
          saving={saving}
          isEditing={isEditing}
        />
      )}

      {/* Filtros de estado */}
      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {(["pending", "all", "done", "archived"] as const).map((f) => (
          <button
            key={f}
            onClick={() => switchFilter(f)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors",
              filter === f ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
            )}
          >
            {f === "pending" ? "Pendientes" : f === "all" ? "Todas" : f === "done" ? "Hechas" : "Archivadas"}
          </button>
        ))}
      </div>

      {/* Smart filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {SMART_FILTERS.map((sf) => (
          <button
            key={sf.id}
            onClick={() => setSmartFilter(sf.id)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0",
              smartFilter === sf.id
                ? "bg-indigo-600 text-white border-transparent"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <span>{sf.emoji}</span>
            {sf.label}
          </button>
        ))}
      </div>

      {/* Filtros de categoría */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setCategoryFilter(null)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              !categoryFilter
                ? "bg-indigo-600 text-white border-transparent"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
              className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                categoryFilter === cat.id
                  ? "text-white border-transparent"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
              style={categoryFilter === cat.id ? { backgroundColor: cat.color || "#6366f1" } : {}}
            >
              {cat.icon && <span>{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : (archivedLoading) ? (
        <div className="text-center py-8 text-muted-foreground">Cargando archivadas...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {filter === "pending" ? "No hay tareas pendientes 🎉"
            : filter === "archived" ? "No hay tareas archivadas"
            : "No hay tareas"}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const assignee = getMember(task.assigneeId);
            const category = getCategory(task.categoryId);
            const isDone = task.status === "done";
            const isBeingEdited = isEditing && (formMode as Task).id === task.id;
            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-start gap-3 p-3 bg-white rounded-xl border transition-colors",
                  isBeingEdited ? "border-indigo-300 ring-1 ring-indigo-200" : "border-border"
                )}
              >
                {/* Check */}
                <button onClick={() => toggleTask(task)} className="shrink-0 mt-0.5">
                  {isDone
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : <Circle className="w-5 h-5 text-muted-foreground" />}
                </button>

                {/* Contenido */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className={cn("text-sm font-medium", isDone && "line-through text-muted-foreground")}>
                    {task.title}
                  </p>
                  {task.description && (
                    <div className="prose prose-xs max-w-none text-muted-foreground [&>*]:text-xs [&>*]:leading-snug [&>ul]:pl-4 [&>ol]:pl-4 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_a]:text-indigo-600 [&_strong]:text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {task.description}
                      </ReactMarkdown>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", priorityColors[task.priority])}>
                      {priorityLabel[task.priority]}
                    </span>
                    {category && (
                      <span
                        className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: category.color || "#6366f1" }}
                      >
                        {category.icon && <span className="text-[10px]">{category.icon}</span>}
                        {category.name}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(task.dueDate), "d MMM", { locale: es })}
                      </span>
                    )}
                    {assignee && (
                      <span
                        className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: assignee.color }}
                      >
                        <User className="w-2.5 h-2.5" />
                        {assignee.name}
                      </span>
                    )}
                    {task.recurrence && (
                      <span className="flex items-center gap-0.5 text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                        <Repeat2 className="w-3 h-3" />
                        {recurrenceLabel(task.recurrence)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => isBeingEdited ? closeForm() : openEdit(task)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      isBeingEdited
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600"
                    )}
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => duplicateTask(task)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    title="Duplicar"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Gestor de categorías ──────────────────────────────────────────

function CategoryManager({
  categories,
  onCreated,
  onDeleted,
}: {
  categories: TaskCategory[];
  onCreated: (cat: TaskCategory) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const cat = await api.post<TaskCategory>("/tasks/categories", {
        name: name.trim(),
        icon: icon.trim() || undefined,
        color,
      });
      onCreated(cat);
      setName("");
      setIcon("");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/tasks/categories/${id}`);
    onDeleted(id);
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Gestionar categorías</p>

      {/* Categorías existentes */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs text-white font-medium"
              style={{ backgroundColor: cat.color || "#6366f1" }}
            >
              {cat.icon && <span>{cat.icon}</span>}
              {cat.name}
              <button
                onClick={() => handleDelete(cat.id)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Crear nueva */}
      <div className="flex gap-2">
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="😀"
          className="w-12 px-2 py-2 rounded-xl border border-border bg-muted/30 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
          maxLength={2}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Nombre de categoría..."
          className="flex-1 px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Colores */}
      <div className="flex gap-1.5 flex-wrap">
        {DEFAULT_CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={cn(
              "w-6 h-6 rounded-full border-2 transition-transform",
              color === c ? "border-gray-800 scale-110" : "border-transparent"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Formulario ────────────────────────────────────────────────────

function TaskForm({
  values,
  onChange,
  members,
  categories,
  onSubmit,
  saving,
  isEditing,
}: {
  values: TaskFormValues;
  onChange: (v: TaskFormValues) => void;
  members: FamilyMember[];
  categories: TaskCategory[];
  onSubmit: () => void;
  saving: boolean;
  isEditing: boolean;
}) {
  const set = <K extends keyof TaskFormValues>(k: K, v: TaskFormValues[K]) =>
    onChange({ ...values, [k]: v });

  return (
    <div className="bg-white rounded-2xl border border-indigo-200 p-4 space-y-4 shadow-sm">
      <p className="text-sm font-semibold text-indigo-700">
        {isEditing ? "Editar tarea" : "Nueva tarea"}
      </p>

      {/* Título */}
      <input
        autoFocus
        value={values.title}
        onChange={(e) => set("title", e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Nombre de la tarea..."
        className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />

      {/* Descripción */}
      <textarea
        value={values.description}
        onChange={(e) => set("description", e.target.value)}
        placeholder="Descripción (opcional)..."
        rows={2}
        className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
      />

      {/* Categoría */}
      {categories.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoría</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => set("categoryId", undefined)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors",
                !values.categoryId ? "bg-muted border-transparent font-medium" : "border-border text-muted-foreground"
              )}
            >
              Sin categoría
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => set("categoryId", values.categoryId === cat.id ? undefined : cat.id)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium",
                  values.categoryId === cat.id
                    ? "text-white border-transparent"
                    : "border-border text-muted-foreground"
                )}
                style={values.categoryId === cat.id ? { backgroundColor: cat.color || "#6366f1" } : {}}
              >
                {cat.icon && <span>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prioridad */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prioridad</p>
        <div className="flex gap-2">
          {(["low", "medium", "high"] as const).map((p) => (
            <button
              key={p}
              onClick={() => set("priority", p)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                values.priority === p
                  ? priorityColors[p] + " border-transparent"
                  : "border-border text-muted-foreground"
              )}
            >
              {priorityLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Visibilidad */}
      <div className="flex gap-2">
        {(["personal", "shared"] as const).map((v) => (
          <button
            key={v}
            onClick={() => set("visibility", v)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors",
              values.visibility === v
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "border-border text-muted-foreground"
            )}
          >
            {v === "personal" ? "Personal" : "Compartida"}
          </button>
        ))}
      </div>

      {/* Asignada a */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Asignada a</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => set("assigneeId", undefined)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-lg border transition-colors",
              !values.assigneeId ? "bg-muted border-transparent font-medium" : "border-border text-muted-foreground"
            )}
          >
            Nadie
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => set("assigneeId", values.assigneeId === m.id ? undefined : m.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium",
                values.assigneeId === m.id
                  ? "border-transparent text-white"
                  : "border-border text-muted-foreground"
              )}
              style={values.assigneeId === m.id ? { backgroundColor: m.color } : {}}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Fecha límite */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha límite</p>
        <input
          type="date"
          value={values.dueDate}
          onChange={(e) => set("dueDate", e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Recurrencia */}
      <RecurrencePicker
        value={values.recurrence}
        onChange={(r) => set("recurrence", r)}
      />

      <button
        onClick={onSubmit}
        disabled={!values.title.trim() || saving}
        className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear tarea"}
      </button>
    </div>
  );
}

// ── Selector de recurrencia ───────────────────────────────────────

function RecurrencePicker({
  value,
  onChange,
}: {
  value: RecurrenceRule | null;
  onChange: (r: RecurrenceRule | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RecurrenceType>(value?.type ?? "daily");
  const [interval, setInterval] = useState(value?.interval ?? 2);
  const [dayOfWeek, setDayOfWeek] = useState(value?.dayOfWeek ?? 0);
  const [dayOfMonth, setDayOfMonth] = useState(value?.dayOfMonth ?? 1);
  const [month, setMonth] = useState(value?.month ?? 1);

  useEffect(() => {
    if (value) {
      setType(value.type);
      if (value.interval !== undefined) setInterval(value.interval);
      if (value.dayOfWeek !== undefined) setDayOfWeek(value.dayOfWeek);
      if (value.dayOfMonth !== undefined) setDayOfMonth(value.dayOfMonth);
      if (value.month !== undefined) setMonth(value.month);
    }
  }, [value]);

  const apply = () => {
    const rule: RecurrenceRule = { type };
    if (type === "every_n_days") rule.interval = interval;
    if (type === "weekly") rule.dayOfWeek = dayOfWeek;
    if (type === "monthly") rule.dayOfMonth = dayOfMonth;
    if (type === "yearly") { rule.dayOfMonth = dayOfMonth; rule.month = month; }
    onChange(rule);
    setOpen(false);
  };

  const clear = () => { onChange(null); setOpen(false); };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Repetición</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm hover:bg-muted/50 transition-colors"
      >
        <span className={value ? "text-indigo-600 font-medium" : "text-muted-foreground"}>
          {value ? recurrenceLabel(value) : "Sin repetición"}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-4 shadow-sm">
          <div className="grid grid-cols-1 gap-1.5">
            {([
              ["daily", "Cada día"],
              ["weekly_window", "Cada semana (cualquier día)"],
              ["every_n_days", "Cada X días"],
              ["weekly", "Día concreto de la semana"],
              ["monthly", "Día del mes"],
              ["yearly", "Fecha del año"],
            ] as [RecurrenceType, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                  type === t ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-muted"
                )}
              >
                <ChevronRight className={cn("w-3.5 h-3.5 shrink-0", type === t ? "text-indigo-600" : "text-muted-foreground")} />
                {label}
              </button>
            ))}
          </div>

          {type === "every_n_days" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Cada</span>
              <input type="number" min={2} max={30} value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-16 px-2 py-1.5 rounded-lg border border-border text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <span className="text-sm text-muted-foreground">días</span>
            </div>
          )}

          {type === "weekly" && (
            <div className="flex flex-wrap gap-1.5">
              {DAYS_ES.map((d, i) => (
                <button key={i} onClick={() => setDayOfWeek(i)}
                  className={cn(
                    "w-10 h-10 rounded-full text-xs font-medium transition-colors",
                    dayOfWeek === i ? "bg-indigo-600 text-white" : "bg-muted hover:bg-indigo-50"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {type === "monthly" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Día</span>
              <input type="number" min={1} max={31} value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="w-16 px-2 py-1.5 rounded-lg border border-border text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <span className="text-sm text-muted-foreground">de cada mes</span>
            </div>
          )}

          {type === "yearly" && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">El día</span>
              <input type="number" min={1} max={31} value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="w-16 px-2 py-1.5 rounded-lg border border-border text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <span className="text-sm text-muted-foreground">de</span>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="px-2 py-1.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {MONTHS_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={apply}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Aplicar
            </button>
            {value && (
              <button onClick={clear}
                className="px-4 py-2 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
