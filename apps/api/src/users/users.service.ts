import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import { UserEntity } from "./user.entity";

const FAMILY_MEMBERS = [
  { name: "Juan", color: "#6366f1", pin: "0000" },
  { name: "Marina", color: "#ec4899", pin: "0000" },
  { name: "Judith", color: "#f59e0b", pin: "0000" },
];

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>
  ) {}

  async onModuleInit() {
    await this.seedFamilyMembers();
  }

  private async seedFamilyMembers() {
    for (const member of FAMILY_MEMBERS) {
      const exists = await this.repo.findOne({ where: { name: member.name } });
      if (!exists) {
        const pinHash = await bcrypt.hash(member.pin, 10);
        await this.repo.save(
          this.repo.create({
            name: member.name,
            color: member.color,
            pinHash,
          })
        );
      }
    }
  }

  async findAll(): Promise<UserEntity[]> {
    return this.repo.find();
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByName(name: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { name } });
  }

  async validatePin(userId: string, pin: string): Promise<boolean> {
    const user = await this.findById(userId);
    return bcrypt.compare(pin, user.pinHash);
  }

  async updatePin(userId: string, newPin: string): Promise<UserEntity> {
    const user = await this.findById(userId);
    user.pinHash = await bcrypt.hash(newPin, 10);
    return this.repo.save(user);
  }

  async updateTelegram(
    userId: string,
    chatId: string,
    username?: string | undefined
  ): Promise<UserEntity> {
    const user = await this.findById(userId);
    user.telegramChatId = chatId;
    if (username) user.telegramUsername = username;
    return this.repo.save(user);
  }

  async updateProfile(
    userId: string,
    data: Partial<Pick<UserEntity, "avatar" | "color" | "notificationsEnabled">>
  ): Promise<UserEntity> {
    const user = await this.findById(userId);
    Object.assign(user, data);
    return this.repo.save(user);
  }
}
