import { describe, expect, it } from "vitest";
import { filterProjects, greeting, isOverdue, projectCompletion } from "./domain";
import type { Project, Task } from "./api";

const project = (overrides: Partial<Project> = {}): Project => ({ id: 1, name: "Study", description: "", task_count: 4, completed_count: 2, created_at: "2026-01-01", ...overrides });
const task = (overrides: Partial<Task> = {}): Task => ({ id: 1, project_id: 1, title: "Read", notes: "", status: "todo", priority: "medium", created_at: "2026-01-01", updated_at: "2026-01-01", ...overrides });

describe("dashboard domain helpers", () => {
  it("calculates project completion", () => expect(projectCompletion(project())).toBe(50));
  it("filters completed projects", () => expect(filterProjects([project(), project({ id: 2, completed_count: 4 })], "completed")).toHaveLength(1));
  it("detects overdue active tasks", () => expect(isOverdue(task({ due_date: "2026-01-01" }), new Date("2026-01-02T12:00:00"))).toBe(true));
  it("does not mark completed tasks overdue", () => expect(isOverdue(task({ due_date: "2026-01-01", status: "done" }), new Date("2026-01-02T12:00:00"))).toBe(false));
  it("uses the current hour for the greeting", () => expect(greeting(new Date("2026-01-01T19:00:00"))).toBe("Good evening"));
});

