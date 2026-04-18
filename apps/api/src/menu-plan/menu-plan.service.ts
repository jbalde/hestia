import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MealPlanEntryEntity } from "./menu-plan-entry.entity";

@Injectable()
export class MenuPlanService {
  constructor(
    @InjectRepository(MealPlanEntryEntity)
    private readonly repo: Repository<MealPlanEntryEntity>
  ) {}

  getWeek(weekStart: string) {
    return this.repo.find({ where: { weekStart }, order: { dayOfWeek: "ASC" } });
  }

  async upsertMeal(
    userId: string,
    data: { weekStart: string; dayOfWeek: number; mealType: string; recipeId: string; recipeName: string }
  ) {
    let entry = await this.repo.findOne({
      where: { weekStart: data.weekStart, dayOfWeek: data.dayOfWeek, mealType: data.mealType },
    });
    if (entry) {
      entry.recipeId   = data.recipeId;
      entry.recipeName = data.recipeName;
    } else {
      entry = this.repo.create({ ...data, createdById: userId });
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
          dayOfWeek:   prev.dayOfWeek,
          mealType:    prev.mealType,
          recipeId:    prev.recipeId,
          recipeName:  prev.recipeName,
          createdById: userId,
        });
        created.push(await this.repo.save(entry));
      }
    }
    return created;
  }
}
