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

  /** "recipe" | "eating_out" */
  @Column({ default: "recipe" })
  entryType: string;

  @Column({ nullable: true, type: "text" })
  recipeId: string | null;

  /** Denormalised for quick display without a join */
  @Column({ nullable: true, type: "text" })
  recipeName: string | null;

  @Column({ nullable: true, type: "text" })
  linkedCalendarEventId: string | null;

  /** Denormalised calendar event title */
  @Column({ nullable: true, type: "text" })
  linkedCalendarEventTitle: string | null;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;
}
