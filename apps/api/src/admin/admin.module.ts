import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { SettingsModule } from "../settings/settings.module";
import { TelegramModule } from "../telegram/telegram.module";
import { CronJobsModule } from "../cron-jobs/cron-jobs.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [SettingsModule, TelegramModule, CronJobsModule, NotificationsModule],
  controllers: [AdminController],
})
export class AdminModule {}
