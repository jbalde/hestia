import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { ChatMessageEntity } from "./chat-message.entity";

@Entity("conversations")
export class ConversationEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  title: string;

  /** Timestamp of the last message sent — used to detect idle conversations */
  @Column({ type: "datetime", nullable: true })
  lastMessageAt: Date;

  /** Whether this conversation has been compacted into a memory entry */
  @Column({ default: false })
  compacted: boolean;

  /** Origin channel: web app or Telegram bot */
  @Column({ default: "web" })
  source: "web" | "telegram";

  @OneToMany(() => ChatMessageEntity, (msg) => msg.conversation, {
    cascade: true,
    eager: false,
  })
  messages: ChatMessageEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
