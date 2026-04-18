import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from "typeorm";
import { ConversationEntity } from "./conversation.entity";

@Entity("chat_messages")
export class ChatMessageEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => ConversationEntity, (conv) => conv.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversationId" })
  conversation: ConversationEntity;

  @Column()
  role: string; // user | assistant

  @Column({ type: "text" })
  content: string;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
