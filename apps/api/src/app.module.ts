import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TasksModule } from "./tasks/tasks.module";
import { ShoppingModule } from "./shopping/shopping.module";
import { RecipesModule } from "./recipes/recipes.module";
import { CalendarModule } from "./calendar/calendar.module";
import { LlmModule } from "./llm/llm.module";
import { TelegramModule } from "./telegram/telegram.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { SettingsModule } from "./settings/settings.module";
import { AdminModule } from "./admin/admin.module";
import { CronJobsModule } from "./cron-jobs/cron-jobs.module";
import { MenuPlanModule } from "./menu-plan/menu-plan.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: "better-sqlite3",
        database: config.get("DATABASE_PATH", "./data/hestia.db"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: true,
        logging: config.get("NODE_ENV") === "development",
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    TasksModule,
    ShoppingModule,
    RecipesModule,
    CalendarModule,
    LlmModule,
    TelegramModule,
    NotificationsModule,
    SettingsModule,
    AdminModule,
    CronJobsModule,
    MenuPlanModule,
  ],
})
export class AppModule {}
