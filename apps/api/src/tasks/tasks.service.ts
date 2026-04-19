import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TaskEntity, RecurrenceRule } from "./task.entity";
import { TaskListEntity } from "./task-list.entity";

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TaskListEntity)
    private readonly listRepo: Repository<TaskListEntity>
  ) {}

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

  async getTasks(userId: string, listId?: string) {
    const qb = this.taskRepo
      .createQueryBuilder("task")
      .where(
        "(task.ownerId = :userId OR task.assigneeId = :userId OR task.visibility = :shared)",
        { userId, shared: "shared" }
      );
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
