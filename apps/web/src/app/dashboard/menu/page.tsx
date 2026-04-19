"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import {
  ChevronLeft, ChevronRight, Copy, Plus, X, Search, ChefHat,
  UtensilsCrossed, CalendarDays, ArrowLeft,
} from "lucide-react";
import { startOfWeek, addWeeks, subWeeks, addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────

interface MealEntry {
  id: string;
  weekStart: string;
  dayOfWeek: number;
  mealType: string;
  entryType: string;
  recipeId: string | null;
  recipeName: string | null;
  linkedCalendarEventId: string | null;
  linkedCalendarEventTitle: string | null;
}

interface Recipe {
  id: string;
  name: string;
  difficulty: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  mealTypes: string[];
}

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  type: string;
}

// ── Constants ──────────────────────────────────────────────────────

const MEAL_TYPES = [
  { value: "breakfast", label: "Desayuno", emoji: "☀️" },
  { value: "lunch",     label: "Comida",   emoji: "🍽️" },
  { value: "dinner",    label: "Cena",     emoji: "🌙" },
];

const DOW_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const DIFF_COLOR: Record<string, string> = {
  easy:   "text-green-600",
  medium: "text-amber-600",
  hard:   "text-red-500",
};

function toWeekStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

// ── Page ──────────────────────────────────────────────────────────

