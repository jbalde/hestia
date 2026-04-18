import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("task_lists")
export class TaskListEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: "personal" })
  visibility: string;

  @Column()
  ownerId: string;

  @Column({ type: "simple-json", default: "[]" })
  memberIds: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
