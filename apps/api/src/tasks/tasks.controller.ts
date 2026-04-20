import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TasksService } from "./tasks.service";
import { RecurrenceRule } from "./task.entity";

@ApiTags("tasks")
@Controller("tasks")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get("categories")
  getCategories() {
    return this.tasksService.getCategories();
  }

  @Post("categories")
  createCategory(@Body() body: { name: string; icon?: string; color?: string }) {
    return this.tasksService.createCategory(body);
  }

  @Delete("categories/:id")
  deleteCategory(@Param("id") id: string) {
    return this.tasksService.deleteCategory(id);
  }

  @Get("lists")
  getLists(@Request() req: any) {
    return this.tasksService.getLists(req.user.userId);
  }

  @Post("lists")
  createList(
    @Request() req: any,
    @Body() body: { name: string; icon?: string; visibility?: string; memberIds?: string[] }
  ) {
    return this.tasksService.createList(req.user.userId, body);
  }

  @Get("archived")
  getArchivedTasks(@Request() req: any) {
    return this.tasksService.getArchivedTasks(req.user.userId);
  }

  @Get()
  getTasks(@Request() req: any, @Query("listId") listId?: string) {
    return this.tasksService.getTasks(req.user.userId, listId);
  }

  @Post()
  createTask(
    @Request() req: any,
    @Body()
    body: {
      title: string;
      description?: string;
      priority?: string;
      visibility?: string;
      assigneeId?: string;
      dueDate?: Date;
      recurrence?: RecurrenceRule;
      listId?: string;
      tags?: string[];
      categoryId?: string;
    }
  ) {
    return this.tasksService.createTask(req.user.userId, body);
  }

  @Patch(":id")
  updateTask(
    @Request() req: any,
    @Param("id") id: string,
    @Body() body: any
  ) {
    return this.tasksService.updateTask(req.user.userId, id, body);
  }

  @Delete(":id")
  deleteTask(@Request() req: any, @Param("id") id: string) {
    return this.tasksService.deleteTask(req.user.userId, id);
  }
}
