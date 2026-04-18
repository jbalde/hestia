"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Plus, Check, Trash2, ShoppingCart } from "lucide-react";

interface ShoppingList {
  id: string;
  name: string;
  store?: string;
}

interface ShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  status: string;
}

export default function ShoppingPage() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newListName, setNewListName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [showNewList, setShowNewList] = useState(false);

  useEffect(() => {
    api.get<ShoppingList[]>("/shopping/lists").then(setLists).catch(() => {});
  }, []);

  const selectList = async (list: ShoppingList) => {
    setSelectedList(list);
    const data = await api.get<ShoppingItem[]>(`/shopping/lists/${list.id}/items`);
    setItems(data);
  };

  const createList = async () => {
    if (!newListName.trim()) return;
    const list = await api.post<ShoppingList>("/shopping/lists", { name: newListName.trim() });
    setLists((l) => [...l, list]);
    setNewListName("");
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

  if (!selectedList) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Listas de la compra</h1>
          <button
            onClick={() => setShowNewList(true)}
            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {showNewList && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createList()}
              placeholder="Nombre de la lista..."
              className="flex-1 px-4 py-2 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button onClick={createList} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm">
              Crear
            </button>
          </div>
        )}

        {lists.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No hay listas aún</p>
            <button onClick={() => setShowNewList(true)} className="text-indigo-600 text-sm underline">
              Crear primera lista
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => selectList(list)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-md transition-all text-left"
              >
                <div className="bg-pink-50 p-2 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <p className="font-medium">{list.name}</p>
                  {list.store && <p className="text-xs text-muted-foreground">{list.store}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const pending = items.filter((i) => i.status === "pending");
  const purchased = items.filter((i) => i.status === "purchased");

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setSelectedList(null)} className="text-muted-foreground hover:text-foreground">
          ←
        </button>
        <h1 className="text-xl font-bold flex-1">{selectedList.name}</h1>
        <span className="text-sm text-muted-foreground">
          {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
        </span>
      </div>

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

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-border">
              <button onClick={() => markPurchased(item.id)} className="shrink-0 w-6 h-6 rounded-full border-2 border-muted-foreground hover:border-green-500 transition-colors" />
              <span className="flex-1 text-sm font-medium">
                {item.name}
                {item.quantity && <span className="text-muted-foreground ml-1">× {item.quantity} {item.unit}</span>}
              </span>
              <button onClick={() => removeItem(item.id)} className="p-1 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Purchased */}
      {purchased.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-2">Comprado</p>
          <div className="space-y-2">
            {purchased.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border opacity-60">
                <Check className="w-5 h-5 text-green-500 shrink-0" />
                <span className="flex-1 text-sm line-through text-muted-foreground">{item.name}</span>
                <button onClick={() => removeItem(item.id)} className="p-1 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">Lista vacía. Añade productos arriba.</div>
      )}
    </div>
  );
}
