import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ShoppingListEntity, ShoppingListCategory } from "./shopping-list.entity";
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
      .where(
        "(list.createdById = :userId OR list.memberIds LIKE :pattern)",
        { userId, pattern: `%${userId}%` }
      )
      .andWhere("list.status = 'active'")
      .orderBy("list.createdAt", "DESC")
      .getMany();
  }

  async getArchivedLists(userId: string) {
    return this.listRepo
      .createQueryBuilder("list")
      .where(
        "(list.createdById = :userId OR list.memberIds LIKE :pattern)",
        { userId, pattern: `%${userId}%` }
      )
      .andWhere("list.status = 'archived'")
      .orderBy("list.archivedAt", "DESC")
      .getMany();
  }

  async createList(userId: string, data: { name: string; store?: string; category?: ShoppingListCategory; memberIds?: string[] }) {
    const list = this.listRepo.create({
      ...data,
      createdById: userId,
      category: data.category || "otros",
      memberIds: data.memberIds || [],
      status: "active",
    });
    return this.listRepo.save(list);
  }

  async archiveList(userId: string, listId: string) {
    const list = await this.listRepo.findOne({ where: { id: listId } });
    if (!list) throw new NotFoundException("Lista no encontrada");
    if (list.createdById !== userId) throw new ForbiddenException("Solo el creador puede archivar la lista");
    list.status = "archived";
    list.archivedAt = new Date();
    return this.listRepo.save(list);
  }

  async unarchiveList(userId: string, listId: string) {
    const list = await this.listRepo.findOne({ where: { id: listId } });
    if (!list) throw new NotFoundException("Lista no encontrada");
    if (list.createdById !== userId) throw new ForbiddenException("Solo el creador puede desarchivar la lista");
    list.status = "active";
    list.archivedAt = null as any;
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
