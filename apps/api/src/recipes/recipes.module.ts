import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RecipeEntity } from "./recipe.entity";
import { RecipesService } from "./recipes.service";
import { RecipesController } from "./recipes.controller";

@Module({
  imports: [TypeOrmModule.forFeature([RecipeEntity])],
  providers: [RecipesService],
  controllers: [RecipesController],
  exports: [RecipesService],
})
export class RecipesModule {}
