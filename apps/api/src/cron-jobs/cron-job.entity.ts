import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";

export type ScheduleType = "daily" | "weekdays" | "weekend" | "weekly" | "monthly";

@Entity("cron_jobs")
export class CronJobEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text" })
  prompt: string;

  /** daily | weekdays | weekend | weekly | monthly */
  @Column({ default: "daily" })
  scheduleType: ScheduleType;

  @Column({ default: 8 })
  hour: number;

  @Column({ default: 0 })
  minute: number;

  /** 0=Mon … 6=Sun — used when scheduleType === "weekly" */
  @Column({ nullable: true, type: "integer" })
  dayOfWeek: number;

  /** 1–31 — used when scheduleType === "monthly" */
  @Column({ nullable: true, type: "integer" })
  dayOfMonth: number;

  /** Family member user IDs to message */
  @Column({ type: "simple-json", default: "[]" })
  targetUserIds: string[];

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  lastRunAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
