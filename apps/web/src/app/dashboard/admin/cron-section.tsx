"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Plus, Trash2, Play, FlaskConical, Power, ChevronDown,
  ChevronUp, Clock, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ── Types ─────────────────────────────────────────────────────────

type ScheduleType = "daily" | "weekdays" | "weekend" | "weekly" | "monthly";

interface CronJob {
  id: string;
  name: string;
  prompt: string;
  scheduleType: ScheduleType;
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  targetUserIds: string[];
  enabled: boolean;
  lastRunAt: string | null;
}

interface FamilyMember { id: string; name: string; color: string }

const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  daily:    "Todos los días",
  weekdays: "Entre semana (L–V)",
  weekend:  "Fin de semana",
  weekly:   "Día concreto de la semana",
  monthly:  "Día concreto del mes",
};

const DOW_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function scheduleDescription(job: CronJob): string {
  const time = `${String(job.hour).padStart(2, "0")}:${String(job.minute).padStart(2, "0")}`;
  switch (job.scheduleType) {
    case "daily":    return `Todos los días a las ${time}`;
    case "weekdays": return `L–V a las ${time}`;
    case "weekend":  return `Sáb–Dom a las ${time}`;
    case "weekly":   return `${DOW_LABELS[job.dayOfWeek ?? 0]} a las ${time}`;
    case "monthly":  return `Día ${job.dayOfMonth} de cada mes a las ${time}`;
  }
}

const EMPTY: Omit<CronJob, "id" | "lastRunAt"> = {
  name: "",
  prompt: "",
  scheduleType: "daily",
  hour: 8,
  minute: 0,
  dayOfWeek: 0,
  dayOfMonth: 1,
  targetUserIds: [],
  enabled: true,
};

// ── Main component ─────────────────────────────────────────────────

