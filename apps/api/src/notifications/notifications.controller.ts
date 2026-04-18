import { Controller, Post, Delete, Body, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificationsService, PushSubscription } from "./notifications.service";

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post("subscribe")
  subscribe(@Request() req: any, @Body() body: PushSubscription) {
    return this.notificationsService.subscribe(req.user.userId, body);
  }

  @Delete("unsubscribe")
  unsubscribe(@Request() req: any, @Body() body: { endpoint: string }) {
    return this.notificationsService.unsubscribe(req.user.userId, body.endpoint);
  }
}
