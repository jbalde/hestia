export type TaskStatus = "pending" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type TaskVisibility = "personal" | "shared";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  visibility: TaskVisibility;
  ownerId: string;
  assigneeIds: string[];
  dueDate?: Date;
  completedAt?: Date;
  listId?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskList {
  id: string;
  name: string;
  icon?: string;
  visibility: TaskVisibility;
  ownerId: string;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  priority?: TaskPriority;
  visibility?: TaskVisibility;
  assigneeIds?: string[];
  dueDate?: Date;
  listId?: string;
  tags?: string[];
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {
  status?: TaskStatus;
}