export function CronSection({ members }: { members: FamilyMember[] }) {
  const [jobs, setJobs]           = useState<CronJob[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState({ ...EMPTY });
  const [saving, setSaving]       = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const [dryResult, setDryResult]   = useState<string | null>(null);
  const [dryLoading, setDryLoading] = useState(false);
  const [dryError, setDryError]     = useState(false);

  useEffect(() => {
    api.get<CronJob[]>("/admin/cron-jobs")
      .then(setJobs)
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY });
    setEditingId(null);
    setShowForm(true);
    setDryResult(null);
  };

  const openEdit = (job: CronJob) => {
    setForm({
      name: job.name, prompt: job.prompt, scheduleType: job.scheduleType,
      hour: job.hour, minute: job.minute,
      dayOfWeek: job.dayOfWeek ?? 0, dayOfMonth: job.dayOfMonth ?? 1,
      targetUserIds: job.targetUserIds, enabled: job.enabled,
    });
    setEditingId(job.id);
    setShowForm(true);
    setDryResult(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.prompt.trim() || form.targetUserIds.length === 0) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await api.put<CronJob>(`/admin/cron-jobs/${editingId}`, form);
        setJobs((j) => j.map((x) => x.id === editingId ? updated : x));
      } else {
        const created = await api.post<CronJob>("/admin/cron-jobs", form);
        setJobs((j) => [...j, created]);
      }
      setShowForm(false);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/admin/cron-jobs/${id}`);
    setJobs((j) => j.filter((x) => x.id !== id));
    if (editingId === id) { setShowForm(false); setEditingId(null); }
  };

  const handleToggle = async (job: CronJob) => {
    const updated = await api.put<CronJob>(`/admin/cron-jobs/${job.id}`, { ...job, enabled: !job.enabled });
    setJobs((j) => j.map((x) => x.id === job.id ? updated : x));
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      await api.post(`/admin/cron-jobs/${id}/run`, {});
    } finally { setRunningId(null); }
  };

  const handleDryTest = async () => {
    if (!form.prompt.trim()) return;
    setDryLoading(true);
    setDryResult(null);
    setDryError(false);
    try {
      const res = await api.post<{ reply: string }>("/admin/cron-jobs/dry-test", { prompt: form.prompt });
      setDryResult(res.reply);
    } catch {
      setDryError(true);
      setDryResult("Error al conectar con el LLM.");
    } finally { setDryLoading(false); }
  };

  const toggleTarget = (id: string) =>
    setForm((f) => ({
      ...f,
      targetUserIds: f.targetUserIds.includes(id)
        ? f.targetUserIds.filter((x) => x !== id)
        : [...f.targetUserIds, id],
    }));

  if (loading) return <div className="text-sm text-muted-foreground py-4 text-center">Cargando…</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Mensajes programados (Telegram)
        </h2>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" /> Nuevo
        </button>
      </div>

      {/* Job list */}
      {jobs.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-4">No hay mensajes programados.</p>
      )}
      <div className="space-y-2">
        {jobs.map((job) => (
          <div key={job.id}
            className={cn(
              "rounded-xl border p-3 transition-colors",
              job.enabled ? "border-border bg-white" : "border-border bg-muted/30"
            )}>
            <div className="flex items-start gap-3">
              {/* Toggle */}
              <button onClick={() => handleToggle(job)}
                className={cn(
                  "mt-0.5 p-1 rounded-lg transition-colors shrink-0",
                  job.enabled ? "text-indigo-600 hover:bg-indigo-50" : "text-muted-foreground hover:bg-muted"
                )}>
                <Power className="w-4 h-4" />
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn("font-medium text-sm", !job.enabled && "text-muted-foreground")}>
                    {job.name}
                  </p>
                  {!job.enabled && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      Pausado
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />{scheduleDescription(job)}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {job.targetUserIds.map((uid) => {
                    const m = members.find((x) => x.id === uid);
                    return m ? (
                      <span key={uid} className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: m.color }}>
                        {m.name}
                      </span>
                    ) : null;
                  })}
                </div>
                {job.lastRunAt && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Último envío: {format(new Date(job.lastRunAt), "d MMM HH:mm", { locale: es })}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleRunNow(job.id)} disabled={runningId === job.id}
                  title="Enviar ahora"
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-50">
                  {runningId === job.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Play className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => openEdit(job)} title="Editar"
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                  {editingId === job.id
                    ? <ChevronUp className="w-3.5 h-3.5" />
                    : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => handleDelete(job.id)} title="Eliminar"
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-4">
          <p className="text-sm font-semibold text-indigo-700">
            {editingId ? "Editar mensaje programado" : "Nuevo mensaje programado"}
          </p>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Resumen diario de tareas"
              className="w-full px-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          {/* Prompt */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prompt</label>
            <textarea rows={3} value={form.prompt}
              onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
              placeholder="Ej: Dame un resumen de las tareas pendientes de hoy para la familia"
              className="w-full px-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>

          {/* Schedule type */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frecuencia</label>
            <select value={form.scheduleType}
              onChange={(e) => setForm((f) => ({ ...f, scheduleType: e.target.value as ScheduleType }))}
              className="w-full px-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {(Object.entries(SCHEDULE_LABELS) as [ScheduleType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Conditional: day of week */}
          {form.scheduleType === "weekly" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Día de la semana</label>
              <div className="flex flex-wrap gap-1.5">
                {DOW_LABELS.map((d, i) => (
                  <button key={i} onClick={() => setForm((f) => ({ ...f, dayOfWeek: i }))}
                    className={cn(
                      "px-3 py-1 text-xs rounded-full border font-medium transition-colors",
                      form.dayOfWeek === i
                        ? "bg-indigo-600 text-white border-transparent"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conditional: day of month */}
          {form.scheduleType === "monthly" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Día del mes</label>
              <input type="number" min={1} max={31} value={form.dayOfMonth}
                onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))}
                className="w-24 px-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          )}

          {/* Time */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hora de envío</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={23} value={form.hour}
                onChange={(e) => setForm((f) => ({ ...f, hour: Number(e.target.value) }))}
                className="w-20 px-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center" />
              <span className="text-muted-foreground font-bold">:</span>
              <input type="number" min={0} max={59} step={5} value={form.minute}
                onChange={(e) => setForm((f) => ({ ...f, minute: Number(e.target.value) }))}
                className="w-20 px-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center" />
            </div>
          </div>

          {/* Target users */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Destinatarios</label>
            <div className="flex gap-2 flex-wrap">
              {members.map((m) => (
                <button key={m.id} onClick={() => toggleTarget(m.id)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors",
                    form.targetUserIds.includes(m.id)
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                  style={form.targetUserIds.includes(m.id) ? { backgroundColor: m.color } : {}}>
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dry-test */}
          <div className="space-y-2">
            <button onClick={handleDryTest} disabled={!form.prompt.trim() || dryLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors disabled:opacity-50">
              {dryLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FlaskConical className="w-3.5 h-3.5" />}
              {dryLoading ? "Consultando LLM…" : "Dry-test (ver respuesta sin enviar)"}
            </button>

            {dryResult !== null && (
              <div className={cn(
                "rounded-xl p-3 text-xs border",
                dryError
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-white border-border text-foreground"
              )}>
                <div className="flex items-center gap-1.5 mb-1.5 font-semibold">
                  {dryError
                    ? <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  {dryError ? "Error" : "Respuesta del LLM"}
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{dryResult}</p>
              </div>
            )}
          </div>

          {/* Save / cancel */}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.prompt.trim() || form.targetUserIds.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {saving ? "Guardando…" : editingId ? "Actualizar" : "Crear"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setDryResult(null); }}
              className="px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
