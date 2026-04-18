import { Injectable } from "@nestjs/common";
import { TasksService } from "../tasks/tasks.service";
import { ShoppingService } from "../shopping/shopping.service";
import { CalendarService } from "../calendar/calendar.service";
import { RecipesService } from "../recipes/recipes.service";
import { UsersService } from "../users/users.service";
import { MenuPlanService } from "../menu-plan/menu-plan.service";

const DOW_LABEL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MEAL_LABEL: Record<string, string> = {
  breakfast: "Desayuno",
  lunch:     "Comida",
  dinner:    "Cena",
  snack:     "Merienda",
};

function currentWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day; // ajustar para que la semana empiece en lunes
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0] as string;
}

@Injectable()
export class ContextBuilderService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly shoppingService: ShoppingService,
    private readonly calendarService: CalendarService,
    private readonly recipesService: RecipesService,
    private readonly usersService: UsersService,
    private readonly menuPlanService: MenuPlanService
  ) {}

  async buildContext(userId: string): Promise<string> {
    const weekStart = currentWeekStart();
    const nextWeekStart = (() => {
      const d = new Date(weekStart + "T00:00:00");
      d.setDate(d.getDate() + 7);
      return d.toISOString().split("T")[0] as string;
    })();

    const [tasks, shoppingLists, events, recipes, users, menuThisWeek, menuNextWeek] = await Promise.all([
      this.tasksService.getTasks(userId),
      this.shoppingService.getLists(userId),
      this.calendarService.getEvents(
        userId,
        new Date(),
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      ),
      this.recipesService.findAll(),
      this.usersService.findAll(),
      this.menuPlanService.getWeek(weekStart),
      this.menuPlanService.getWeek(nextWeekStart),
    ]);

    // Mapa userId -> nombre
    const nameMap = new Map(users.map((u) => [u.id, u.name]));

    const lines: string[] = [
      `=== DATOS DEL SISTEMA (${formatDate(new Date())}) ===`,
      "",
    ];

    // ── TAREAS ─────────────────────────────────────────────────────
    const pending = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
    if (pending.length > 0) {
      lines.push("--- TAREAS PENDIENTES ---");
      for (const t of pending.slice(0, 30)) {
        const parts: string[] = [`• ${t.title}`];
        if (t.priority === "high") parts.push("[URGENTE]");
        if (t.dueDate) parts.push(`[vence ${formatDate(new Date(t.dueDate))}]`);
        if (t.assigneeId) {
          const assignee = nameMap.get(t.assigneeId);
          if (assignee) parts.push(`[asignada a: ${assignee}]`);
        }
        lines.push(parts.join(" "));
      }
    } else {
      lines.push("--- TAREAS PENDIENTES ---");
      lines.push("(ninguna tarea pendiente)");
    }
    lines.push("");

    // ── COMPRA ─────────────────────────────────────────────────────
    lines.push("--- LISTAS DE LA COMPRA ---");
    if (shoppingLists.length === 0) {
      lines.push("(no hay listas de la compra)");
    } else {
      for (const list of shoppingLists) {
        const items = await this.shoppingService.getItems(list.id);
        const pendingItems = items.filter((i) => i.status === "pending");
        const header = list.store ? `[${list.name} — ${list.store}]` : `[${list.name}]`;
        lines.push(header);
        if (pendingItems.length === 0) {
          lines.push("  (lista vacía)");
        } else {
          for (const item of pendingItems.slice(0, 30)) {
            const qty =
              item.quantity != null
                ? ` (${item.quantity}${item.unit ? " " + item.unit : ""})`
                : "";
            lines.push(`  • ${item.name}${qty}`);
          }
        }
      }
    }
    lines.push("");

    // ── CALENDARIO ─────────────────────────────────────────────────
    lines.push("--- PRÓXIMOS EVENTOS (14 días) ---");
    if (events.length === 0) {
      lines.push("(no hay eventos próximos)");
    } else {
      for (const ev of events.slice(0, 20)) {
        const date = formatDate(new Date(ev.startDate));
        const assignees = ev.assigneeIds
          .map((id) => nameMap.get(id))
          .filter(Boolean)
          .join(", ");
        const who = assignees ? ` — ${assignees}` : "";
        const allDay = ev.allDay ? " (todo el día)" : "";
        lines.push(`• ${date}: ${ev.title}${allDay}${who}`);
      }
    }
    lines.push("");

    // ── RECETAS ────────────────────────────────────────────────────
    lines.push("--- RECETAS DISPONIBLES ---");
    if (recipes.length === 0) {
      lines.push("(no hay recetas guardadas)");
    } else {
      for (const r of recipes.slice(0, 30)) {
        const time = r.prepTimeMinutes + r.cookTimeMinutes;
        const diff = { easy: "fácil", medium: "media", hard: "difícil" }[r.difficulty] ?? r.difficulty;
        lines.push(`• ${r.name} (${diff}, ${time} min, ${r.servings} pers.)`);

        if (r.description) {
          lines.push(`  Descripción: ${r.description}`);
        }
        if (r.ingredients?.length > 0) {
          const ings = r.ingredients
            .map((i) => `${i.name}${i.quantity ? ` ${i.quantity}${i.unit ? " " + i.unit : ""}` : ""}`)
            .join(", ");
          lines.push(`  Ingredientes: ${ings}`);
        }
        if (r.steps?.length > 0) {
          lines.push(`  Preparación:`);
          r.steps.forEach((step, idx) => lines.push(`    ${idx + 1}. ${step}`));
        }
      }
    }
    lines.push("");

    // ── MENÚ SEMANAL ───────────────────────────────────────────────
    const renderMenu = (entries: typeof menuThisWeek, label: string) => {
      lines.push(`--- MENÚ ${label.toUpperCase()} (${label === "esta semana" ? weekStart : nextWeekStart}) ---`);
      if (entries.length === 0) {
        lines.push("(menú no planificado)");
        return;
      }
      // Group by day
      const byDay = new Map<number, typeof entries>();
      for (const e of entries) {
        if (!byDay.has(e.dayOfWeek)) byDay.set(e.dayOfWeek, []);
        byDay.get(e.dayOfWeek)!.push(e);
      }
      for (let d = 0; d < 7; d++) {
        const dayEntries = byDay.get(d);
        if (!dayEntries) continue;
        const meals = dayEntries
          .map((e) => `${MEAL_LABEL[e.mealType] ?? e.mealType}: ${e.recipeName}`)
          .join(", ");
        lines.push(`• ${DOW_LABEL[d]}: ${meals}`);
      }
    };

    renderMenu(menuThisWeek, "esta semana");
    lines.push("");
    renderMenu(menuNextWeek, "próxima semana");
    lines.push("");
    lines.push("=== FIN DE DATOS DEL SISTEMA ===");

    return lines.join("\n");
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
