import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ShoppingListEntity } from "./shopping-list.entity";
import { ShoppingItemEntity } from "./shopping-item.entity";

@Injectable()
export class ShoppingService {
  constructor(
    @InjectRepository(ShoppingListEntity)
    private readonly listRepo: Repository<ShoppingListEntity>,
    @InjectRepository(ShoppingItemEntity)
    private readonly itemRepo: Repository<ShoppingItemEntity>
  ) {}

  async getLists(userId: string) {
    return this.listRepo
      .createQueryBuilder("list")
      .where("list.createdById = :userId", { userId })
      .orWhere("list.memberIds LIKE :pattern", { pattern: `%${userId}%` })
      .getMany();
  }

  async createList(userId: string, data: { name: string; store?: string; memberIds?: string[] }) {
    const list = this.listRepo.create({ ...data, createdById: userId, memberIds: data.memberIds || [] });
    return this.listRepo.save(list);
  }

  async getItems(listId: string) {
    return this.itemRepo.find({ where: { listId }, order: { createdAt: "ASC" } });
  }

  async addItem(userId: string, listId: string, data: { name: string; quantity?: number; unit?: string; category?: string }) {
    const item = this.itemRepo.create({ ...data, listId, addedById: userId, status: "pending" });
    return this.itemRepo.save(item);
  }

  async markPurchased(userId: string, itemId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Item not found");
    item.status = "purchased";
    item.purchasedById = userId;
    item.purchasedAt = new Date();
    return this.itemRepo.save(item);
  }

  async removeItem(itemId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Item not found");
    await this.itemRepo.remove(item);
    return { message: "Item eliminado" };
  }
}
