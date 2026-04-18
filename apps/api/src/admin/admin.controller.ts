import { Controller, Get, Put, Post, Delete, Body, Param, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsString, IsNumberString, IsOptional, IsUrl } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "./admin.guard";
import { SettingsService, LLM_KEYS, TELEGRAM_KEYS } from "../settings/settings.service";
import { TelegramService } from "../telegram/telegram.service";
import { CronJobsService } from "../cron-jobs/cron-jobs.service";

class UpdateLlmConfigDto {
  @IsUrl({ require_tld: false })
  apiUrl: string;

  @IsString()
  model: string;

  @IsNumberString()
  temperature: string;

  @IsNumberString()
  maxTokens: string;
}

class UpdateTelegramConfigDto {
  @IsString()
  @IsOptional()
  botToken: string;
}

@ApiTags("admin")
@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
    private readonly cronJobsService: CronJobsService
  ) {}

  // ── LLM ──────────────────────────────────────────────────────────

  @Get("llm-config")
  async getLlmConfig() {
    const [apiUrl, model, temperature, maxTokens] = await Promise.all([
      this.settingsService.get(LLM_KEYS.API_URL),
      this.settingsService.get(LLM_KEYS.MODEL),
      this.settingsService.get(LLM_KEYS.TEMPERATURE),
      this.settingsService.get(LLM_KEYS.MAX_TOKENS),
    ]);
    return { apiUrl, model, temperature, maxTokens };
  }

  @Put("llm-config")
  async updateLlmConfig(@Body() dto: UpdateLlmConfigDto) {
    await this.settingsService.setMany({
      [LLM_KEYS.API_URL]: dto.apiUrl,
      [LLM_KEYS.MODEL]: dto.model,
      [LLM_KEYS.TEMPERATURE]: dto.temperature,
      [LLM_KEYS.MAX_TOKENS]: dto.maxTokens,
    });
    return { message: "Configuración del LLM actualizada" };
  }

  // ── Telegram ─────────────────────────────────────────────────────

  @Get("telegram-config")
  async getTelegramConfig() {
    const token = await this.settingsService.get(TELEGRAM_KEYS.BOT_TOKEN);
    return {
      botToken: token ?? "",
      isRunning: this.telegramService.isRunning,
    };
  }

  @Put("telegram-config")
  async updateTelegramConfig(@Body() dto: UpdateTelegramConfigDto) {
    await this.telegramService.applyToken(dto.botToken ?? "");
    return {
      message: "Configuración de Telegram actualizada",
      isRunning: this.telegramService.isRunning,
    };
  }

  // ── Telegram contacts ─────────────────────────────────────────

  @Get("telegram-contacts")
  getTelegramContacts() {
    return this.telegramService.getContacts();
  }

  @Put("telegram-contacts/:id/pair")
  pairTelegramContact(
    @Param("id") id: string,
    @Body() body: { userId: string | null }
  ) {
    return this.telegramService.pairContact(id, body.userId);
  }

  @Delete("telegram-contacts/:id")
  deleteTelegramContact(@Param("id") id: string) {
    return this.telegramService.deleteContact(id);
  }

  // ── Cron jobs ─────────────────────────────────────────────────

  @Get("cron-jobs")
  getCronJobs() {
    return this.cronJobsService.getAll();
  }

  @Post("cron-jobs")
  createCronJob(@Body() body: any) {
    return this.cronJobsService.create(body);
  }

  @Put("cron-jobs/:id")
  updateCronJob(@Param("id") id: string, @Body() body: any) {
    return this.cronJobsService.update(id, body);
  }

  @Delete("cron-jobs/:id")
  deleteCronJob(@Param("id") id: string) {
    return this.cronJobsService.remove(id);
  }

  @Post("cron-jobs/:id/run")
  runCronJob(@Param("id") id: string) {
    return this.cronJobsService.runNow(id);
  }

  @Post("cron-jobs/dry-test")
  dryTestCronJob(@Request() req: any, @Body() body: { prompt: string }) {
    return this.cronJobsService.dryTest(body.prompt, req.user.userId);
  }
}
