import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShoppingService } from "./shopping.service";

@ApiTags("shopping")
@Controller("shopping")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShoppingController {
  constructor(private readonly shoppingService: ShoppingService) {}

  @Get("lists")
  getLists(@Request() req: any) {
    return this.shoppingService.getLists(req.user.userId);
  }

  @Post("lists")
  createList(@Request() req: any, @Body() body: { name: string; store?: string; memberIds?: string[] }) {
    return this.shoppingService.createList(req.user.userId, body);
  }

  @Get("lists/:listId/items")
  getItems(@Param("listId") listId: string) {
    return this.shoppingService.getItems(listId);
  }

  @Post("lists/:listId/items")
  addItem(
    @Request() req: any,
    @Param("listId") listId: string,
    @Body() body: { name: string; quantity?: number; unit?: string; category?: string }
  ) {
    return this.shoppingService.addItem(req.user.userId, listId, body);
  }

  @Patch("items/:id/purchased")
  markPurchased(@Request() req: any, @Param("id") id: string) {
    return this.shoppingService.markPurchased(req.user.userId, id);
  }

  @Delete("items/:id")
  removeItem(@Param("id") id: string) {
    return this.shoppingService.removeItem(id);
  }
}