export default function MenuPage() {
  const [baseDate, setBaseDate]       = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [entries, setEntries]         = useState<MealEntry[]>([]);
  const [recipes, setRecipes]         = useState<Recipe[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [cloning, setCloning]         = useState(false);

  // Picker state
  const [pickerCell, setPickerCell]   = useState<{ day: number; meal: string } | null>(null);
  const [pickerPos,  setPickerPos]    = useState<{ top: number; left: number } | null>(null);
  const [pickerMode, setPickerMode]   = useState<"recipe" | "eating_out">("recipe");
  const [search, setSearch]           = useState("");

  // Calendar events for eating_out picker
  const [calendarEvents, setCalendarEvents]   = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents]     = useState(false);

  const pickerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Reset calendar events cache when week changes
  useEffect(() => { setCalendarEvents([]); }, [baseDate]);

  const weekStart = toWeekStart(baseDate);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(baseDate, i));

  const openPicker = useCallback((day: number, meal: string, trigger: HTMLElement) => {
    const rect     = trigger.getBoundingClientRect();
    const PICKER_W = 240;
    const PICKER_H = 300;

    let left = rect.left;
    let top  = rect.bottom + 6;

    if (left + PICKER_W > window.innerWidth - 8) left = rect.right - PICKER_W;
    if (top  + PICKER_H > window.innerHeight - 8) top  = rect.top - PICKER_H - 6;

    setPickerPos({ top, left });
    setPickerCell({ day, meal });
    setSearch("");
    setPickerMode("recipe");
  }, []);

  const closePicker = useCallback(() => {
    setPickerCell(null);
    setSearch("");
    setPickerMode("recipe");
  }, []);

  // Load entries for current week
  useEffect(() => {
    setLoadingWeek(true);
    api.get<MealEntry[]>(`/menu-plan?weekStart=${weekStart}`)
      .then(setEntries)
      .finally(() => setLoadingWeek(false));
  }, [weekStart]);

  // Load recipes once
  useEffect(() => {
    api.get<Recipe[]>("/recipes").then(setRecipes).catch(() => {});
  }, []);

  // Close picker on outside click / scroll / resize
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) closePicker();
    };
    const closeOnMove = () => closePicker();
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeOnMove, true);
    window.addEventListener("resize", closeOnMove);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnMove, true);
      window.removeEventListener("resize", closeOnMove);
    };
  }, [closePicker]);

  const getEntry = (day: number, meal: string) =>
    entries.find((e) => e.dayOfWeek === day && e.mealType === meal);

  const applyEntry = (updated: MealEntry, existing?: MealEntry) => {
    setEntries((prev) =>
      existing
        ? prev.map((e) => e.id === existing.id ? updated : e)
        : [...prev, updated]
    );
    closePicker();
  };

  const handleSelectRecipe = async (day: number, meal: string, recipe: Recipe) => {
    const existing = getEntry(day, meal);
    const updated  = await api.put<MealEntry>("/menu-plan", {
      weekStart,
      dayOfWeek:  day,
      mealType:   meal,
      entryType:  "recipe",
      recipeId:   recipe.id,
      recipeName: recipe.name,
      linkedCalendarEventId:    null,
      linkedCalendarEventTitle: null,
    });
    applyEntry(updated, existing);
  };

  const handleSelectEatingOut = async (
    day: number,
    meal: string,
    eventId?: string,
    eventTitle?: string,
  ) => {
    const existing = getEntry(day, meal);
    const updated  = await api.put<MealEntry>("/menu-plan", {
      weekStart,
      dayOfWeek:                day,
      mealType:                 meal,
      entryType:                "eating_out",
      recipeId:                 null,
      recipeName:               null,
      linkedCalendarEventId:    eventId   ?? null,
      linkedCalendarEventTitle: eventTitle ?? null,
    });
    applyEntry(updated, existing);
  };

  const handleRemove = async (entry: MealEntry) => {
    await api.delete(`/menu-plan/${entry.id}`);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  };

  const handleClone = async () => {
    setCloning(true);
    try {
      const cloned = await api.post<MealEntry[]>("/menu-plan/clone", { weekStart });
      setEntries((prev) => [...prev, ...cloned]);
    } finally { setCloning(false); }
  };

  const switchToEatingOut = async () => {
    setPickerMode("eating_out");
    if (calendarEvents.length === 0) {
      setLoadingEvents(true);
      try {
        const to     = format(addDays(baseDate, 6), "yyyy-MM-dd");
        const events = await api.get<CalendarEvent[]>(`/calendar?from=${weekStart}&to=${to}`);
        setCalendarEvents(events);
      } catch {
        setCalendarEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    }
  };

  const filteredRecipes = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const weekLabel = `${format(baseDate, "d MMM", { locale: es })} – ${format(addDays(baseDate, 6), "d MMM yyyy", { locale: es })}`;

  return (
    <div className="p-4 max-w-full mx-auto space-y-4 pb-8">
      {/* ── Header ── */}
      <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Menú semanal</h1>
        <button onClick={handleClone} disabled={cloning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
          <Copy className="w-4 h-4" />
          {cloning ? "Clonando…" : "Clonar semana anterior"}
        </button>
      </div>

      {/* ── Week navigation ── */}
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <button onClick={() => setBaseDate((d) => subWeeks(d, 1))}
          className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold capitalize">{weekLabel}</p>
        <button onClick={() => setBaseDate((d) => addWeeks(d, 1))}
          className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Grid ── */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div style={{ minWidth: 640 }}>
          {/* Day headers */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
            <div />
            {weekDays.map((day, i) => (
              <div key={i} className={cn(
                "text-center py-1.5 rounded-lg text-xs font-semibold",
                format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
                  ? "bg-indigo-600 text-white"
                  : "bg-muted text-muted-foreground"
              )}>
                <div>{DOW_SHORT[i]}</div>
                <div className="text-[10px] font-normal opacity-80">{format(day, "d")}</div>
              </div>
            ))}
          </div>

          {/* Meal rows */}
          {MEAL_TYPES.map((meal) => (
            <div key={meal.value} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
              <div className="flex flex-col items-center justify-center py-2 text-center">
                <span className="text-base leading-none">{meal.emoji}</span>
                <span className="text-[10px] font-medium text-muted-foreground mt-0.5">{meal.label}</span>
              </div>

              {Array.from({ length: 7 }, (_, dayIdx) => {
                const entry = getEntry(dayIdx, meal.value);
                const isEatingOut = entry?.entryType === "eating_out";

                return (
                  <div key={dayIdx}>
                    {entry ? (
                      isEatingOut ? (
                        // Eating out cell
                        <div className="group relative bg-orange-50 border border-orange-200 rounded-xl p-1.5 min-h-[56px] flex flex-col justify-between">
                          <div className="flex items-center gap-1">
                            <UtensilsCrossed className="w-3 h-3 text-orange-500 shrink-0" />
                            <p className="text-[11px] font-medium leading-tight text-orange-900">
                              Comida fuera
                            </p>
                          </div>
                          {entry.linkedCalendarEventTitle && (
                            <p className="text-[10px] text-orange-500 mt-0.5 line-clamp-1">
                              {entry.linkedCalendarEventTitle}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <button
                              onClick={(e) => openPicker(dayIdx, meal.value, e.currentTarget)}
                              className="text-[9px] text-orange-400 hover:text-orange-600 font-medium transition-colors">
                              cambiar
                            </button>
                            <button onClick={() => handleRemove(entry)}
                              className="p-0.5 rounded text-muted-foreground hover:text-red-500 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Recipe cell
                        <div className="group relative bg-white border border-indigo-200 rounded-xl p-1.5 min-h-[56px] flex flex-col justify-between">
                          <p className="text-[11px] font-medium leading-tight text-indigo-900 line-clamp-2">
                            {entry.recipeName}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <button
                              onClick={(e) => openPicker(dayIdx, meal.value, e.currentTarget)}
                              className="text-[9px] text-indigo-400 hover:text-indigo-600 font-medium transition-colors">
                              cambiar
                            </button>
                            <button onClick={() => handleRemove(entry)}
                              className="p-0.5 rounded text-muted-foreground hover:text-red-500 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      // Empty cell
                      <button
                        onClick={(e) => openPicker(dayIdx, meal.value, e.currentTarget)}
                        className="w-full min-h-[56px] rounded-xl border border-dashed border-border hover:border-indigo-300 hover:bg-indigo-50/50 flex items-center justify-center transition-colors group">
                        <Plus className="w-4 h-4 text-muted-foreground/40 group-hover:text-indigo-400 transition-colors" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {loadingWeek && (
        <p className="text-center text-sm text-muted-foreground">Cargando semana…</p>
      )}

      {/* ── Picker portal ── */}
      {mounted && pickerCell && pickerPos && createPortal(
        <div
          ref={pickerRef}
          className="fixed z-[9999] bg-white rounded-2xl border border-border shadow-xl overflow-hidden"
          style={{ top: pickerPos.top, left: pickerPos.left, width: 240 }}
        >
          {pickerMode === "recipe" ? (
            <>
              {/* Search bar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar receta..."
                  className="flex-1 text-xs focus:outline-none bg-transparent"
                />
                <button onClick={closePicker} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Eating out option */}
              <button
                onClick={switchToEatingOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-orange-50 border-b border-border transition-colors text-left"
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="text-xs font-medium text-orange-700">Comida fuera</span>
              </button>

              {/* Recipe list */}
              <div className="max-h-48 overflow-y-auto">
                {filteredRecipes.length === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-1 text-muted-foreground">
                    <ChefHat className="w-6 h-6 opacity-30" />
                    <p className="text-xs">Sin resultados</p>
                  </div>
                ) : (
                  filteredRecipes.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectRecipe(pickerCell.day, pickerCell.meal, r)}
                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-border last:border-0"
                    >
                      <p className="text-xs font-medium leading-tight line-clamp-1">{r.name}</p>
                      <p className={cn("text-[10px] mt-0.5", DIFF_COLOR[r.difficulty] ?? "text-muted-foreground")}>
                        {r.prepTimeMinutes + r.cookTimeMinutes} min
                      </p>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              {/* Eating out mode header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <button
                  onClick={() => setPickerMode("recipe")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1.5 flex-1">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-orange-700">Comida fuera</span>
                </div>
                <button onClick={closePicker} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Event list */}
              <div className="max-h-56 overflow-y-auto">
                {/* No event option */}
                <button
                  onClick={() => handleSelectEatingOut(pickerCell.day, pickerCell.meal)}
                  className="w-full text-left px-3 py-2.5 hover:bg-orange-50 transition-colors border-b border-border"
                >
                  <p className="text-xs font-medium text-muted-foreground">Sin evento vinculado</p>
                </button>

                {loadingEvents ? (
                  <div className="flex justify-center py-5">
                    <div className="w-4 h-4 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
                  </div>
                ) : calendarEvents.length === 0 ? (
                  <div className="flex flex-col items-center py-5 gap-1 text-muted-foreground">
                    <CalendarDays className="w-6 h-6 opacity-30" />
                    <p className="text-xs">Sin eventos esta semana</p>
                  </div>
                ) : (
                  calendarEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => handleSelectEatingOut(pickerCell.day, pickerCell.meal, ev.id, ev.title)}
                      className="w-full text-left px-3 py-2 hover:bg-orange-50 transition-colors border-b border-border last:border-0"
                    >
                      <p className="text-xs font-medium leading-tight line-clamp-1">{ev.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(ev.startDate), "EEE d MMM", { locale: es })}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
