import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, ApiError, type Dashboard, type Priority, type Project, type Task, type TaskStatus, type User } from "./api";
import { filterProjects, formatDate, greeting, isOverdue, projectCompletion, type ProjectFilter } from "./domain";

const today = new Date();
const dateHeading = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      onAuthenticated(await api<User>(`/auth/${mode}`, { method: "POST", body: JSON.stringify({ email, password }) }));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to continue"); }
    finally { setBusy(false); }
  };

  return <main className="auth-shell"><section className="auth-card"><div className="brand"><span className="brand-mark">↗</span><span>Progressly</span></div><p className="kicker">PRIVATE LEARNING WORKSPACE</p><h1>{mode === "register" ? "Build your system." : "Welcome back."}</h1><p className="auth-copy">Projects, tasks, schedules, and progress—kept private to your account.</p><form onSubmit={submit}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Working…" : mode === "register" ? "Create account" : "Sign in"}</button></form><button className="text-button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>{mode === "register" ? "Already have an account? Sign in" : "New here? Create an account"}</button></section></main>;
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => { api<User>("/auth/me").then(setUser).catch(() => setUser(null)); }, []);
  if (user === undefined) return <main className="loading-screen"><span className="brand-mark">↗</span><p>Loading your workspace…</p></main>;
  if (user === null) return <AuthScreen onAuthenticated={setUser} />;
  return <DashboardView user={user} onLogout={() => setUser(null)} />;
}

