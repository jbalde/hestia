import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { Between, LessThan, Repository } from "typeorm";
import { TaskEntity } from "../tasks/task.entity";
import { CalendarEventEntity } from "../calendar/calendar-event.entity";
import { UserEntity } from "../users/user.entity";
import { TelegramService } from "../telegram/telegram.service";
import { NotificationsService } from "./notifications.service";
import { SettingsService, SYSTEM_KEYS } from "../settings/settings.service";

// Track events already reminded in this process lifetime to avoid duplicates
const remindedEventIds = new Set<string>();

// ── Timezone-aware date helpers ───────────────────────────────────────────────

function getTzOffsetMs(timezone: string, date: Date): number {
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tz  = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  return tz.getTime() - utc.getTime();
}

function getDayBoundsInTz(timezone: string): { dayStart: Date; dayEnd: Date } {
  const now      = new Date();
  const offsetMs = getTzOffsetMs(timezone, now);
  const shifted  = new Date(now.getTime() + offsetMs);

  const start = new Date(shifted); start.setUTCHours(0,  0,  0,   0);
  const end   = new Date(shifted); end.setUTCHours(23, 59, 59, 999);

  return {
    dayStart: new Date(start.getTime() - offsetMs),
    dayEnd:   new Date(end.getTime()   - offsetMs),
  };
}

function getMidnightInTz(timezone: string): Date {
  return getDayBoundsInTz(timezone).dayStart;
}

// ─────────────────────────────────────────────────────────────────────────────

const JOB_DAILY_DIGEST  = "reminders.dailyDigest";
const JOB_EVENT_SOON    = "reminders.eventSoon";
const JOB_OVERDUE       = "reminders.overdue";

