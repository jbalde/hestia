import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  async loginWithPin(userId: string, pin: string) {
    const valid = await this.usersService.validatePin(userId, pin);
    if (!valid) {
      throw new UnauthorizedException("PIN incorrecto");
    }
    const user = await this.usersService.findById(userId);
    const payload = { sub: user.id, name: user.name };
    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        color: user.color,
        avatar: user.avatar,
      },
    };
  }

  async changePin(userId: string, currentPin: string, newPin: string) {
    if (!/^\d{4}$/.test(newPin)) {
      throw new UnauthorizedException("El PIN debe tener 4 dígitos numéricos");
    }
    const valid = await this.usersService.validatePin(userId, currentPin);
    if (!valid) {
      throw new UnauthorizedException("PIN actual incorrecto");
    }
    await this.usersService.updatePin(userId, newPin);
    return { message: "PIN actualizado correctamente" };
  }
}