function DashboardView({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [filterOpen, setFilterOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [editingProject, setEditingProject] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [editingTask, setEditingTask] = useState<number | null>(null);

  const refresh = async (preferredProject?: number) => {
    setLoading(true); setError("");
    try {
      const [projectData, dashboardData, taskData] = await Promise.all([api<Project[]>("/projects"), api<Dashboard>("/dashboard"), api<Task[]>("/tasks")]);
      setProjects(projectData); setDashboard(dashboardData); setTasks(taskData);
      const saved = Number(localStorage.getItem("learning-tracker-project"));
      const candidate = preferredProject ?? selectedProject ?? saved;
      const next = projectData.some((project) => project.id === candidate) ? candidate : projectData[0]?.id ?? null;
      setSelectedProject(next); if (next) localStorage.setItem("learning-tracker-project", String(next));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onLogout(); else setError(err instanceof Error ? err.message : "Could not load the workspace");
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const activeProject = projects.find((project) => project.id === selectedProject);
  const selectedTasks = tasks.filter((task) => task.project_id === selectedProject);
  const visibleProjects = filterProjects(projects, filter);
  const completion = dashboard?.total_tasks ? Math.round((dashboard.completed_tasks / dashboard.total_tasks) * 100) : 0;
  const alerts = tasks.filter((task) => isOverdue(task) || (task.due_date && task.status !== "done" && new Date(`${task.due_date}T00:00:00`) <= new Date(today.getTime() + 7 * 86400000)));
  const scheduleTasks = [...tasks].filter((task) => task.status !== "done").sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999")).slice(0, 4);
  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase(); if (!term) return { projects: [], tasks: [] };
    return { projects: projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(term)), tasks: tasks.filter((task) => `${task.title} ${task.notes}`.toLowerCase().includes(term)) };
  }, [query, projects, tasks]);

  const goTo = (section: string) => { setActiveSection(section); document.getElementById(section)?.scrollIntoView({ behavior: "smooth" }); };
  const selectProject = (id: number) => { setSelectedProject(id); localStorage.setItem("learning-tracker-project", String(id)); setSearchOpen(false); setQuery(""); goTo("projects"); };
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2500); };

  const submitProject = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const payload = { name: projectName, description: projectDescription };
      const project = editingProject
        ? await api<Project>(`/projects/${editingProject}`, { method: "PUT", body: JSON.stringify(payload) })
        : await api<Project>("/projects", { method: "POST", body: JSON.stringify(payload) });
      setProjectName(""); setProjectDescription(""); setEditingProject(null); await refresh(project.id); showNotice(editingProject ? "Project updated" : "Project created");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save project"); }
    finally { setBusy(false); }
  };

  const startProjectEdit = () => { if (!activeProject) return; setEditingProject(activeProject.id); setProjectName(activeProject.name); setProjectDescription(activeProject.description); goTo("projects"); };
  const removeProject = async () => {
    if (!activeProject || !window.confirm(`Delete “${activeProject.name}” and all of its tasks?`)) return;
    setBusy(true); try { await api(`/projects/${activeProject.id}`, { method: "DELETE" }); localStorage.removeItem("learning-tracker-project"); await refresh(); showNotice("Project deleted"); } catch (err) { setError(err instanceof Error ? err.message : "Could not delete project"); } finally { setBusy(false); }
  };

  const resetTaskForm = () => { setTaskTitle(""); setTaskNotes(""); setTaskPriority("medium"); setTaskDueDate(""); setEditingTask(null); };
  const submitTask = async (event: FormEvent) => {
    event.preventDefault(); if (!selectedProject) return; setBusy(true); setError("");
    try {
      const payload = { title: taskTitle, notes: taskNotes, priority: taskPriority, due_date: taskDueDate || null };
      if (editingTask) await api<Task>(`/tasks/${editingTask}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api<Task>(`/projects/${selectedProject}/tasks`, { method: "POST", body: JSON.stringify(payload) });
      const message = editingTask ? "Task updated" : "Task created"; resetTaskForm(); await refresh(selectedProject); showNotice(message);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save task"); }
    finally { setBusy(false); }
  };
  const updateTask = async (task: Task, changes: Partial<Task>) => { setBusy(true); try { await api<Task>(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(changes) }); await refresh(selectedProject ?? undefined); showNotice("Task updated"); } catch (err) { setError(err instanceof Error ? err.message : "Could not update task"); } finally { setBusy(false); } };
  const startTaskEdit = (task: Task) => { setEditingTask(task.id); setTaskTitle(task.title); setTaskNotes(task.notes); setTaskPriority(task.priority); setTaskDueDate(task.due_date || ""); document.getElementById("task-form")?.scrollIntoView({ behavior: "smooth" }); };
  const removeTask = async (task: Task) => { if (!window.confirm(`Delete “${task.title}”?`)) return; setBusy(true); try { await api(`/tasks/${task.id}`, { method: "DELETE" }); await refresh(selectedProject ?? undefined); showNotice("Task deleted"); } catch (err) { setError(err instanceof Error ? err.message : "Could not delete task"); } finally { setBusy(false); } };
  const logout = async () => { await api("/auth/logout", { method: "POST" }); onLogout(); };

  const days = Array.from({ length: 6 }, (_, index) => { const value = new Date(); value.setDate(value.getDate() + index); return value; });

  return <main className="app-shell">
    <header className="topbar"><button className="brand brand-button" onClick={() => goTo("overview")}><span className="brand-mark">↗</span><span>Progressly</span></button><nav>{[["overview", "Overview"], ["projects", "My projects"], ["schedule", "Schedule"], ["insights", "Insights"]].map(([id, label]) => <button className={activeSection === id ? "active" : ""} onClick={() => goTo(id)} key={id}>{label}</button>)}</nav><div className="top-actions"><button className="icon-button" aria-label="Search" onClick={() => setSearchOpen(true)}>⌕</button><button className="icon-button notification-button" aria-label={`Notifications, ${alerts.length} alerts`} onClick={() => setNotificationsOpen(!notificationsOpen)}>♢{alerts.length > 0 && <i>{alerts.length}</i>}</button><div className="profile"><span className="avatar">{user.email.slice(0, 2).toUpperCase()}</span><span><b>{user.email.split("@")[0]}</b><button onClick={() => void logout()}>Sign out</button></span></div></div></header>

    {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}{notice && <div className="toast" role="status">{notice}</div>}
    {notificationsOpen && <aside className="popover notifications" aria-label="Notifications"><div className="popover-title"><h2>Notifications</h2><button onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">×</button></div>{alerts.length ? alerts.map((task) => <button key={task.id} onClick={() => selectProject(task.project_id)}><b>{task.title}</b><small>{isOverdue(task) ? "Overdue" : `Due ${formatDate(task.due_date)}`}</small></button>) : <p>You’re all caught up.</p>}</aside>}
    {searchOpen && <div className="modal-backdrop" onMouseDown={() => setSearchOpen(false)}><section className="search-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Search workspace"><div className="popover-title"><h2>Search workspace</h2><button onClick={() => setSearchOpen(false)} aria-label="Close search">×</button></div><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects and tasks…" aria-label="Search projects and tasks" />{query && <div className="search-results"><p>{searchResults.projects.length + searchResults.tasks.length} results</p>{searchResults.projects.map((project) => <button key={`p-${project.id}`} onClick={() => selectProject(project.id)}><b>{project.name}</b><small>Project</small></button>)}{searchResults.tasks.map((task) => <button key={`t-${task.id}`} onClick={() => selectProject(task.project_id)}><b>{task.title}</b><small>Task · {projects.find((project) => project.id === task.project_id)?.name}</small></button>)}</div>}</section></div>}

    <section className="hero" id="overview"><div><p className="kicker">{dateHeading}</p><h1>{greeting()},<br /><em>keep moving.</em></h1><p className="hero-copy">A small step today is a system you can trust tomorrow.</p></div><div className="hero-note"><span className="spark">✦</span><span><b>{dashboard?.active_tasks ?? 0} active {(dashboard?.active_tasks ?? 0) === 1 ? "task" : "tasks"}</b><small>across your workspace</small></span></div></section>

    <section className="metric-grid">
      <button className="metric-card accent-card" onClick={() => { setFilter("completed"); goTo("projects"); }}><span className="card-top"><span>Tasks completed</span><span className="arrow">↗</span></span><strong>{dashboard?.completed_tasks ?? 0}</strong><small>Across all projects</small></button>
      <button className="metric-card" onClick={() => goTo("insights")}><span className="card-top"><span>Completion rate</span><span className="arrow">↗</span></span><strong>{completion}%</strong><small>{dashboard?.in_progress_tasks ?? 0} currently in progress</small></button>
      <button className="metric-card" onClick={() => { setFilter("active"); goTo("projects"); }}><span className="card-top"><span>Active tasks</span><span className="arrow">↗</span></span><strong>{dashboard?.active_tasks ?? 0}</strong><small>Across {dashboard?.total_projects ?? 0} projects</small></button>
      <button className="metric-card" onClick={() => setNotificationsOpen(true)}><span className="card-top"><span>Due in 7 days</span><span className="arrow">↗</span></span><strong>{dashboard?.due_soon_tasks ?? 0}</strong><small>{dashboard?.overdue_tasks ? `${dashboard.overdue_tasks} overdue` : "Nothing overdue"}</small></button>
    </section>

    <section className="main-grid">
      <article className="panel progress-panel" id="insights"><div className="panel-heading"><div><p className="kicker">REAL PROJECT DATA</p><h2>Project progress</h2></div><span className="panel-badge">{projects.length} projects</span></div><div className="chart" role="img" aria-label="Completion percentage by project"><div className="chart-y"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div className="bars">{projects.length ? projects.slice(0, 10).map((project) => <button className="bar-column" key={project.id} onClick={() => selectProject(project.id)} aria-label={`${project.name}, ${projectCompletion(project)} percent complete`}><span className={project.id === selectedProject ? "bar highlight" : "bar"} style={{ height: `${Math.max(projectCompletion(project), 4)}%` }} /><small>{project.name.slice(0, 5)}</small></button>) : <p className="empty-chart">Create a project to begin tracking progress.</p>}</div></div></article>
      <article className="panel schedule-panel" id="schedule"><div className="panel-heading"><div><p className="kicker">NEXT UP</p><h2>My schedule</h2></div><button className="panel-link" onClick={() => setNotificationsOpen(true)}>View alerts</button></div><div className="days">{days.map((day, index) => <span className={index === 0 ? "today" : ""} key={day.toISOString()}>{day.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}<strong>{day.getDate()}</strong></span>)}</div><div className="schedule-list">{scheduleTasks.length ? scheduleTasks.map((task) => <button className="schedule-item" key={task.id} onClick={() => selectProject(task.project_id)}><span className={`task-dot priority-${task.priority}`} /><span><b>{task.title}</b><small>{projects.find((project) => project.id === task.project_id)?.name}</small></span><time className={isOverdue(task) ? "overdue" : ""}>{formatDate(task.due_date)}</time></button>) : <p className="empty-message">No active tasks. Enjoy the clear schedule.</p>}</div></article>
    </section>

    <section className="bottom-grid" id="projects">
      <article className="panel projects-panel"><div className="panel-heading"><div><p className="kicker">YOUR WORKSPACE</p><h2>My projects</h2></div><div className="project-heading-actions"><span className="project-count">{visibleProjects.length} shown</span><button className="filter-toggle" aria-expanded={filterOpen} aria-controls="project-filters" onClick={() => setFilterOpen(!filterOpen)}>☷ Filters <b>{filter}</b></button></div></div>{filterOpen && <div className="project-tabs" id="project-filters" role="group" aria-label="Filter projects">{(["all", "active", "completed"] as ProjectFilter[]).map((item) => <button className={filter === item ? "selected" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)} key={item}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>}<div className="project-cards">{visibleProjects.map((project) => <button className={`project-card ${project.id === selectedProject ? "selected-card" : ""}`} key={project.id} onClick={() => selectProject(project.id)}><span className="project-card-top"><span className="project-icon">✦</span><span className="arrow">↗</span></span><h3>{project.name}</h3><p>{project.description || "A focused space for steady progress."}</p><span className="progress-line"><span><i style={{ width: `${projectCompletion(project)}%` }} /></span><b>{projectCompletion(project)}%</b></span></button>)}</div>{!visibleProjects.length && <p className="empty-message">No projects match this filter.</p>}<form className="project-form" onSubmit={submitProject}><h3>{editingProject ? "Edit project" : "Add a project"}</h3><input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" aria-label="Project name" required /><textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="What is this project for?" aria-label="Project description" /><div><button className="primary-button" disabled={busy}>{editingProject ? "Save changes" : "+ Add project"}</button>{editingProject && <button type="button" className="secondary-button" onClick={() => { setEditingProject(null); setProjectName(""); setProjectDescription(""); }}>Cancel</button>}</div></form></article>

      <article className="focus-card"><div className="focus-label"><span>ACTIVE FOCUS</span><span className="pill">{activeProject ? `${projectCompletion(activeProject)}%` : "Start here"}</span></div><h2>{activeProject?.name ?? "Create your first project"}</h2><p>{activeProject?.description || "Give your learning a home and turn the next idea into a small, visible step."}</p>{activeProject && <div className="project-actions"><button onClick={startProjectEdit}>Edit project</button><button className="danger-text" onClick={() => void removeProject()}>Delete</button></div>}<form className="task-form" id="task-form" onSubmit={submitTask}><h3>{editingTask ? "Edit task" : "Add a task"}</h3><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task title" aria-label="Task title" disabled={!selectedProject} required /><textarea value={taskNotes} onChange={(event) => setTaskNotes(event.target.value)} placeholder="Notes (optional)" aria-label="Task notes" disabled={!selectedProject} /><div className="task-fields"><label>Priority<select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Priority)} disabled={!selectedProject}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Due date<input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} disabled={!selectedProject} /></label></div><div><button className="dark-button" disabled={!selectedProject || busy}>{editingTask ? "Save task" : "Add task"}</button>{editingTask && <button type="button" className="cancel-dark" onClick={resetTaskForm}>Cancel</button>}</div></form></article>
    </section>

    {activeProject && <section className="panel task-panel" id="project-details"><div className="panel-heading"><div><p className="kicker">PROJECT DETAILS</p><h2>{activeProject.name} tasks</h2></div><span className="project-count">{selectedTasks.length} total</span></div><div className="task-list">{selectedTasks.map((task) => <article className={`task-row ${task.status === "done" ? "task-done" : ""}`} key={task.id}><button className="task-check" aria-label={`${task.status === "done" ? "Reopen" : "Complete"} ${task.title}`} onClick={() => void updateTask(task, { status: task.status === "done" ? "todo" : "done" })}>{task.status === "done" ? "✓" : ""}</button><div className="task-copy"><h3>{task.title}</h3>{task.notes && <p>{task.notes}</p>}<span>{formatDate(task.due_date)} · {task.priority} priority</span></div><select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => void updateTask(task, { status: event.target.value as TaskStatus })}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select><button className="small-button" onClick={() => startTaskEdit(task)}>Edit</button><button className="small-button danger-text" onClick={() => void removeTask(task)}>Delete</button></article>)}{!selectedTasks.length && <p className="empty-message">No tasks in this project yet.</p>}</div></section>}
    {loading && <div className="loading-overlay" aria-live="polite">Refreshing…</div>}
  </main>;
}
