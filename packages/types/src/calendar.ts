export type EventType = "task" | "reminder" | "appointment" | "birthday" | "other";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: Date;
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ...
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  startDate: Date;
  endDate?: Date;
  allDay: boolean;
  recurrence?: RecurrenceRule;
  color?: string;
  assigneeIds: string[];
  createdById: string;
  linkedTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCalendarEventDto {
  title: string;
  description?: string;
  type?: EventType;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  recurrence?: RecurrenceRule;
  color?: string;
  assigneeIds?: string[];
  linkedTaskId?: string;
}
