import { Controller, Post, Delete, Get, Body, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("vapid-public-key")
  getVapidPublicKey() {
    return this.notificationsService.getVapidPublicKey();
  }

  @Post("subscribe")
  subscribe(
    @Request() req: any,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } }
  ) {
    return this.notificationsService.subscribe(req.user.userId, body);
  }

  @Delete("unsubscribe")
  unsubscribe(@Request() req: any, @Body() body: { endpoint: string }) {
    return this.notificationsService.unsubscribe(req.user.userId, body.endpoint);
  }
}
