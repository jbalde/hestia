import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaskEntity } from "./task.entity";
import { TaskListEntity } from "./task-list.entity";
import { TaskCategoryEntity } from "./task-category.entity";
import { TasksService } from "./tasks.service";
import { TasksController } from "./tasks.controller";

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, TaskListEntity, TaskCategoryEntity])],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
