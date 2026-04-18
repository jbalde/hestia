import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("shopping_items")
export class ShoppingItemEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  listId: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: "float" })
  quantity: number;

  @Column({ nullable: true })
  unit: string;

  @Column({ nullable: true })
  category: string;

  @Column({ default: "pending" })
  status: string;

  @Column()
  addedById: string;

  @Column({ nullable: true })
  purchasedById: string;

  @Column({ nullable: true })
  purchasedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
