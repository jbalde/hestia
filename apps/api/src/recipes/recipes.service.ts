import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RecipeEntity } from "./recipe.entity";

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(RecipeEntity)
    private readonly repo: Repository<RecipeEntity>
  ) {}

  async findAll(search?: string) {
    const qb = this.repo.createQueryBuilder("recipe");
    if (search) {
      qb.where("recipe.name LIKE :search OR recipe.tags LIKE :search", {
        search: `%${search}%`,
      });
    }
    return qb.orderBy("recipe.name", "ASC").getMany();
  }

  async findOne(id: string) {
    const recipe = await this.repo.findOne({ where: { id } });
    if (!recipe) throw new NotFoundException("Recipe not found");
    return recipe;
  }

  async create(userId: string, data: Partial<RecipeEntity>) {
    const recipe = this.repo.create({ ...data, createdById: userId });
    return this.repo.save(recipe);
  }

  async update(id: string, data: Partial<RecipeEntity>) {
    const recipe = await this.findOne(id);
    Object.assign(recipe, data);
    return this.repo.save(recipe);
  }

  async remove(id: string) {
    const recipe = await this.findOne(id);
    await this.repo.remove(recipe);
    return { message: "Receta eliminada" };
  }
}
