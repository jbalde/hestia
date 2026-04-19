"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, CheckCircle2, ShoppingCart, ChefHat, Calendar, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────

interface Stats {
  tasks: {
    completedThisWeek: number;
    completedLastWeek: number;
    pendingTotal: number;
    byDay: { label: string; count: number }[];
    byPerson: { name: string; color: string; count: number }[];
  };
  recipes: {
    topRecipes: { name: string; count: number }[];
    mealsThisWeek: number;
    eatingOutThisWeek: number;
  };
  shopping: {
    purchasedThisWeek: number;
    purchasedLastWeek: number;
    topItems: { name: string; count: number }[];
  };
  calendar: {
    eventsThisWeek: number;
    eventsByType: { type: string; count: number }[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  appointment: "Citas",
  task:        "Tareas",
  reminder:    "Recordatorios",
  birthday:    "Cumpleaños",
  other:       "Otros",
};

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted-foreground">Sin datos</span>;
  if (previous === 0) return <span className="flex items-center gap-0.5 text-xs text-green-600"><TrendingUp className="w-3 h-3" />Nuevo</span>;
  const diff = current - previous;
  if (diff === 0) return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="w-3 h-3" />Igual que la semana pasada</span>;
  if (diff > 0) return <span className="flex items-center gap-0.5 text-xs text-green-600"><TrendingUp className="w-3 h-3" />+{diff} vs semana pasada</span>;
  return <span className="flex items-center gap-0.5 text-xs text-red-500"><TrendingDown className="w-3 h-3" />{diff} vs semana pasada</span>;
}

function MiniBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color ?? "#6366f1" }}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Stats>("/stats").then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Calculando estadísticas…</span>
      </div>
    );
  }

  if (!stats) return null;

  const { tasks, recipes, shopping, calendar } = stats;
  const maxDayCount = Math.max(...tasks.byDay.map((d) => d.count), 1);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      <h1 className="text-xl font-bold">Estadísticas</h1>
      <p className="text-xs text-muted-foreground -mt-2">Semana actual · datos en tiempo real</p>

      {/* ── Tareas ── */}
      <Section icon={<CheckCircle2 className="w-4 h-4 text-indigo-600" />} title="Tareas" color="bg-indigo-50">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Completadas esta semana" value={tasks.completedThisWeek} highlight />
          <Kpi label="Semana anterior" value={tasks.completedLastWeek} />
          <Kpi label="Pendientes" value={tasks.pendingTotal} />
        </div>

        <Trend current={tasks.completedThisWeek} previous={tasks.completedLastWeek} />

        {/* Gráfico por día */}
        {tasks.completedThisWeek > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Por día esta semana</p>
            {tasks.byDay.map((d) => (
              <div key={d.label} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-7 shrink-0">{d.label}</span>
                <MiniBar value={d.count} max={maxDayCount} />
                <span className="text-xs font-medium w-4 text-right shrink-0">{d.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Por persona */}
        {tasks.byPerson.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Por persona</p>
            {tasks.byPerson.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: p.color }}>
                  {p.name[0]}
                </div>
                <MiniBar value={p.count} max={tasks.completedThisWeek || 1} color={p.color} />
                <span className="text-xs font-medium w-4 text-right shrink-0">{p.count}</span>
              </div>
            ))}
          </div>
        )}

        {tasks.completedThisWeek === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Ninguna tarea completada esta semana aún.</p>
        )}
      </Section>

      {/* ── Recetas ── */}
      <Section icon={<ChefHat className="w-4 h-4 text-orange-600" />} title="Recetas y menú" color="bg-orange-50">
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Comidas en casa esta semana" value={recipes.mealsThisWeek} highlight />
          <Kpi label="Salidas a comer" value={recipes.eatingOutThisWeek} />
        </div>

        {recipes.topRecipes.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Recetas más cocinadas (últimas 8 semanas)</p>
            {recipes.topRecipes.map((r, i) => (
              <div key={r.name} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 shrink-0 text-right">{i + 1}.</span>
                <span className="text-xs flex-1 truncate">{r.name}</span>
                <MiniBar value={r.count} max={recipes.topRecipes[0]?.count ?? 1} color="#f97316" />
                <span className="text-xs font-medium text-muted-foreground shrink-0">{r.count}×</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Aún no hay datos de menú.</p>
        )}
      </Section>

      {/* ── Compra ── */}
      <Section icon={<ShoppingCart className="w-4 h-4 text-pink-600" />} title="Compra" color="bg-pink-50">
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Productos comprados esta semana" value={shopping.purchasedThisWeek} highlight />
          <Kpi label="Semana anterior" value={shopping.purchasedLastWeek} />
        </div>

        <Trend current={shopping.purchasedThisWeek} previous={shopping.purchasedLastWeek} />

        {shopping.topItems.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Productos más comprados (últimas 4 semanas)</p>
            {shopping.topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 shrink-0 text-right">{i + 1}.</span>
                <span className="text-xs flex-1 truncate">{item.name}</span>
                <MiniBar value={item.count} max={shopping.topItems[0]?.count ?? 1} color="#ec4899" />
                <span className="text-xs font-medium text-muted-foreground shrink-0">{item.count}×</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Aún no hay datos de compra.</p>
        )}
      </Section>

      {/* ── Calendario ── */}
      <Section icon={<Calendar className="w-4 h-4 text-green-600" />} title="Calendario" color="bg-green-50">
        <Kpi label="Eventos esta semana" value={calendar.eventsThisWeek} highlight />

        {calendar.eventsByType.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {calendar.eventsByType.map((e) => (
              <span key={e.type} className="text-xs bg-muted px-2 py-1 rounded-full">
                {EVENT_TYPE_LABELS[e.type] ?? e.type}: <strong>{e.count}</strong>
              </span>
            ))}
          </div>
        )}

        {calendar.eventsThisWeek === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Sin eventos esta semana.</p>
        )}
      </Section>
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────

function Section({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className={cn("flex items-center gap-2 px-4 py-3 border-b border-border", color)}>
        {icon}
        <p className="font-semibold text-sm">{title}</p>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl p-3 space-y-0.5", highlight ? "bg-indigo-50" : "bg-muted/40")}>
      <p className={cn("text-2xl font-bold", highlight ? "text-indigo-700" : "text-foreground")}>{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}
