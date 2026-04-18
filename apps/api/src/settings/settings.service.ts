import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { SettingEntity } from "./setting.entity";

export const LLM_KEYS = {
  API_URL: "llm.apiUrl",
  MODEL: "llm.model",
  TEMPERATURE: "llm.temperature",
  MAX_TOKENS: "llm.maxTokens",
} as const;

export const TELEGRAM_KEYS = {
  BOT_TOKEN: "telegram.botToken",
} as const;

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(SettingEntity)
    private readonly repo: Repository<SettingEntity>,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    // Seed defaults from env if not already set
    const defaults: Record<string, string> = {
      [LLM_KEYS.API_URL]: this.config.get("LLM_API_URL", "http://localhost:11434/v1"),
      [LLM_KEYS.MODEL]: this.config.get("LLM_MODEL", "llama3.2"),
      [LLM_KEYS.TEMPERATURE]: "0.7",
      [LLM_KEYS.MAX_TOKENS]: "1024",
      [TELEGRAM_KEYS.BOT_TOKEN]: this.config.get("TELEGRAM_BOT_TOKEN", ""),
    };

    for (const [key, value] of Object.entries(defaults)) {
      const exists = await this.repo.findOne({ where: { key } });
      if (!exists) {
        await this.repo.save(this.repo.create({ key, value }));
      }
    }
  }

  async get(key: string): Promise<string | null> {
    const setting = await this.repo.findOne({ where: { key } });
    return setting?.value ?? null;
  }

  async getAll(): Promise<Record<string, string>> {
    const settings = await this.repo.find();
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }

  async set(key: string, value: string): Promise<void> {
    await this.repo.upsert({ key, value }, ["key"]);
  }

  async setMany(entries: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value);
    }
  }
}
