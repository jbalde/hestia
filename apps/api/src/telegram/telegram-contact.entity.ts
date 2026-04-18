import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("telegram_contacts")
export class TelegramContactEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  chatId: string;

  @Column({ nullable: true, type: "text" })
  telegramUsername: string;

  @Column({ nullable: true, type: "text" })
  telegramFirstName: string;

  /** Linked family member. Null = unpaired (pending). */
  @Column({ nullable: true, type: "text" })
  userId: string;

  /** PIN verified after pairing. Reset to false on re-pair. */
  @Column({ default: false })
  authenticated: boolean;

  /** Active conversation ID for LLM continuity. Cleared when conversation is compacted. */
  @Column({ nullable: true, type: "text" })
  conversationId: string;

  @UpdateDateColumn()
  lastSeen: Date;

  @CreateDateColumn()
  firstSeen: Date;
}
