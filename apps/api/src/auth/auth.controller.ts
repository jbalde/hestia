import { Controller, Post, Body, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

const AUTH_THROTTLE = { default: { ttl: 60 * 60 * 1000, limit: 3 } };

class LoginDto {
  @IsString()
  userId: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: "PIN must be 4 digits" })
  pin: string;
}

class ChangePinDto {
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  currentPin: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  newPin: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle(AUTH_THROTTLE)
  login(@Body() dto: LoginDto) {
    return this.authService.loginWithPin(dto.userId, dto.pin);
  }

  @Post("change-pin")
  @Throttle(AUTH_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  changePin(@Request() req: any, @Body() dto: ChangePinDto) {
    return this.authService.changePin(req.user.userId, dto.currentPin, dto.newPin);
  }
}
