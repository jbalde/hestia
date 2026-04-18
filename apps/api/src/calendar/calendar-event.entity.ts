import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("calendar_events")
export class CalendarEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: "text" })
  description: string;

  @Column({ default: "other" })
  type: string;

  @Column()
  startDate: Date;

  @Column({ nullable: true })
  endDate: Date;

  @Column({ default: false })
  allDay: boolean;

  @Column({ nullable: true, type: "simple-json" })
  recurrence: object;

  @Column({ nullable: true })
  color: string;

  @Column({ type: "simple-json", default: "[]" })
  assigneeIds: string[];

  @Column()
  createdById: string;

  @Column({ nullable: true })
  linkedTaskId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
