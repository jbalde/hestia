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
  /** Empty = all members */
  memberIds?: string[];
}

function sortedKey(ids: string[]): string {
  return [...ids].sort().join(",");
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
    const memberIds = data.memberIds ?? [];
    const memberKey = sortedKey(memberIds);
    const entryType = data.entryType ?? "recipe";

    // Find existing entries for this slot and match by memberIds
    const slotEntries = await this.repo.find({
      where: { weekStart: data.weekStart, dayOfWeek: data.dayOfWeek, mealType: data.mealType },
    });

    const existing = slotEntries.find((e) => sortedKey(e.memberIds ?? []) === memberKey);

    if (existing) {
      existing.entryType                = entryType;
      existing.recipeId                 = data.recipeId ?? null;
      existing.recipeName               = data.recipeName ?? null;
      existing.linkedCalendarEventId    = data.linkedCalendarEventId ?? null;
      existing.linkedCalendarEventTitle = data.linkedCalendarEventTitle ?? null;
      existing.memberIds                = memberIds;
      return this.repo.save(existing);
    }

    const entry = this.repo.create({
      weekStart:                data.weekStart,
      dayOfWeek:                data.dayOfWeek,
      mealType:                 data.mealType,
      entryType,
      recipeId:                 data.recipeId ?? null,
      recipeName:               data.recipeName ?? null,
      linkedCalendarEventId:    data.linkedCalendarEventId ?? null,
      linkedCalendarEventTitle: data.linkedCalendarEventTitle ?? null,
      memberIds,
      createdById:              userId,
    });
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
      const memberKey = sortedKey(prev.memberIds ?? []);
      const slotEntries = await this.repo.find({
        where: { weekStart, dayOfWeek: prev.dayOfWeek, mealType: prev.mealType },
      });
      const alreadyExists = slotEntries.some((e) => sortedKey(e.memberIds ?? []) === memberKey);
      if (!alreadyExists) {
        const entry = this.repo.create({
          weekStart,
          dayOfWeek:                prev.dayOfWeek,
          mealType:                 prev.mealType,
          entryType:                prev.entryType ?? "recipe",
          recipeId:                 prev.recipeId,
          recipeName:               prev.recipeName,
          linkedCalendarEventId:    null,
          linkedCalendarEventTitle: null,
          memberIds:                prev.memberIds ?? [],
          createdById:              userId,
        });
        created.push(await this.repo.save(entry));
      }
    }
    return created;
  }
}
