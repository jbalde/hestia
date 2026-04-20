import { Controller, Get, Put, Post, Delete, Body, Param, Query, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MenuPlanService } from "./menu-plan.service";

@ApiTags("menu-plan")
@Controller("menu-plan")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MenuPlanController {
  constructor(private readonly service: MenuPlanService) {}

  @Get()
  getWeek(@Query("weekStart") weekStart: string) {
    return this.service.getWeek(weekStart);
  }

  @Put()
  upsertMeal(
    @Request() req: any,
    @Body() body: {
      weekStart: string;
      dayOfWeek: number;
      mealType: string;
      entryType?: string;
      recipeId?: string | null;
      recipeName?: string | null;
      linkedCalendarEventId?: string | null;
      linkedCalendarEventTitle?: string | null;
      memberIds?: string[];
    }
  ) {
    return this.service.upsertMeal(req.user.userId, body);
  }

  @Delete(":id")
  removeMeal(@Param("id") id: string) {
    return this.service.removeMeal(id);
  }

  @Post("clone")
  clonePreviousWeek(@Request() req: any, @Body() body: { weekStart: string }) {
    return this.service.cloneFromPreviousWeek(req.user.userId, body.weekStart);
  }
}
