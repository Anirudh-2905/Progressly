export type User = { id: number; email: string };
export type Project = { id: number; name: string; description: string; task_count: number; completed_count: number; created_at: string };
export type TaskStatus = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high";
export type Task = { id: number; project_id: number; title: string; notes: string; status: TaskStatus; priority: Priority; due_date?: string | null; created_at: string; updated_at: string; completed_at?: string | null };
export type Dashboard = { total_projects: number; total_tasks: number; active_tasks: number; completed_tasks: number; in_progress_tasks: number; due_soon_tasks: number; overdue_tasks: number };

const localApi = `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
export const API_URL = import.meta.env.VITE_API_URL || localApi;

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    let message = "Something went wrong";
    try {
      const body = await response.json();
      message = typeof body.detail === "string" ? body.detail : body.detail?.[0]?.msg ?? message;
    } catch { /* keep the fallback */ }
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? undefined as T : response.json();
}

