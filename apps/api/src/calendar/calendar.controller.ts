import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CalendarService } from "./calendar.service";

@ApiTags("calendar")
@Controller("calendar")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  getEvents(
    @Request() req: any,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.calendarService.getEvents(
      req.user.userId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined
    );
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.calendarService.create(req.user.userId, body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.calendarService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.calendarService.remove(id);
  }
}
