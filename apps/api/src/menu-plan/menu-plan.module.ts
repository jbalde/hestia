import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MealPlanEntryEntity } from "./menu-plan-entry.entity";
import { MenuPlanService } from "./menu-plan.service";
import { MenuPlanController } from "./menu-plan.controller";

@Module({
  imports: [TypeOrmModule.forFeature([MealPlanEntryEntity])],
  providers: [MenuPlanService],
  controllers: [MenuPlanController],
  exports: [MenuPlanService],
})
export class MenuPlanModule {}
