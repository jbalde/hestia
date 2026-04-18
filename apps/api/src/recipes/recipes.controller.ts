import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RecipesService } from "./recipes.service";

@ApiTags("recipes")
@Controller("recipes")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  findAll(@Query("search") search?: string) {
    return this.recipesService.findAll(search);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.recipesService.findOne(id);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.recipesService.create(req.user.userId, body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.recipesService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.recipesService.remove(id);
  }
}
