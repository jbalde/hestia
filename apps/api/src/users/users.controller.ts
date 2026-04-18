import { Controller, Get, Patch, Body, Param, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findOne(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Patch("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateProfile(
    @Request() req: any,
    @Body() body: { avatar?: string; color?: string; notificationsEnabled?: boolean }
  ) {
    return this.usersService.updateProfile(req.user.userId, body);
  }
}
