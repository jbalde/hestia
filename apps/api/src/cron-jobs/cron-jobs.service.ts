import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CronJob } from "cron";
import { CronJobEntity, ScheduleType } from "./cron-job.entity";
import { LlmService } from "../llm/llm.service";
import { TelegramService } from "../telegram/telegram.service";

// Map of running cron jobs: entity id → CronJob instance
const runningJobs = new Map<string, InstanceType<typeof CronJob>>();

function buildCronExpression(
  scheduleType: ScheduleType,
  hour: number,
  minute: number,
  dayOfWeek?: number,
  dayOfMonth?: number
): string {
  const h = hour;
  const m = minute;
  switch (scheduleType) {
    case "daily":    return `${m} ${h} * * *`;
    case "weekdays": return `${m} ${h} * * 1-5`;
    case "weekend":  return `${m} ${h} * * 0,6`;
    case "weekly": {
      // Our UI: 0=Mon … 6=Sun → cron: 1=Mon … 7=Sun (or 0=Sun)
      // Convert: Mon(0)→1, Tue(1)→2, … Sat(5)→6, Sun(6)→0
      const cronDow = dayOfWeek === 6 ? 0 : (dayOfWeek ?? 0) + 1;
      return `${m} ${h} * * ${cronDow}`;
    }
    case "monthly":  return `${m} ${h} ${dayOfMonth ?? 1} * *`;
    default:         return `${m} ${h} * * *`;
  }
}

@Injectable()
export class CronJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronJobsService.name);

  constructor(
    @InjectRepository(CronJobEntity)
    private readonly repo: Repository<CronJobEntity>,
    private readonly llmService: LlmService,
    private readonly telegramService: TelegramService
  ) {}

  async onModuleInit() {
    const jobs = await this.repo.find({ where: { enabled: true } });
    for (const job of jobs) {
      this.scheduleJob(job);
    }
    this.logger.log(`Scheduled ${jobs.length} cron job(s)`);
  }

  onModuleDestroy() {
    for (const [, job] of runningJobs) {
      job.stop();
    }
    runningJobs.clear();
  }

  // ── CRUD ──────────────────────────────────────────────────────────

  async getAll() {
    return this.repo.find({ order: { createdAt: "ASC" } });
  }

  async create(data: Partial<CronJobEntity>) {
    const entity = this.repo.create(data);
    const saved  = await this.repo.save(entity);
    if (saved.enabled) this.scheduleJob(saved);
    return saved;
  }

  async update(id: string, data: Partial<CronJobEntity>) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) return null;
    this.unscheduleJob(id);
    Object.assign(entity, data);
    const saved = await this.repo.save(entity);
    if (saved.enabled) this.scheduleJob(saved);
    return saved;
  }

  async remove(id: string) {
    this.unscheduleJob(id);
    await this.repo.delete({ id });
    return { message: "Eliminado" };
  }

  // ── Execution ──────────────────────────────────────────────────

  /** Run a job immediately (used for "Run now" button). */
  async runNow(id: string): Promise<{ sent: number }> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) return { sent: 0 };
    const sent = await this.executeJob(entity);
    entity.lastRunAt = new Date();
    await this.repo.save(entity);
    return { sent };
  }

  /** Dry-test: run LLM with the prompt and return output without sending. */
  async dryTest(prompt: string, userId: string): Promise<{ reply: string }> {
    const { reply } = await this.llmService.chat(userId, prompt);
    return { reply };
  }

  // ── Internal ──────────────────────────────────────────────────

  private scheduleJob(entity: CronJobEntity) {
    try {
      const expression = buildCronExpression(
        entity.scheduleType,
        entity.hour,
        entity.minute,
        entity.dayOfWeek,
        entity.dayOfMonth
      );

      const job = new CronJob(expression, async () => {
        this.logger.log(`Running cron job "${entity.name}" (${entity.id})`);
        await this.executeJob(entity);
        entity.lastRunAt = new Date();
        await this.repo.save(entity);
      });

      job.start();
      runningJobs.set(entity.id, job);
      this.logger.log(`Scheduled "${entity.name}" → ${expression}`);
    } catch (err) {
      this.logger.error(`Failed to schedule job "${entity.name}": ${err}`);
    }
  }

  private unscheduleJob(id: string) {
    const existing = runningJobs.get(id);
    if (existing) {
      existing.stop();
      runningJobs.delete(id);
    }
  }

  private async executeJob(entity: CronJobEntity): Promise<number> {
    let sent = 0;
    for (const userId of entity.targetUserIds) {
      try {
        const { reply } = await this.llmService.chat(userId, entity.prompt);
        await this.telegramService.sendToUser(userId, reply);
        sent++;
      } catch (err) {
        this.logger.error(`Failed to execute job for user ${userId}: ${err}`);
      }
    }
    return sent;
  }
}
