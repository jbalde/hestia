"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import {
  CheckSquare, ShoppingCart, ChefHat, Calendar,
  MessageCircle, UtensilsCrossed, Users, Clock, AlertCircle, Sparkles,
  ChevronRight, BarChart2,
} from "lucide-react";
import { format, isToday, isBefore, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────

interface Task {
  id: string; title: string; status: string;
  priority: string; dueDate?: string; assigneeId?: string;
}
interface CalEvent {
  id: string; title: string; type: string;
  startDate: string; endDate?: string; allDay: boolean; color?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-green-100 text-green-700",
};

const quickLinks = [
  { href: "/dashboard/tasks",    label: "Tareas",     icon: CheckSquare,      color: "bg-indigo-50 text-indigo-600",  desc: "Gestiona tus tareas" },
  { href: "/dashboard/shopping", label: "Compra",     icon: ShoppingCart,     color: "bg-pink-50 text-pink-600",      desc: "Lista de la compra" },
  { href: "/dashboard/recipes",  label: "Recetas",    icon: ChefHat,          color: "bg-orange-50 text-orange-600",  desc: "Recetas guardadas" },
  { href: "/dashboard/menu",     label: "Menú",       icon: UtensilsCrossed,  color: "bg-teal-50 text-teal-600",      desc: "Planificación semanal" },
  { href: "/dashboard/calendar", label: "Calendario", icon: Calendar,         color: "bg-green-50 text-green-600",    desc: "Eventos y citas" },
  { href: "/dashboard/chat",     label: "Hestia IA",    icon: MessageCircle,    color: "bg-purple-50 text-purple-600",  desc: "Chatea con IA" },
  { href: "/dashboard/stats",   label: "Estadísticas", icon: BarChart2,         color: "bg-amber-50 text-amber-600",    desc: "Resumen semanal" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

// ── Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [todayEvents,   setTodayEvents]   = useState<CalEvent[]>([]);
  const [dueTasks,      setDueTasks]      = useState<Task[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [loadingToday,  setLoadingToday]  = useState(true);

  useEffect(() => {
    const from = startOfDay(new Date()).toISOString();
    const to   = endOfDay(new Date()).toISOString();

    Promise.all([
      api.get<CalEvent[]>(`/calendar?from=${from}&to=${to}`),
      api.get<Task[]>("/tasks"),
      api.get<any[]>("/users"),
    ]).then(([events, tasks, members]) => {
      setTodayEvents(events);
      // tasks due today or overdue and still pending/in-progress
      const now = endOfDay(new Date());
      setDueTasks(
        tasks.filter(
          (t) =>
            (t.status === "pending" || t.status === "in_progress") &&
            t.dueDate &&
            isBefore(new Date(t.dueDate), now)
        )
      );
      setFamilyMembers(members);
    }).catch(() => {}).finally(() => setLoadingToday(false));
  }, []);

  const askHestia = (q: string) => {
    router.push("/dashboard/chat?q=" + encodeURIComponent(q));
  };

  const hasToday = todayEvents.length > 0 || dueTasks.length > 0;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-8">

      {/* ── Welcome ── */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold">
          {greeting()}, {user?.name} 👋
        </h1>
        <p className="text-muted-foreground mt-1 capitalize">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* ── Today summary ── */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <span className="text-base">📅</span> Hoy
          </h2>
          <button
            onClick={() => askHestia("¿Qué tengo para hoy?")}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Preguntarle a Hestia
          </button>
        </div>

        {loadingToday ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : !hasToday ? (
          <div className="px-4 py-6 text-center space-y-1">
            <p className="text-2xl">🎉</p>
            <p className="text-sm font-medium">¡Día despejado!</p>
            <p className="text-xs text-muted-foreground">No hay eventos ni tareas pendientes para hoy.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">

            {/* Calendar events */}
            {todayEvents.length > 0 && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Eventos
                </p>
                {todayEvents.map((ev) => {
                  const start = new Date(ev.startDate);
                  return (
                    <Link key={ev.id} href="/dashboard/calendar" className="flex items-center gap-3 group">
                      <div
                        className="w-1 self-stretch rounded-full shrink-0"
                        style={{ backgroundColor: ev.color ?? "#6366f1" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-indigo-600 transition-colors">
                          {ev.title}
                        </p>
                        {!ev.allDay && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(start, "HH:mm")}
                            {ev.endDate && ` – ${format(new Date(ev.endDate), "HH:mm")}`}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-indigo-400 transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Due tasks */}
            {dueTasks.length > 0 && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                  Tareas pendientes{dueTasks.some(t => t.dueDate && isBefore(new Date(t.dueDate), startOfDay(new Date()))) ? " / vencidas" : ""}
                </p>
                {dueTasks.map((task) => {
                  const overdue = task.dueDate && isBefore(new Date(task.dueDate), startOfDay(new Date()));
                  return (
                    <Link key={task.id} href="/dashboard/tasks" className="flex items-center gap-3 group">
                      <div className={cn(
                        "w-1 self-stretch rounded-full shrink-0",
                        overdue ? "bg-red-400" : "bg-amber-400"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate group-hover:text-indigo-600 transition-colors",
                          overdue && "text-red-600"
                        )}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.medium
                          )}>
                            {task.priority === "high" ? "Urgente" : task.priority === "low" ? "Baja" : "Media"}
                          </span>
                          {overdue && task.dueDate && (
                            <span className="text-[10px] text-red-500">
                              Venció {format(new Date(task.dueDate), "d MMM", { locale: es })}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-indigo-400 transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ask Hestia quick buttons */}
        <div className="grid grid-cols-2 border-t border-indigo-100">
          <button
            onClick={() => askHestia("¿Qué tengo para hoy?")}
            className="flex items-center justify-center gap-1.5 px-3 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition-colors border-r border-indigo-100"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            ¿Qué tengo hoy?
          </button>
          <button
            onClick={() => askHestia("¿Qué comemos hoy?")}
            className="flex items-center justify-center gap-1.5 px-3 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition-colors"
          >
            <span className="text-sm">🍽️</span>
            ¿Qué comemos hoy?
          </button>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}
                className="flex flex-col gap-2 p-4 rounded-2xl bg-white border border-border hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${link.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{link.label}</p>
                  <p className="text-xs text-muted-foreground">{link.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Family ── */}
      {familyMembers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
            <Users className="w-4 h-4" /> Familia
          </h2>
          <div className="flex gap-3">
            {familyMembers.map((m) => (
              <div key={m.id} className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: m.color }}>
                  {m.name[0]}
                </div>
                <span className="text-xs text-muted-foreground">{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
