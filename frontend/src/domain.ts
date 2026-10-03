import type { Project, Task } from "./api";

export type ProjectFilter = "all" | "active" | "completed";

export function projectCompletion(project: Project): number {
  return project.task_count ? Math.round((project.completed_count / project.task_count) * 100) : 0;
}

export function filterProjects(projects: Project[], filter: ProjectFilter): Project[] {
  if (filter === "completed") return projects.filter((project) => project.task_count > 0 && project.completed_count === project.task_count);
  if (filter === "active") return projects.filter((project) => project.task_count === 0 || project.completed_count < project.task_count);
  return projects;
}

export function isOverdue(task: Task, today = new Date()): boolean {
  if (!task.due_date || task.status === "done") return false;
  const boundary = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return new Date(`${task.due_date}T00:00:00`) < boundary;
}

export function formatDate(value?: string | null): string {
  if (!value) return "No due date";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function greeting(now = new Date()): string {
  if (now.getHours() < 12) return "Good morning";
  if (now.getHours() < 17) return "Good afternoon";
  return "Good evening";
}

