import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { TaskEntity } from "../tasks/task.entity";
import { MealPlanEntryEntity } from "../menu-plan/menu-plan-entry.entity";
import { ShoppingItemEntity } from "../shopping/shopping-item.entity";
import { CalendarEventEntity } from "../calendar/calendar-event.entity";
import { UserEntity } from "../users/user.entity";

// ── Date helpers ──────────────────────────────────────────────────

function weekBounds(weeksAgo = 0): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const daysToMon = day === 0 ? 6 : day - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - daysToMon - weeksAgo * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { start: mon, end: sun };
}

function weeksAgoStart(n: number): Date {
  const { start } = weekBounds(n);
  return start;
}

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(MealPlanEntryEntity)
    private readonly menuRepo: Repository<MealPlanEntryEntity>,
    @InjectRepository(ShoppingItemEntity)
    private readonly itemRepo: Repository<ShoppingItemEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly calRepo: Repository<CalendarEventEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async getStats() {
    const [tasks, recipes, shopping, calendar] = await Promise.all([
      this.taskStats(),
      this.recipeStats(),
      this.shoppingStats(),
      this.calendarStats(),
    ]);
    return { tasks, recipes, shopping, calendar };
  }

  // ── Tasks ────────────────────────────────────────────────────────

  private async taskStats() {
    const thisWeek = weekBounds(0);
    const lastWeek = weekBounds(1);

    const [completedThisWeek, completedLastWeek, pending, users] = await Promise.all([
      this.taskRepo.find({ where: { status: "done", completedAt: Between(thisWeek.start, thisWeek.end) } }),
      this.taskRepo.count({ where: { status: "done", completedAt: Between(lastWeek.start, lastWeek.end) } }),
      this.taskRepo.count({ where: { status: "pending" } }),
      this.userRepo.find(),
    ]);

    // Breakdown by day of this week (Mon=0 … Sun=6)
    const byDay = DAY_LABELS.map((label, i) => {
      const d = new Date(thisWeek.start);
      d.setDate(thisWeek.start.getDate() + i);
      const count = completedThisWeek.filter((t) => {
        if (!t.completedAt) return false;
        const c = new Date(t.completedAt);
        return c.toDateString() === d.toDateString();
      }).length;
      return { label, count };
    });

    // Breakdown by person (this week)
    const userMap = new Map(users.map((u) => [u.id, { name: u.name, color: u.color }]));
    const byPerson = users.map((u) => ({
      name: u.name,
      color: u.color,
      count: completedThisWeek.filter((t) => t.assigneeId === u.id || t.ownerId === u.id).length,
    })).filter((x) => x.count > 0);

    return {
      completedThisWeek: completedThisWeek.length,
      completedLastWeek,
      pendingTotal: pending,
      byDay,
      byPerson,
    };
  }

  // ── Recipes ──────────────────────────────────────────────────────

  private async recipeStats() {
    const eightWeeksAgo = weeksAgoStart(8);
    const thisWeek = weekBounds(0);

    // weekStart is stored as "YYYY-MM-DD" string — use raw query for date comparison
    const allEntries = await this.menuRepo
      .createQueryBuilder("e")
      .where("e.weekStart >= :from", { from: eightWeeksAgo.toISOString().slice(0, 10) })
      .getMany();

    // Top recipes (last 8 weeks)
    const counts: Record<string, number> = {};
    for (const e of allEntries) {
      if (e.entryType === "recipe" && e.recipeName) {
        counts[e.recipeName] = (counts[e.recipeName] ?? 0) + 1;
      }
    }
    const topRecipes = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // This week
    const thisWeekStr = thisWeek.start.toISOString().slice(0, 10);
    const thisWeekEntries = allEntries.filter((e) => e.weekStart === thisWeekStr);
    const mealsThisWeek = thisWeekEntries.filter((e) => e.entryType === "recipe").length;
    const eatingOutThisWeek = thisWeekEntries.filter((e) => e.entryType === "eating_out").length;

    return { topRecipes, mealsThisWeek, eatingOutThisWeek };
  }

  // ── Shopping ─────────────────────────────────────────────────────

  private async shoppingStats() {
    const thisWeek = weekBounds(0);
    const lastWeek = weekBounds(1);
    const fourWeeksAgo = weeksAgoStart(4);

    const [purchasedThisWeek, purchasedLastWeek, recentItems] = await Promise.all([
      this.itemRepo.count({ where: { status: "purchased", purchasedAt: Between(thisWeek.start, thisWeek.end) } }),
      this.itemRepo.count({ where: { status: "purchased", purchasedAt: Between(lastWeek.start, lastWeek.end) } }),
      this.itemRepo.find({ where: { status: "purchased", purchasedAt: Between(fourWeeksAgo, thisWeek.end) } }),
    ]);

    // Top purchased items (case-insensitive, last 4 weeks)
    const nameCounts: Record<string, number> = {};
    for (const item of recentItems) {
      const key = item.name.trim().toLowerCase();
      nameCounts[key] = (nameCounts[key] ?? 0) + 1;
    }
    const topItems = Object.entries(nameCounts)
      .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return { purchasedThisWeek, purchasedLastWeek, topItems };
  }

  // ── Calendar ─────────────────────────────────────────────────────

  private async calendarStats() {
    const thisWeek = weekBounds(0);

    const events = await this.calRepo
      .createQueryBuilder("e")
      .where("e.startDate >= :start AND e.startDate <= :end", {
        start: thisWeek.start.toISOString(),
        end: thisWeek.end.toISOString(),
      })
      .getMany();

    const byType: Record<string, number> = {};
    for (const e of events) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
    }
    const eventsByType = Object.entries(byType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return { eventsThisWeek: events.length, eventsByType };
  }
}
