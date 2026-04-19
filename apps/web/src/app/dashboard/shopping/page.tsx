"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Plus, Check, Trash2, ShoppingCart, Archive, ArchiveRestore, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ── Tipos ─────────────────────────────────────────────────────────

type ShoppingListCategory = "hogar" | "decoracion" | "ocio" | "otros";

interface ShoppingList {
  id: string;
  name: string;
  store?: string;
  category: ShoppingListCategory;
  status: "active" | "archived";
  archivedAt?: string;
}

interface ShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  status: string;
}

// ── Config de categorías ──────────────────────────────────────────

const CATEGORIES: { value: ShoppingListCategory; label: string; color: string; bg: string }[] = [
  { value: "hogar",      label: "Hogar recurrente", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  { value: "decoracion", label: "Decoración",        color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  { value: "ocio",       label: "Ocio",              color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  { value: "otros",      label: "Otros",             color: "text-gray-600",   bg: "bg-gray-50 border-gray-200" },
];

const FALLBACK_CAT = CATEGORIES[CATEGORIES.length - 1]!;
const getCat = (v: ShoppingListCategory) => CATEGORIES.find((c) => c.value === v) ?? FALLBACK_CAT;

// ── Componente principal ──────────────────────────────────────────

export default function ShoppingPage() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [archivedLists, setArchivedLists] = useState<ShoppingList[]>([]);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newListName, setNewListName] = useState("");
  const [newListCategory, setNewListCategory] = useState<ShoppingListCategory>("hogar");
  const [newItemName, setNewItemName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);

  useEffect(() => {
    api.get<ShoppingList[]>("/shopping/lists").then(setLists).catch(() => {});
  }, []);

  const loadArchived = async () => {
    const data = await api.get<ShoppingList[]>("/shopping/lists/archived");
    setArchivedLists(data);
  };

  const toggleArchived = () => {
    if (!showArchived) loadArchived();
    setShowArchived((v) => !v);
  };

  const selectList = async (list: ShoppingList) => {
    setSelectedList(list);
    const data = await api.get<ShoppingItem[]>(`/shopping/lists/${list.id}/items`);
    setItems(data);
  };

  const createList = async () => {
    if (!newListName.trim()) return;
    const list = await api.post<ShoppingList>("/shopping/lists", {
      name: newListName.trim(),
      category: newListCategory,
    });
    setLists((l) => [list, ...l]);
    setNewListName("");
    setNewListCategory("hogar");
    setShowNewList(false);
    await selectList(list);
  };

  const addItem = async () => {
    if (!selectedList || !newItemName.trim()) return;
    const item = await api.post<ShoppingItem>(`/shopping/lists/${selectedList.id}/items`, {
      name: newItemName.trim(),
    });
    setItems((i) => [...i, item]);
    setNewItemName("");
  };

  const markPurchased = async (itemId: string) => {
    const updated = await api.patch<ShoppingItem>(`/shopping/items/${itemId}/purchased`, {});
    setItems((i) => i.map((item) => (item.id === itemId ? updated : item)));
  };

  const removeItem = async (itemId: string) => {
    await api.delete(`/shopping/items/${itemId}`);
    setItems((i) => i.filter((item) => item.id !== itemId));
  };

  const archiveList = async () => {
    if (!selectedList || archiving) return;
    setArchiving(true);
    try {
      await api.patch(`/shopping/lists/${selectedList.id}/archive`, {});
      setLists((l) => l.filter((x) => x.id !== selectedList.id));
      setSelectedList(null);
    } finally {
      setArchiving(false);
    }
  };

  const unarchiveList = async () => {
    if (!selectedList || unarchiving) return;
    setUnarchiving(true);
    try {
      const updated = await api.patch<ShoppingList>(`/shopping/lists/${selectedList.id}/unarchive`, {});
      setArchivedLists((l) => l.filter((x) => x.id !== selectedList.id));
      setLists((l) => [updated, ...l]);
      setSelectedList(null);
    } finally {
      setUnarchiving(false);
    }
  };

  // ── Vista de lista seleccionada ────────────────────────────────

  if (selectedList) {
    const pending = items.filter((i) => i.status === "pending");
    const purchased = items.filter((i) => i.status === "purchased");
    const cat = getCat(selectedList.category);
    const isArchived = selectedList.status === "archived";

    return (
      <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedList(null)} className="text-muted-foreground hover:text-foreground">
            ←
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{selectedList.name}</h1>
            <span className={cn("inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium mt-0.5", cat.bg, cat.color)}>
              {cat.label}
            </span>
          </div>
          {isArchived ? (
            <button
              onClick={unarchiveList}
              disabled={unarchiving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Desarchivar lista"
            >
              <ArchiveRestore className="w-3.5 h-3.5" />
              Desarchivar
            </button>
          ) : (
            <button
              onClick={archiveList}
              disabled={archiving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Archivar lista"
            >
              <Archive className="w-3.5 h-3.5" />
              Archivar
            </button>
          )}
        </div>

        {isArchived && selectedList.archivedAt && (
          <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-xl">
            Archivada el {format(new Date(selectedList.archivedAt), "d 'de' MMMM yyyy", { locale: es })}
          </p>
        )}

        {!isArchived && (
          <div className="flex gap-2">
            <input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="Añadir producto..."
              className="flex-1 px-4 py-2 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button onClick={addItem} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        )}

        {pending.length > 0 && (
          <div className="space-y-2">
            {pending.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-border">
                {!isArchived && (
                  <button
                    onClick={() => markPurchased(item.id)}
                    className="shrink-0 w-6 h-6 rounded-full border-2 border-muted-foreground hover:border-green-500 transition-colors"
                  />
                )}
                {isArchived && <div className="shrink-0 w-6 h-6 rounded-full border-2 border-muted-foreground/30" />}
                <span className="flex-1 text-sm font-medium">
                  {item.name}
                  {item.quantity && <span className="text-muted-foreground ml-1">× {item.quantity} {item.unit}</span>}
                </span>
                {!isArchived && (
                  <button onClick={() => removeItem(item.id)} className="p-1 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {purchased.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-2">Comprado</p>
            <div className="space-y-2">
              {purchased.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border opacity-60">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <span className="flex-1 text-sm line-through text-muted-foreground">{item.name}</span>
                  {!isArchived && (
                    <button onClick={() => removeItem(item.id)} className="p-1 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Lista vacía.</div>
        )}
      </div>
    );
  }

  // ── Vista de listado ───────────────────────────────────────────

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Listas de la compra</h1>
        <button
          onClick={() => setShowNewList((v) => !v)}
          className={cn(
            "p-2 rounded-xl transition-colors",
            showNewList ? "bg-muted text-foreground" : "bg-indigo-600 text-white hover:bg-indigo-700"
          )}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Formulario nueva lista */}
      {showNewList && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-4 space-y-3 shadow-sm">
          <p className="text-sm font-semibold text-indigo-700">Nueva lista</p>
          <input
            autoFocus
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createList()}
            placeholder="Nombre de la lista..."
            className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoría</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setNewListCategory(cat.value)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors text-left",
                    newListCategory === cat.value ? cn(cat.bg, cat.color) : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={createList}
            disabled={!newListName.trim()}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            Crear lista
          </button>
        </div>
      )}

      {/* Listas activas */}
      {lists.length === 0 && !showNewList ? (
        <div className="text-center py-12 space-y-2">
          <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No hay listas activas</p>
          <button onClick={() => setShowNewList(true)} className="text-indigo-600 text-sm underline">
            Crear primera lista
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => {
            const cat = getCat(list.category);
            return (
              <button
                key={list.id}
                onClick={() => selectList(list)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-md transition-all text-left"
              >
                <div className={cn("p-2 rounded-lg", cat.bg)}>
                  <ShoppingCart className={cn("w-5 h-5", cat.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{list.name}</p>
                  <p className={cn("text-xs font-medium mt-0.5", cat.color)}>{cat.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Sección archivadas */}
      <div className="border-t border-border pt-3">
        <button
          onClick={toggleArchived}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <ArchiveRestore className="w-4 h-4" />
          <span className="flex-1 text-left">Listas archivadas</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", showArchived && "rotate-180")} />
        </button>

        {showArchived && (
          <div className="mt-3 space-y-2">
            {archivedLists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay listas archivadas</p>
            ) : (
              archivedLists.map((list) => {
                const cat = getCat(list.category);
                return (
                  <button
                    key={list.id}
                    onClick={() => selectList(list)}
                    className="w-full flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left opacity-75"
                  >
                    <div className={cn("p-1.5 rounded-lg", cat.bg)}>
                      <Archive className={cn("w-4 h-4", cat.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{list.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat.label}
                        {list.archivedAt && ` · ${format(new Date(list.archivedAt), "d MMM yyyy", { locale: es })}`}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
