import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MealPlanEntryEntity } from "./menu-plan-entry.entity";

interface UpsertData {
  weekStart: string;
  dayOfWeek: number;
  mealType: string;
  entryType?: string;
  recipeId?: string | null;
  recipeName?: string | null;
  linkedCalendarEventId?: string | null;
  linkedCalendarEventTitle?: string | null;
}

@Injectable()
export class MenuPlanService {
  constructor(
    @InjectRepository(MealPlanEntryEntity)
    private readonly repo: Repository<MealPlanEntryEntity>
  ) {}

  getWeek(weekStart: string) {
    return this.repo.find({ where: { weekStart }, order: { dayOfWeek: "ASC" } });
  }

  async upsertMeal(userId: string, data: UpsertData) {
    let entry = await this.repo.findOne({
      where: { weekStart: data.weekStart, dayOfWeek: data.dayOfWeek, mealType: data.mealType },
    });

    const entryType = data.entryType ?? "recipe";

    if (entry) {
      entry.entryType                 = entryType;
      entry.recipeId                  = data.recipeId ?? null;
      entry.recipeName                = data.recipeName ?? null;
      entry.linkedCalendarEventId     = data.linkedCalendarEventId ?? null;
      entry.linkedCalendarEventTitle  = data.linkedCalendarEventTitle ?? null;
    } else {
      entry = this.repo.create({
        weekStart:                data.weekStart,
        dayOfWeek:                data.dayOfWeek,
        mealType:                 data.mealType,
        entryType,
        recipeId:                 data.recipeId ?? null,
        recipeName:               data.recipeName ?? null,
        linkedCalendarEventId:    data.linkedCalendarEventId ?? null,
        linkedCalendarEventTitle: data.linkedCalendarEventTitle ?? null,
        createdById:              userId,
      });
    }
    return this.repo.save(entry);
  }

  async removeMeal(id: string) {
    await this.repo.delete({ id });
    return { message: "Eliminado" };
  }

  async cloneFromPreviousWeek(userId: string, weekStart: string) {
    const prevDate = new Date(weekStart + "T00:00:00");
    prevDate.setDate(prevDate.getDate() - 7);
    const prevWeekStart = prevDate.toISOString().split("T")[0] as string;

    const prevEntries = await this.repo.find({ where: { weekStart: prevWeekStart } });
    const created: MealPlanEntryEntity[] = [];

    for (const prev of prevEntries) {
      const existing = await this.repo.findOne({
        where: { weekStart, dayOfWeek: prev.dayOfWeek, mealType: prev.mealType },
      });
      if (!existing) {
        const entry = this.repo.create({
          weekStart,
          dayOfWeek:                prev.dayOfWeek,
          mealType:                 prev.mealType,
          entryType:                prev.entryType ?? "recipe",
          recipeId:                 prev.recipeId,
          recipeName:               prev.recipeName,
          // calendar event links are week-specific — don't clone them
          linkedCalendarEventId:    null,
          linkedCalendarEventTitle: null,
          createdById:              userId,
        });
        created.push(await this.repo.save(entry));
      }
    }
    return created;
  }
}
