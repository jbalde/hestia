import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export type ShoppingListCategory = "hogar" | "decoracion" | "ocio" | "otros";

@Entity("shopping_lists")
export class ShoppingListEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  store: string;

  @Column({ default: "otros" })
  category: ShoppingListCategory;

  @Column({ default: "active" })
  status: "active" | "archived";

  @Column({ nullable: true })
  archivedAt: Date;

  @Column({ type: "simple-json", default: "[]" })
  memberIds: string[];

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
