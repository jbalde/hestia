export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type DifficultyLevel = "easy" | "medium" | "hard";

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  ingredients: Ingredient[];
  steps: string[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: DifficultyLevel;
  mealTypes: MealType[];
  tags: string[];
  imageUrl?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuPlanDay {
  date: Date;
  breakfast?: string; // recipeId
  lunch?: string;
  dinner?: string;
  snacks: string[];
}

export interface MenuPlan {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  days: MenuPlanDay[];
  createdById: string;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRecipeDto {
  name: string;
  description?: string;
  ingredients: Ingredient[];
  steps: string[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty?: DifficultyLevel;
  mealTypes?: MealType[];
  tags?: string[];
}
