import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  pinHash: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: "#6366f1" })
  color: string;

  @Column({ nullable: true })
  telegramChatId: string;

  @Column({ nullable: true })
  telegramUsername: string;

  @Column({ default: true })
  notificationsEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