@Injectable()
export class RemindersService implements OnModuleInit {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly calRepo: Repository<CalendarEventEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly telegramService: TelegramService,
    private readonly notificationsService: NotificationsService,
    private readonly settingsService: SettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    const tz = (await this.settingsService.get(SYSTEM_KEYS.TIMEZONE)) ?? "Europe/Madrid";
    this.registerCrons(tz);
    this.logger.log(`Reminders registered with timezone: ${tz}`);
  }

  // Called by AdminController when timezone changes
  async reinitCrons(timezone: string) {
    this.registerCrons(timezone);
    this.logger.log(`Reminders re-registered with timezone: ${timezone}`);
  }

  private registerCrons(timezone: string) {
    const jobs: [string, string, () => void][] = [
      [JOB_DAILY_DIGEST, "0 8 * * *",    () => this.dailyDigest()],
      [JOB_EVENT_SOON,   "*/15 * * * *", () => this.eventSoonReminders()],
      [JOB_OVERDUE,      "0 9 * * *",    () => this.overdueTasksReminder()],
    ];

    for (const [name, expression, fn] of jobs) {
      try { this.schedulerRegistry.deleteCronJob(name); } catch { /* not registered yet */ }
      const job = new CronJob(expression, fn, null, true, timezone);
      this.schedulerRegistry.addCronJob(name, job);
    }
  }

  // ── Resumen diario — 8:00 en la zona configurada ──────────────────

  async dailyDigest() {
    this.logger.log("Running daily digest reminders");
    const tz = (await this.settingsService.get(SYSTEM_KEYS.TIMEZONE)) ?? "Europe/Madrid";
    const { dayStart, dayEnd } = getDayBoundsInTz(tz);
    const users = await this.userRepo.find();

    for (const user of users) {
      try {
        await this.sendDailyDigestToUser(user, dayStart, dayEnd);
      } catch (err) {
        this.logger.warn(`Daily digest failed for ${user.name}: ${err}`);
      }
    }
  }

  private async sendDailyDigestToUser(user: UserEntity, dayStart: Date, dayEnd: Date) {
    const [tasks, events] = await Promise.all([
      this.taskRepo.find({
        where: [
          { status: "pending", assigneeId: user.id, dueDate: Between(dayStart, dayEnd) },
          { status: "pending", ownerId:    user.id, dueDate: Between(dayStart, dayEnd) },
        ],
      }),
      this.calRepo
        .createQueryBuilder("e")
        .where("e.startDate >= :start AND e.startDate <= :end", {
          start: dayStart.toISOString(),
          end:   dayEnd.toISOString(),
        })
        .getMany(),
    ]);

    const userEvents = events.filter(
      (e) => !e.assigneeIds?.length || e.assigneeIds.includes(user.id)
    );

    if (tasks.length === 0 && userEvents.length === 0) return;

    const tz = (await this.settingsService.get(SYSTEM_KEYS.TIMEZONE)) ?? "Europe/Madrid";
    const lines: string[] = [`☀️ *Buenos días, ${user.name}!* Aquí tienes tu resumen de hoy:\n`];

    if (userEvents.length > 0) {
      lines.push("📅 *Eventos hoy:*");
      for (const ev of userEvents) {
        const time = ev.allDay
          ? "Todo el día"
          : new Date(ev.startDate).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz });
        lines.push(`  • ${ev.title} (${time})`);
      }
      lines.push("");
    }

    if (tasks.length > 0) {
      lines.push("✅ *Tareas para hoy:*");
      for (const t of tasks) {
        const priority = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🟢";
        lines.push(`  ${priority} ${t.title}`);
      }
    }

    const message = lines.join("\n");

    await Promise.allSettled([
      this.telegramService.sendToUser(user.id, message),
      this.notificationsService.sendPushToUser(user.id, {
        title: `Buenos días, ${user.name} ☀️`,
        body: `${userEvents.length} eventos · ${tasks.length} tareas para hoy`,
        url: "/dashboard",
      }),
    ]);
  }

  // ── Avisos 30 min antes de eventos — cada 15 min ──────────────────

  async eventSoonReminders() {
    const now  = new Date();
    const in15 = new Date(now.getTime() + 15 * 60 * 1000);
    const in45 = new Date(now.getTime() + 45 * 60 * 1000);

    const tz = (await this.settingsService.get(SYSTEM_KEYS.TIMEZONE)) ?? "Europe/Madrid";

    const upcoming = await this.calRepo
      .createQueryBuilder("e")
      .where("e.startDate >= :from AND e.startDate <= :to", {
        from: in15.toISOString(),
        to:   in45.toISOString(),
      })
      .andWhere("e.allDay = :allDay", { allDay: false })
      .getMany();

    for (const ev of upcoming) {
      if (remindedEventIds.has(ev.id)) continue;
      remindedEventIds.add(ev.id);

      const startTime   = new Date(ev.startDate).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz });
      const minutesLeft = Math.round((new Date(ev.startDate).getTime() - now.getTime()) / 60000);
      const message     = `⏰ En ${minutesLeft} min: *${ev.title}* a las ${startTime}`;

      const targetUserIds = ev.assigneeIds?.length
        ? ev.assigneeIds
        : (await this.userRepo.find()).map((u) => u.id);

      for (const userId of targetUserIds) {
        await Promise.allSettled([
          this.telegramService.sendToUser(userId, message),
          this.notificationsService.sendPushToUser(userId, {
            title: `⏰ En ${minutesLeft} min: ${ev.title}`,
            body:  `Empieza a las ${startTime}`,
            url:   "/dashboard/calendar",
          }),
        ]);
      }
    }
  }

  // ── Tareas vencidas — cada día a las 9:00 ────────────────────────

  async overdueTasksReminder() {
    const tz  = (await this.settingsService.get(SYSTEM_KEYS.TIMEZONE)) ?? "Europe/Madrid";
    const now = getMidnightInTz(tz);
    const users = await this.userRepo.find();

    for (const user of users) {
      const overdue = await this.taskRepo
        .createQueryBuilder("t")
        .where("(t.assigneeId = :uid OR t.ownerId = :uid)", { uid: user.id })
        .andWhere("t.status = 'pending'")
        .andWhere("t.dueDate IS NOT NULL")
        .andWhere("t.dueDate < :now", { now: now.toISOString() })
        .getMany();

      if (overdue.length === 0) continue;

      const message =
        `⚠️ Tienes *${overdue.length} tarea${overdue.length > 1 ? "s" : ""} vencida${overdue.length > 1 ? "s" : ""}*:\n` +
        overdue.slice(0, 5).map((t) => `  • ${t.title}`).join("\n") +
        (overdue.length > 5 ? `\n  _...y ${overdue.length - 5} más_` : "");

      await Promise.allSettled([
        this.telegramService.sendToUser(user.id, message),
        this.notificationsService.sendPushToUser(user.id, {
          title: `⚠️ ${overdue.length} tarea${overdue.length > 1 ? "s" : ""} vencida${overdue.length > 1 ? "s" : ""}`,
          body:  overdue.slice(0, 3).map((t) => t.title).join(", "),
          url:   "/dashboard/tasks",
        }),
      ]);
    }
  }
}
