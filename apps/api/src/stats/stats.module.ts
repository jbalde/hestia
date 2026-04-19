import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StatsService } from "./stats.service";
import { StatsController } from "./stats.controller";
import { TaskEntity } from "../tasks/task.entity";
import { MealPlanEntryEntity } from "../menu-plan/menu-plan-entry.entity";
import { ShoppingItemEntity } from "../shopping/shopping-item.entity";
import { CalendarEventEntity } from "../calendar/calendar-event.entity";
import { UserEntity } from "../users/user.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      MealPlanEntryEntity,
      ShoppingItemEntity,
      CalendarEventEntity,
      UserEntity,
    ]),
  ],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
