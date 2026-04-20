"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import {
  ChevronLeft, ChevronRight, Copy, Plus, X, Search, ChefHat,
  UtensilsCrossed, CalendarDays, ArrowLeft, Users,
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
  memberIds: string[];
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

interface FamilyMember {
  id: string;
  name: string;
  color: string;
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

function memberLabel(memberIds: string[], members: FamilyMember[]): string {
  if (!memberIds.length) return "";
  return memberIds
    .map((id) => members.find((m) => m.id === id)?.name ?? "")
    .filter(Boolean)
    .join(", ");
}

// ── Page ──────────────────────────────────────────────────────────

export default function MenuPage() {
  const [baseDate, setBaseDate]       = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [entries, setEntries]         = useState<MealEntry[]>([]);
  const [recipes, setRecipes]         = useState<Recipe[]>([]);
  const [members, setMembers]         = useState<FamilyMember[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [cloning, setCloning]         = useState(false);

  // Picker state
  const [pickerCell, setPickerCell]         = useState<{ day: number; meal: string } | null>(null);
  const [pickerPos,  setPickerPos]          = useState<{ top: number; left: number } | null>(null);
  const [pickerMode, setPickerMode]         = useState<"members" | "recipe" | "eating_out">("members");
  const [pickerMemberIds, setPickerMemberIds] = useState<string[]>([]);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [search, setSearch]                 = useState("");

  // Calendar events for eating_out picker
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents]   = useState(false);

  const pickerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setCalendarEvents([]); }, [baseDate]);

  const weekStart = toWeekStart(baseDate);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(baseDate, i));

  const openPicker = useCallback((
    day: number,
    meal: string,
    trigger: HTMLElement,
    existingEntry?: MealEntry,
  ) => {
    const rect     = trigger.getBoundingClientRect();
    const PICKER_W = 256;
    const PICKER_H = 360;

    let left = rect.left;
    let top  = rect.bottom + 6;

    if (left + PICKER_W > window.innerWidth - 8) left = rect.right - PICKER_W;
    if (top  + PICKER_H > window.innerHeight - 8) top  = rect.top - PICKER_H - 6;
    if (left < 8) left = 8;

    setPickerPos({ top, left });
    setPickerCell({ day, meal });
    setSearch("");

    if (existingEntry) {
      // Editing an existing entry — skip member selection, go straight to recipe
      setPickerMemberIds(existingEntry.memberIds ?? []);
      setEditingEntryId(existingEntry.id);
      setPickerMode("recipe");
    } else {
      // New entry — start at member selection
      setPickerMemberIds([]);
      setEditingEntryId(null);
      setPickerMode("members");
    }
  }, []);

  const closePicker = useCallback(() => {
    setPickerCell(null);
    setSearch("");
    setPickerMode("members");
    setPickerMemberIds([]);
    setEditingEntryId(null);
  }, []);

  // Load entries for current week
  useEffect(() => {
    setLoadingWeek(true);
    api.get<MealEntry[]>(`/menu-plan?weekStart=${weekStart}`)
      .then(setEntries)
      .finally(() => setLoadingWeek(false));
  }, [weekStart]);

  // Load recipes and family members once
  useEffect(() => {
    api.get<Recipe[]>("/recipes").then(setRecipes).catch(() => {});
    api.get<FamilyMember[]>("/users").then(setMembers).catch(() => {});
  }, []);

  // Close picker on outside click / scroll / resize
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) closePicker();
    };
    const closeOnMove = () => closePicker();
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", closeOnMove);
    window.addEventListener("resize", closeOnMove);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", closeOnMove);
      window.removeEventListener("resize", closeOnMove);
    };
  }, [closePicker]);

  const getCellEntries = (day: number, meal: string) =>
    entries.filter((e) => e.dayOfWeek === day && e.mealType === meal);

  const applyEntry = (updated: MealEntry, existingId?: string | null) => {
    setEntries((prev) =>
      existingId
        ? prev.map((e) => e.id === existingId ? updated : e)
        : [...prev, updated]
    );
    closePicker();
  };

  const handleSelectRecipe = async (day: number, meal: string, recipe: Recipe) => {
    const updated = await api.put<MealEntry>("/menu-plan", {
      weekStart,
      dayOfWeek:  day,
      mealType:   meal,
      entryType:  "recipe",
      recipeId:   recipe.id,
      recipeName: recipe.name,
      linkedCalendarEventId:    null,
      linkedCalendarEventTitle: null,
      memberIds:  pickerMemberIds,
    });
    applyEntry(updated, editingEntryId);
  };

  const handleSelectEatingOut = async (
    day: number,
    meal: string,
    eventId?: string,
    eventTitle?: string,
  ) => {
    const updated = await api.put<MealEntry>("/menu-plan", {
      weekStart,
      dayOfWeek:                day,
      mealType:                 meal,
      entryType:                "eating_out",
      recipeId:                 null,
      recipeName:               null,
      linkedCalendarEventId:    eventId   ?? null,
      linkedCalendarEventTitle: eventTitle ?? null,
      memberIds:                pickerMemberIds,
    });
    applyEntry(updated, editingEntryId);
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

  const toggleMember = (id: string) => {
    setPickerMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
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
                const cellEntries = getCellEntries(dayIdx, meal.value);
                return (
                  <div key={dayIdx} className="flex flex-col gap-1">
                    {cellEntries.map((entry) => {
                      const isEatingOut = entry.entryType === "eating_out";
                      const names = memberLabel(entry.memberIds ?? [], members);
                      return isEatingOut ? (
                        <div key={entry.id} className="relative bg-orange-50 border border-orange-200 rounded-xl p-1.5 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <UtensilsCrossed className="w-3 h-3 text-orange-500 shrink-0" />
                            <p className="text-[10px] font-medium text-orange-900 leading-tight flex-1 truncate">
                              Fuera
                            </p>
                            <button onClick={() => handleRemove(entry)}
                              className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          {entry.linkedCalendarEventTitle && (
                            <p className="text-[9px] text-orange-500 truncate">{entry.linkedCalendarEventTitle}</p>
                          )}
                          {names && (
                            <p className="text-[9px] text-orange-400 truncate">{names}</p>
                          )}
                          <button
                            onClick={(e) => openPicker(dayIdx, meal.value, e.currentTarget, entry)}
                            className="text-[9px] text-orange-400 hover:text-orange-600 font-medium text-left transition-colors">
                            cambiar
                          </button>
                        </div>
                      ) : (
                        <div key={entry.id} className="relative bg-white border border-indigo-200 rounded-xl p-1.5 flex flex-col gap-0.5">
                          <div className="flex items-start gap-1">
                            <p className="text-[10px] font-medium leading-tight text-indigo-900 flex-1 line-clamp-2">
                              {entry.recipeName}
                            </p>
                            <button onClick={() => handleRemove(entry)}
                              className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 mt-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          {names && (
                            <p className="text-[9px] text-indigo-400 truncate">{names}</p>
                          )}
                          <button
                            onClick={(e) => openPicker(dayIdx, meal.value, e.currentTarget, entry)}
                            className="text-[9px] text-indigo-400 hover:text-indigo-600 font-medium text-left transition-colors">
                            cambiar
                          </button>
                        </div>
                      );
                    })}

                    {/* Add button */}
                    <button
                      onClick={(e) => openPicker(dayIdx, meal.value, e.currentTarget)}
                      className="w-full min-h-[40px] rounded-xl border border-dashed border-border hover:border-indigo-300 hover:bg-indigo-50/50 flex items-center justify-center transition-colors group">
                      <Plus className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-indigo-400 transition-colors" />
                    </button>
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
          style={{ top: pickerPos.top, left: pickerPos.left, width: 256 }}
        >
          {/* ── Step 1: member selection ── */}
          {pickerMode === "members" && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold flex-1">¿Para quién?</span>
                <button onClick={closePicker} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3 space-y-2">
                {/* "Todos" option */}
                <button
                  onClick={() => setPickerMemberIds([])}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors",
                    pickerMemberIds.length === 0
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="text-base">👨‍👩‍👧</span>
                  Toda la familia
                </button>
                {/* Individual members */}
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMember(m.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors",
                      pickerMemberIds.includes(m.id)
                        ? "border-transparent text-white font-medium"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                    style={pickerMemberIds.includes(m.id) ? { backgroundColor: m.color } : {}}
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: pickerMemberIds.includes(m.id) ? "rgba(255,255,255,0.3)" : m.color }}>
                      {m.name[0]}
                    </span>
                    {m.name}
                  </button>
                ))}
                <button
                  onClick={() => setPickerMode("recipe")}
                  className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors mt-1"
                >
                  Continuar →
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: recipe selection ── */}
          {pickerMode === "recipe" && (
            <>
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <button
                  onClick={() => setPickerMode("members")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
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

              {/* Member summary */}
              {pickerMemberIds.length > 0 && (
                <div className="px-3 py-1.5 bg-indigo-50 border-b border-border flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="text-[10px] text-indigo-600 font-medium truncate">
                    {memberLabel(pickerMemberIds, members)}
                  </span>
                </div>
              )}

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
          )}

          {/* ── Step 2b: eating out ── */}
          {pickerMode === "eating_out" && (
            <>
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

              {pickerMemberIds.length > 0 && (
                <div className="px-3 py-1.5 bg-orange-50 border-b border-border flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-orange-400 shrink-0" />
                  <span className="text-[10px] text-orange-600 font-medium truncate">
                    {memberLabel(pickerMemberIds, members)}
                  </span>
                </div>
              )}

              <div className="max-h-56 overflow-y-auto">
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
