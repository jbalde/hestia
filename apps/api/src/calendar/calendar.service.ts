import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { CalendarEventEntity } from "./calendar-event.entity";

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEventEntity)
    private readonly repo: Repository<CalendarEventEntity>
  ) {}

  async getEvents(userId: string, from?: Date, to?: Date) {
    const qb = this.repo
      .createQueryBuilder("event")
      .where(
        "(event.createdById = :userId OR event.assigneeIds LIKE :pattern)",
        { userId, pattern: `%${userId}%` }
      );
    if (from && to) {
      qb.andWhere("event.startDate BETWEEN :from AND :to", { from, to });
    }
    return qb.orderBy("event.startDate", "ASC").getMany();
  }

  async create(userId: string, data: Partial<CalendarEventEntity>) {
    const event = this.repo.create({ ...data, createdById: userId });
    return this.repo.save(event);
  }

  async update(id: string, data: Partial<CalendarEventEntity>) {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new NotFoundException("Event not found");
    Object.assign(event, data);
    return this.repo.save(event);
  }

  async remove(id: string) {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new NotFoundException("Event not found");
    await this.repo.remove(event);
    return { message: "Evento eliminado" };
  }
}
