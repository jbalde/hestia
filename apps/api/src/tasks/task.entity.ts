import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export type RecurrenceType =
  | "daily"          // cada día
  | "weekly_window"  // una vez a la semana (cualquier día)
  | "every_n_days"   // cada N días (ej. cada 2 días)
  | "weekly"         // un día concreto de la semana
  | "monthly"        // un día concreto del mes
  | "yearly";        // un día concreto del año

export interface RecurrenceRule {
  type: RecurrenceType;
  interval?: number;   // every_n_days: N
  dayOfWeek?: number;  // weekly: 0=lun 1=mar 2=mié 3=jue 4=vie 5=sáb 6=dom
  dayOfMonth?: number; // monthly / yearly: 1-31
  month?: number;      // yearly: 1-12
}

@Entity("tasks")
export class TaskEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: "text" })
  description: string;

  @Column({ default: "pending" })
  status: string;

  @Column({ default: "medium" })
  priority: string;

  @Column({ default: "personal" })
  visibility: string;

  @Column()
  ownerId: string;

  /** ID del miembro de la familia asignado (uno solo) */
  @Column({ nullable: true })
  assigneeId: string;

  @Column({ nullable: true })
  dueDate: Date;

  @Column({ nullable: true })
  completedAt: Date;

  /** Fecha en que se completó por última vez (para recurrentes) */
  @Column({ nullable: true })
  lastCompletedAt: Date;

  /** Regla de recurrencia serializada como JSON */
  @Column({ nullable: true, type: "simple-json" })
  recurrence: RecurrenceRule;

  @Column({ nullable: true })
  listId: string;

  @Column({ type: "simple-json", default: "[]" })
  tags: string[];

  @Column({ nullable: true })
  categoryId: string;

  @Column({ nullable: true })
  archivedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
