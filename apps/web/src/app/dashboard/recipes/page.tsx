"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Clock, Users, ChefHat, Trash2, X, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────

interface Ingredient { name: string; quantity: string; unit: string }

interface Recipe {
  id: string;
  name: string;
  description?: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: string;
  mealTypes: string[];
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
}

// ── Constants ──────────────────────────────────────────────────────

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  hard:   "bg-red-100 text-red-700",
};
const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Fácil", medium: "Media", hard: "Difícil",
};

const MEAL_TYPES = [
  { value: "breakfast", label: "Desayuno" },
  { value: "lunch",     label: "Comida" },
  { value: "dinner",    label: "Cena" },
  { value: "snack",     label: "Merienda" },
];

const EMPTY_FORM = {
  name: "",
  description: "",
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  servings: 4,
  difficulty: "easy" as string,
  mealTypes: [] as string[],
  tags: "" ,
  ingredients: [{ name: "", quantity: "", unit: "" }] as Ingredient[],
  steps: [""] as string[],
};

// ── Page ──────────────────────────────────────────────────────────

export default function RecipesPage() {
  const [recipes, setRecipes]     = useState<Recipe[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);

  const load = async (q?: string) => {
    try {
      const path = q ? `/recipes?search=${encodeURIComponent(q)}` : "/recipes";
      setRecipes(await api.get<Recipe[]>(path));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openForm = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const openEdit = (recipe: Recipe) => {
    setForm({
      name:            recipe.name,
      description:     recipe.description ?? "",
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      servings:        recipe.servings,
      difficulty:      recipe.difficulty,
      mealTypes:       recipe.mealTypes,
      tags:            recipe.tags.join(", "),
      ingredients:     recipe.ingredients.length ? recipe.ingredients : [{ name: "", quantity: "", unit: "" }],
      steps:           recipe.steps.length ? recipe.steps : [""],
    });
    setEditingId(recipe.id);
    setExpanded(null);
    setShowForm(true);
  };

  // ── Form helpers ──────────────────────────────────────────────

  const setIngredient = (i: number, field: keyof Ingredient, value: string) =>
    setForm((f) => {
      const ing = [...f.ingredients];
      ing[i] = { ...ing[i], [field]: value };
      return { ...f, ingredients: ing };
    });

  const addIngredient = () =>
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { name: "", quantity: "", unit: "" }] }));

  const removeIngredient = (i: number) =>
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));

  const setStep = (i: number, value: string) =>
    setForm((f) => { const steps = [...f.steps]; steps[i] = value; return { ...f, steps }; });

  const addStep = () => setForm((f) => ({ ...f, steps: [...f.steps, ""] }));
  const removeStep = (i: number) => setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));

  const toggleMealType = (v: string) =>
    setForm((f) => ({
      ...f,
      mealTypes: f.mealTypes.includes(v) ? f.mealTypes.filter((x) => x !== v) : [...f.mealTypes, v],
    }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        ingredients: form.ingredients.filter((i) => i.name.trim()),
        steps: form.steps.filter((s) => s.trim()),
      };
      if (editingId) {
        const updated = await api.patch<Recipe>(`/recipes/${editingId}`, payload);
        setRecipes((r) => r.map((x) => x.id === editingId ? updated : x));
      } else {
        const created = await api.post<Recipe>("/recipes", payload);
        setRecipes((r) => [created, ...r]);
      }
      closeForm();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/recipes/${id}`);
    setRecipes((r) => r.filter((x) => x.id !== id));
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Recetas</h1>
        <button onClick={showForm ? closeForm : openForm}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors",
            showForm ? "bg-muted text-foreground" : "bg-indigo-600 text-white hover:bg-indigo-700"
          )}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancelar" : "Nueva receta"}
        </button>
      </div>

      {/* Search */}
      {!showForm && (
        <input value={search}
          onChange={(e) => { setSearch(e.target.value); load(e.target.value); }}
          placeholder="Buscar recetas..."
          className="w-full px-4 py-2 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm" />
      )}

      {/* ── Create form ── */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-4 space-y-4 shadow-sm">
          <p className="text-sm font-semibold text-indigo-700">{editingId ? "Editar receta" : "Nueva receta"}</p>

          {/* Name */}
          <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nombre de la receta..."
            className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />

          {/* Description */}
          <textarea rows={2} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descripción (opcional)..."
            className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />

          {/* Times + servings */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Prep (min)", key: "prepTimeMinutes" },
              { label: "Cocción (min)", key: "cookTimeMinutes" },
              { label: "Raciones", key: "servings" },
            ].map(({ label, key }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                <input type="number" min={0} value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center" />
              </div>
            ))}
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dificultad</p>
            <div className="flex gap-2">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button key={d} onClick={() => setForm((f) => ({ ...f, difficulty: d }))}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full border font-medium transition-colors",
                    form.difficulty === d
                      ? DIFFICULTY_COLOR[d] + " border-transparent"
                      : "border-border text-muted-foreground"
                  )}>
                  {DIFFICULTY_LABEL[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Meal types */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de comida</p>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_TYPES.map((m) => (
                <button key={m.value} onClick={() => toggleMealType(m.value)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full border font-medium transition-colors",
                    form.mealTypes.includes(m.value)
                      ? "bg-indigo-600 text-white border-transparent"
                      : "border-border text-muted-foreground"
                  )}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ingredientes</p>
            {form.ingredients.map((ing, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <input value={ing.name} onChange={(e) => setIngredient(i, "name", e.target.value)}
                  placeholder="Ingrediente"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <input value={ing.quantity} onChange={(e) => setIngredient(i, "quantity", e.target.value)}
                  placeholder="Cant."
                  className="w-16 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center" />
                <input value={ing.unit} onChange={(e) => setIngredient(i, "unit", e.target.value)}
                  placeholder="ud."
                  className="w-14 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center" />
                <button onClick={() => removeIngredient(i)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button onClick={addIngredient}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Añadir ingrediente
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pasos</p>
            {form.steps.map((step, i) => (
              <div key={i} className="flex gap-1.5 items-start">
                <span className="text-xs text-muted-foreground font-medium mt-2 w-5 shrink-0 text-right">{i + 1}.</span>
                <textarea rows={2} value={step} onChange={(e) => setStep(i, e.target.value)}
                  placeholder={`Paso ${i + 1}...`}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                <button onClick={() => removeStep(i)} className="p-1.5 mt-0.5 text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button onClick={addStep}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Añadir paso
            </button>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Etiquetas <span className="normal-case font-normal">(separadas por comas)</span>
            </label>
            <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="vegetariano, rápido, familiar..."
              className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <button onClick={handleSave} disabled={!form.name.trim() || saving}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar receta"}
          </button>
        </div>
      )}

      {/* ── Recipe list ── */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>
      ) : recipes.length === 0 && !showForm ? (
        <div className="text-center py-12 space-y-2">
          <ChefHat className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">No hay recetas aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="bg-white rounded-xl border border-border overflow-hidden">
              {/* Summary row */}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => setExpanded(expanded === recipe.id ? null : recipe.id)}
                    className="flex-1 text-left">
                    <h3 className="font-semibold text-sm">{recipe.name}</h3>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", DIFFICULTY_COLOR[recipe.difficulty])}>
                      {DIFFICULTY_LABEL[recipe.difficulty]}
                    </span>
                    <button onClick={() => setExpanded(expanded === recipe.id ? null : recipe.id)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                      {expanded === recipe.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(recipe)}
                      className="p-1 text-muted-foreground hover:text-indigo-600 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(recipe.id)}
                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {recipe.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{recipe.description}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {recipe.servings} pers.
                  </span>
                  {recipe.mealTypes.map((mt) => (
                    <span key={mt} className="px-1.5 py-0.5 bg-muted rounded-full capitalize">
                      {MEAL_TYPES.find((x) => x.value === mt)?.label ?? mt}
                    </span>
                  ))}
                </div>

                {recipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {recipe.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-muted rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Expanded detail */}
              {expanded === recipe.id && (
                <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
                  {recipe.ingredients?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Ingredientes</p>
                      <ul className="space-y-1">
                        {recipe.ingredients.map((ing, i) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                            <span className="font-medium">{ing.name}</span>
                            {(ing.quantity || ing.unit) && (
                              <span className="text-muted-foreground ml-auto">{ing.quantity} {ing.unit}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recipe.steps?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Preparación</p>
                      <ol className="space-y-2">
                        {recipe.steps.map((step, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span className="font-bold text-indigo-500 shrink-0">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
