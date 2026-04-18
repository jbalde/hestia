import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ShoppingListEntity } from "./shopping-list.entity";
import { ShoppingItemEntity } from "./shopping-item.entity";
import { ShoppingService } from "./shopping.service";
import { ShoppingController } from "./shopping.controller";

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingListEntity, ShoppingItemEntity])],
  providers: [ShoppingService],
  controllers: [ShoppingController],
  exports: [ShoppingService],
})
export class ShoppingModule {}
