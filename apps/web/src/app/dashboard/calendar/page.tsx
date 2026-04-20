"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, Clock, Pencil,
} from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  color?: string;
  assigneeIds: string[];
}

interface FamilyMember { id: string; name: string; color: string }

const EVENT_TYPES = [
  { value: "appointment", label: "Cita" },
  { value: "task",        label: "Tarea" },
  { value: "reminder",    label: "Recordatorio" },
  { value: "birthday",    label: "Cumpleaños" },
  { value: "other",       label: "Otro" },
] as const;

const TYPE_COLORS: Record<string, string> = {
  appointment: "#6366f1",
  task:        "#10b981",
  reminder:    "#f59e0b",
  birthday:    "#ec4899",
  other:       "#6b7280",
};

type FormMode = "hidden" | "create" | "edit";

const EMPTY_FORM = { title: "", type: "appointment", allDay: true, startTime: "09:00", endTime: "10:00", assigneeIds: [] as string[] };

// ── Página ─────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [members, setMembers] = useState<FamilyMember[]>([]);

  // Form
  const [formMode, setFormMode] = useState<FormMode>("hidden");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState(EMPTY_FORM.title);
  const [type, setType] = useState(EMPTY_FORM.type);
  const [allDay, setAllDay] = useState(EMPTY_FORM.allDay);
  const [startTime, setStartTime] = useState(EMPTY_FORM.startTime);
  const [endTime, setEndTime] = useState(EMPTY_FORM.endTime);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadEvents = async (date: Date) => {
    const from = startOfMonth(date).toISOString();
    const to   = endOfMonth(date).toISOString();
    try {
      const data = await api.get<CalendarEvent[]>(`/calendar?from=${from}&to=${to}`);
      setEvents(data);
    } catch {}
  };

  useEffect(() => { loadEvents(currentDate); }, [currentDate]);
  useEffect(() => { api.get<FamilyMember[]>("/users").then(setMembers).catch(() => {}); }, []);

  const openCreate = () => {
    setTitle(EMPTY_FORM.title); setType(EMPTY_FORM.type); setAllDay(EMPTY_FORM.allDay);
    setStartTime(EMPTY_FORM.startTime); setEndTime(EMPTY_FORM.endTime); setAssigneeIds([]);
    setEditingId(null);
    setFormMode("create");
  };

  const openEdit = (ev: CalendarEvent) => {
    setTitle(ev.title);
    setType(ev.type);
    setAllDay(ev.allDay);
    setStartTime(ev.allDay ? "09:00" : format(new Date(ev.startDate), "HH:mm"));
    setEndTime(ev.endDate && !ev.allDay ? format(new Date(ev.endDate), "HH:mm") : "10:00");
    setAssigneeIds(ev.assigneeIds ?? []);
    setEditingId(ev.id);
    setFormMode("edit");
  };

  const closeForm = () => { setFormMode("hidden"); setEditingId(null); };

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);

    const dateStr   = format(selectedDay, "yyyy-MM-dd");
    const startDate = allDay ? new Date(`${dateStr}T00:00:00`) : new Date(`${dateStr}T${startTime}:00`);
    const endDate   = allDay ? undefined : new Date(`${dateStr}T${endTime}:00`);

    const payload = {
      title: title.trim(),
      type,
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString(),
      allDay,
      color: TYPE_COLORS[type] ?? "#6366f1",
      assigneeIds,
    };

    try {
      if (formMode === "edit" && editingId) {
        const updated = await api.patch<CalendarEvent>(`/calendar/${editingId}`, payload);
        setEvents((evs) => evs.map((e) => (e.id === editingId ? updated : e)));
      } else {
        const created = await api.post<CalendarEvent>("/calendar", payload);
        setEvents((evs) => [...evs, created]);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    await api.delete(`/calendar/${eventId}`);
    setEvents((evs) => evs.filter((e) => e.id !== eventId));
    if (editingId === eventId) closeForm();
  };

  const toggleAssignee = (id: string) =>
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const firstDayOfWeek = (startOfMonth(currentDate).getDay() + 6) % 7;
  const eventsOnDay = (day: Date) => events.filter((e) => isSameDay(new Date(e.startDate), day));
  const selectedDayEvents = eventsOnDay(selectedDay);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      {/* Cabecera mes */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold capitalize">
          {format(currentDate, "MMMM yyyy", { locale: es })}
        </h1>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setCurrentDate(new Date()); setSelectedDay(new Date()); }}
            className="px-3 py-1 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cabeceras días */}
      <div className="grid grid-cols-7 text-center">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Grid calendario */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
        {days.map((day) => {
          const dayEvents  = eventsOnDay(day);
          const isSelected = isSameDay(day, selectedDay);
          const _isToday   = isToday(day);
          return (
            <button
              key={day.toISOString()}
              onClick={() => { setSelectedDay(day); closeForm(); }}
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors",
                isSelected ? "bg-indigo-600 text-white"
                  : _isToday ? "bg-indigo-50 text-indigo-600"
                  : "hover:bg-muted"
              )}
            >
              {day.getDate()}
              {dayEvents.length > 0 && (
                <div className={cn("w-1 h-1 rounded-full mt-0.5", isSelected ? "bg-white" : "bg-indigo-400")} />
              )}
            </button>
          );
        })}
      </div>

      {/* Día seleccionado */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground capitalize">
            {format(selectedDay, "EEEE, d 'de' MMMM", { locale: es })}
          </h2>
          <button
            onClick={formMode !== "hidden" ? closeForm : openCreate}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
              formMode !== "hidden"
                ? "bg-muted text-foreground"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            )}
          >
            {formMode !== "hidden" ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {formMode !== "hidden" ? "Cancelar" : "Añadir"}
          </button>
        </div>

        {/* Formulario crear / editar */}
        {formMode !== "hidden" && (
          <div className="bg-white rounded-2xl border border-indigo-200 p-4 space-y-4 shadow-sm">
            <p className="text-sm font-semibold text-indigo-700">
              {formMode === "edit" ? "Editar evento" : "Nuevo evento"}
            </p>

            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Título del evento..."
              className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</p>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={cn(
                      "px-3 py-1 text-xs rounded-full border font-medium transition-colors",
                      type === t.value ? "border-transparent text-white" : "border-border text-muted-foreground"
                    )}
                    style={type === t.value ? { backgroundColor: TYPE_COLORS[t.value] } : {}}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setAllDay((v) => !v)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                  allDay ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "border-border text-muted-foreground"
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                {allDay ? "Todo el día" : "Con hora"}
              </button>
              {!allDay && (
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <span className="text-muted-foreground">→</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              )}
            </div>

            {members.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Participantes</p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => toggleAssignee(m.id)}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors",
                        assigneeIds.includes(m.id)
                          ? "border-transparent text-white"
                          : "border-border text-muted-foreground"
                      )}
                      style={assigneeIds.includes(m.id) ? { backgroundColor: m.color } : {}}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!title.trim() || saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Guardando..." : formMode === "edit" ? "Guardar cambios" : "Crear evento"}
              </button>
              {formMode === "edit" && editingId && (
                <button
                  onClick={() => handleDelete(editingId)}
                  className="p-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lista de eventos del día */}
        {selectedDayEvents.length === 0 && formMode === "hidden" ? (
          <p className="text-center py-4 text-muted-foreground text-sm">No hay eventos este día</p>
        ) : (
          <div className="space-y-2">
            {selectedDayEvents.map((event) => {
              const eventMembers = members.filter((m) => event.assigneeIds.includes(m.id));
              const isEditing    = editingId === event.id;
              return (
                <div
                  key={event.id}
                  className={cn(
                    "flex items-center gap-3 p-3 bg-white rounded-xl border transition-colors",
                    isEditing ? "border-indigo-300 shadow-sm" : "border-border"
                  )}
                >
                  <div
                    className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: event.color ?? TYPE_COLORS[event.type] ?? "#6366f1" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{event.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-muted-foreground capitalize">
                        {EVENT_TYPES.find((t) => t.value === event.type)?.label ?? event.type}
                        {!event.allDay && ` · ${format(new Date(event.startDate), "HH:mm")}`}
                        {!event.allDay && event.endDate && ` – ${format(new Date(event.endDate), "HH:mm")}`}
                      </p>
                      {eventMembers.map((m) => (
                        <span
                          key={m.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: m.color }}
                        >
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => isEditing ? closeForm() : openEdit(event)}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        isEditing
                          ? "bg-indigo-100 text-indigo-600"
                          : "text-muted-foreground hover:bg-indigo-50 hover:text-indigo-500"
                      )}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
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
    </div>
  );
}
