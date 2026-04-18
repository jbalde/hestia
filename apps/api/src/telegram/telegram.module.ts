import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TelegramService } from "./telegram.service";
import { TelegramContactEntity } from "./telegram-contact.entity";
import { UsersModule } from "../users/users.module";
import { LlmModule } from "../llm/llm.module";
import { TasksModule } from "../tasks/tasks.module";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramContactEntity]),
    SettingsModule,
    UsersModule,
    LlmModule,
    TasksModule,
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
