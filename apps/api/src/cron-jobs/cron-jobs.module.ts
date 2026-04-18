import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CronJobEntity } from "./cron-job.entity";
import { CronJobsService } from "./cron-jobs.service";
import { LlmModule } from "../llm/llm.module";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([CronJobEntity]),
    LlmModule,
    TelegramModule,
  ],
  providers: [CronJobsService],
  exports: [CronJobsService],
})
export class CronJobsModule {}
