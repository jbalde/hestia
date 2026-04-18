import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("recipes")
export class RecipeEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: "text" })
  description: string;

  @Column({ type: "simple-json" })
  ingredients: Array<{ name: string; quantity: number; unit: string }>;

  @Column({ type: "simple-json" })
  steps: string[];

  @Column({ default: 0 })
  prepTimeMinutes: number;

  @Column({ default: 0 })
  cookTimeMinutes: number;

  @Column({ default: 4 })
  servings: number;

  @Column({ default: "easy" })
  difficulty: string;

  @Column({ type: "simple-json", default: "[]" })
  mealTypes: string[];

  @Column({ type: "simple-json", default: "[]" })
  tags: string[];

  @Column({ nullable: true })
  imageUrl: string;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
