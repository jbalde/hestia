export type ShoppingItemStatus = "pending" | "purchased";

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  status: ShoppingItemStatus;
  addedById: string;
  purchasedById?: string;
  purchasedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingList {
  id: string;
  name: string;
  store?: string;
  items: ShoppingItem[];
  memberIds: string[];
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShoppingItemDto {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
}

export interface CreateShoppingListDto {
  name: string;
  store?: string;
  memberIds?: string[];
}
