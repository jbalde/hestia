import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("meal_plan_entries")
export class MealPlanEntryEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Monday of the week, "YYYY-MM-DD" */
  @Column()
  weekStart: string;

  /** 0 = Mon … 6 = Sun */
  @Column()
  dayOfWeek: number;

  /** breakfast | lunch | dinner */
  @Column()
  mealType: string;

  @Column()
  recipeId: string;

  /** Denormalised for quick display without a join */
  @Column()
  recipeName: string;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;
}
