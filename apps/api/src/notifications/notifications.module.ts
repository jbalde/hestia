import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { RemindersService } from "./reminders.service";
import { PushSubscriptionEntity } from "./push-subscription.entity";
import { SettingsModule } from "../settings/settings.module";
import { TaskEntity } from "../tasks/task.entity";
import { CalendarEventEntity } from "../calendar/calendar-event.entity";
import { UserEntity } from "../users/user.entity";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscriptionEntity, TaskEntity, CalendarEventEntity, UserEntity]),
    SettingsModule,
    TelegramModule,
  ],
  providers: [NotificationsService, RemindersService],
  controllers: [NotificationsController],
  exports: [NotificationsService, RemindersService],
})
export class NotificationsModule {}
