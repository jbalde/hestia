"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { ChevronLeft, ChevronRight, Copy, Plus, X, Search, ChefHat } from "lucide-react";
import { startOfWeek, addWeeks, subWeeks, addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────

interface MealEntry {
  id: string;
  weekStart: string;
  dayOfWeek: number;
  mealType: string;
  recipeId: string;
  recipeName: string;
}

interface Recipe {
  id: string;
  name: string;
  difficulty: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  mealTypes: string[];
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
  const [baseDate, setBaseDate]     = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [entries, setEntries]       = useState<MealEntry[]>([]);
  const [recipes, setRecipes]       = useState<Recipe[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [cloning, setCloning]       = useState(false);

  // Picker state
  const [pickerCell, setPickerCell] = useState<{ day: number; meal: string } | null>(null);
  const [pickerPos,  setPickerPos]  = useState<{ top: number; left: number } | null>(null);
  const [search, setSearch]         = useState("");
  const pickerRef   = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const openPicker = useCallback((day: number, meal: string, trigger: HTMLElement) => {
    const rect = trigger.getBoundingClientRect();
    const PICKER_W = 220;
    const PICKER_H = 280; // approximate

    let left = rect.left;
    let top  = rect.bottom + 6;

    // flip horizontally if overflows right edge
    if (left + PICKER_W > window.innerWidth - 8) {
      left = rect.right - PICKER_W;
    }
    // flip vertically if overflows bottom edge
    if (top + PICKER_H > window.innerHeight - 8) {
      top = rect.top - PICKER_H - 6;
    }

    setPickerPos({ top, left });
    setPickerCell({ day, meal });
    setSearch("");
  }, []);

  const weekStart = toWeekStart(baseDate);

  // Week days (Mon–Sun)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(baseDate, i));

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

  // Close picker on outside click or scroll/resize
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerCell(null);
        setSearch("");
      }
    };
    const closeOnScroll = () => { setPickerCell(null); setSearch(""); };
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, []);

  const getEntry = (day: number, meal: string) =>
    entries.find((e) => e.dayOfWeek === day && e.mealType === meal);

  const handleSelect = async (day: number, meal: string, recipe: Recipe) => {
    const existing = getEntry(day, meal);
    const updated  = await api.put<MealEntry>("/menu-plan", {
      weekStart,
      dayOfWeek:  day,
      mealType:   meal,
      recipeId:   recipe.id,
      recipeName: recipe.name,
    });
    setEntries((prev) =>
      existing
        ? prev.map((e) => e.id === existing.id ? updated : e)
        : [...prev, updated]
    );
    setPickerCell(null);
    setSearch("");
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

      {/* ── Grid (scrollable horizontally on mobile) ── */}
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
              {/* Row label */}
              <div className="flex flex-col items-center justify-center py-2 text-center">
                <span className="text-base leading-none">{meal.emoji}</span>
                <span className="text-[10px] font-medium text-muted-foreground mt-0.5">{meal.label}</span>
              </div>

              {/* Cells */}
              {Array.from({ length: 7 }, (_, dayIdx) => {
                const entry = getEntry(dayIdx, meal.value);

                return (
                  <div key={dayIdx}>
                    {entry ? (
                      // Filled cell
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

      {/* ── Recipe picker portal ── */}
      {mounted && pickerCell && pickerPos && createPortal(
        <div
          ref={pickerRef}
          className="fixed z-[9999] bg-white rounded-2xl border border-border shadow-xl overflow-hidden"
          style={{ top: pickerPos.top, left: pickerPos.left, width: 220 }}
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar receta..."
              className="flex-1 text-xs focus:outline-none bg-transparent"
            />
            <button
              onClick={() => { setPickerCell(null); setSearch(""); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Recipe list */}
          <div className="max-h-52 overflow-y-auto">
            {filteredRecipes.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-1 text-muted-foreground">
                <ChefHat className="w-6 h-6 opacity-30" />
                <p className="text-xs">Sin resultados</p>
              </div>
            ) : (
              filteredRecipes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(pickerCell.day, pickerCell.meal, r)}
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
        </div>,
        document.body
      )}
    </div>
  );
}
