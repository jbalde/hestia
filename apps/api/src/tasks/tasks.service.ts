import { Injectable, NotFoundException, ForbiddenException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cron } from "@nestjs/schedule";
import { TaskEntity, RecurrenceRule } from "./task.entity";
import { TaskListEntity } from "./task-list.entity";
import { TaskCategoryEntity } from "./task-category.entity";

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TaskListEntity)
    private readonly listRepo: Repository<TaskListEntity>,
    @InjectRepository(TaskCategoryEntity)
    private readonly categoryRepo: Repository<TaskCategoryEntity>
  ) {}

  // ── Categorías ───────────────────────────────────────────────────

  getCategories() {
    return this.categoryRepo.find({ order: { createdAt: "ASC" } });
  }

  async createCategory(data: { name: string; icon?: string; color?: string }) {
    const cat = this.categoryRepo.create(data);
    return this.categoryRepo.save(cat);
  }

  async deleteCategory(id: string) {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException("Categoría no encontrada");
    await this.categoryRepo.remove(cat);
    return { message: "Categoría eliminada" };
  }

  // ── Listas ────────────────────────────────────────────────────────

  async getLists(userId: string) {
    return this.listRepo
      .createQueryBuilder("list")
      .where("list.ownerId = :userId", { userId })
      .orWhere("list.visibility = :shared", { shared: "shared" })
      .getMany();
  }

  async createList(userId: string, data: { name: string; icon?: string; visibility?: string; memberIds?: string[] }) {
    const list = this.listRepo.create({
      ...data,
      ownerId: userId,
      visibility: data.visibility || "personal",
      memberIds: data.memberIds || [],
    });
    return this.listRepo.save(list);
  }

  // ── Tareas ────────────────────────────────────────────────────────

  async getArchivedTasks(userId: string) {
    return this.taskRepo
      .createQueryBuilder("task")
      .where(
        "(task.ownerId = :userId OR task.assigneeId = :userId OR task.visibility = :shared)",
        { userId, shared: "shared" }
      )
      .andWhere("task.archivedAt IS NOT NULL")
      .orderBy("task.archivedAt", "DESC")
      .getMany();
  }

  async getTasks(userId: string, listId?: string) {
    const qb = this.taskRepo
      .createQueryBuilder("task")
      .where(
        "(task.ownerId = :userId OR task.assigneeId = :userId OR task.visibility = :shared)",
        { userId, shared: "shared" }
      )
      .andWhere("task.archivedAt IS NULL");
    if (listId) qb.andWhere("task.listId = :listId", { listId });
    return qb.orderBy("task.createdAt", "DESC").getMany();
  }

  async createTask(
    userId: string,
    data: {
      title: string;
      description?: string;
      priority?: string;
      visibility?: string;
      assigneeId?: string;
      dueDate?: Date;
      recurrence?: RecurrenceRule;
      listId?: string;
      tags?: string[];
      categoryId?: string;
    }
  ) {
    const task = this.taskRepo.create({
      ...data,
      ownerId: userId,
      status: "pending",
      priority: data.priority || "medium",
      visibility: data.visibility || "personal",
      tags: data.tags || [],
    });
    return this.taskRepo.save(task);
  }

  async updateTask(
    userId: string,
    taskId: string,
    data: Partial<TaskEntity>
  ) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException("Task not found");
    if (task.ownerId !== userId && task.assigneeId !== userId) {
      throw new ForbiddenException("No tienes permiso para modificar esta tarea");
    }

    const isBeingCompleted = data.status === "done" && task.status !== "done";

    if (isBeingCompleted) {
      data.completedAt = new Date();
      data.lastCompletedAt = new Date();

      // Si es recurrente, calcular la próxima fecha y restablecer a pendiente
      if (task.recurrence) {
        const nextDue = calculateNextDueDate(task.recurrence, new Date());
        Object.assign(task, data);
        task.status = "pending";
        task.completedAt = null as any;
        task.dueDate = nextDue;
        return this.taskRepo.save(task);
      }
    }

    Object.assign(task, data);
    return this.taskRepo.save(task);
  }

  async deleteTask(userId: string, taskId: string) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException("Task not found");
    if (task.ownerId !== userId) {
      throw new ForbiddenException("Solo el creador puede eliminar la tarea");
    }
    await this.taskRepo.remove(task);
    return { message: "Tarea eliminada" };
  }

  // Archiva tareas completadas hace 14 días o más. Se ejecuta cada día a las 3:00.
  @Cron("0 3 * * *")
  async archiveOldCompletedTasks() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    const result = await this.taskRepo
      .createQueryBuilder()
      .update(TaskEntity)
      .set({ archivedAt: new Date() })
      .where("status = :status", { status: "done" })
      .andWhere("completedAt < :cutoff", { cutoff })
      .andWhere("archivedAt IS NULL")
      .execute();

    if (result.affected) {
      this.logger.log(`Archivadas ${result.affected} tarea(s) completadas hace más de 14 días`);
    }
  }
}

// ── Helpers de recurrencia ────────────────────────────────────────

export function calculateNextDueDate(rule: RecurrenceRule, from: Date): Date {
  const next = new Date(from);
  // Resetear a medianoche
  next.setHours(0, 0, 0, 0);

  switch (rule.type) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;

    case "weekly_window": {
      // Avanzar al lunes de la semana siguiente
      const jsDay = next.getDay(); // 0=dom … 6=sáb
      const currentDay = jsDay === 0 ? 6 : jsDay - 1; // 0=lun … 6=dom
      const daysToNextMonday = 7 - currentDay;
      next.setDate(next.getDate() + daysToNextMonday);
      break;
    }

    case "every_n_days":
      next.setDate(next.getDate() + (rule.interval ?? 2));
      break;

    case "weekly": {
      const target = rule.dayOfWeek ?? 0; // 0=lun
      // Convertir: JS getDay() 0=dom, nosotros 0=lun
      const jsDay = next.getDay();
      const currentDay = jsDay === 0 ? 6 : jsDay - 1;
      let diff = target - currentDay;
      if (diff <= 0) diff += 7;
      next.setDate(next.getDate() + diff);
      break;
    }

    case "monthly":
      next.setMonth(next.getMonth() + 1);
      next.setDate(rule.dayOfMonth ?? 1);
      break;

    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth((rule.month ?? 1) - 1);
      next.setDate(rule.dayOfMonth ?? 1);
      break;
  }

  return next;
}
