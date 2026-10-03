from contextlib import asynccontextmanager
from datetime import UTC, date, datetime, timedelta
import logging
import os
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from .db import get_db
from .models import Project, Task, User, UserSession
from .schemas import Dashboard, ProjectCreate, ProjectRead, ProjectUpdate, TaskCreate, TaskRead, TaskUpdate, UserCredentials, UserRead
from .security import hash_password, new_session_token, secure_cookie_enabled, session_token_hash, verify_password


SESSION_COOKIE = "learning_tracker_session"
SESSION_DAYS = 7
logger = logging.getLogger("learning_tracker")


def allowed_origins() -> list[str]:
    configured = os.getenv("FRONTEND_ORIGINS", os.getenv("FRONTEND_ORIGIN", ""))
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *(origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()),
    ]


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(title="Learning Tracker API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["operations"])
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    """Readiness check: the process and its required database must both work."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.exception("Database readiness check failed")
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ok", "database": "ok"}


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=secure_cookie_enabled(),
        samesite=os.getenv("COOKIE_SAMESITE", "lax"),
        path="/",
    )


def create_session(db: Session, user: User) -> str:
    token = new_session_token()
    db.add(UserSession(token_hash=session_token_hash(token), user_id=user.id, expires_at=utcnow() + timedelta(days=SESSION_DAYS)))
    return token


def get_current_user(
    token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    session = db.get(UserSession, session_token_hash(token))
    if session is None or session.expires_at <= utcnow():
        if session is not None:
            db.delete(session)
            db.commit()
        raise HTTPException(status_code=401, detail="Session expired")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


@app.post("/api/v1/auth/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCredentials, response: Response, db: Session = Depends(get_db)) -> User:
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    is_first_user = (db.scalar(select(func.count(User.id))) or 0) == 0
    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    if is_first_user:
        for project in db.scalars(select(Project).where(Project.owner_id.is_(None))).all():
            project.owner_id = user.id
    token = create_session(db, user)
    db.commit()
    db.refresh(user)
    set_session_cookie(response, token)
    return user


@app.post("/api/v1/auth/login", response_model=UserRead)
def login(payload: UserCredentials, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_session(db, user)
    db.commit()
    set_session_cookie(response, token)
    return user


@app.post("/api/v1/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, token: str | None = Cookie(default=None, alias=SESSION_COOKIE), db: Session = Depends(get_db)) -> None:
    if token:
        session = db.get(UserSession, session_token_hash(token))
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")


@app.get("/api/v1/auth/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> User:
    return user


def project_response(project: Project) -> ProjectRead:
    return ProjectRead(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        task_count=len(project.tasks),
        completed_count=sum(task.status == "done" for task in project.tasks),
    )


def owned_project(project_id: int, user: User, db: Session) -> Project:
    project = db.scalar(select(Project).options(selectinload(Project.tasks)).where(Project.id == project_id, Project.owner_id == user.id))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.get("/api/v1/projects", response_model=list[ProjectRead])
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ProjectRead]:
    projects = db.scalars(select(Project).options(selectinload(Project.tasks)).where(Project.owner_id == user.id).order_by(Project.created_at.desc())).all()
    return [project_response(project) for project in projects]


@app.post("/api/v1/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProjectRead:
    project = Project(owner_id=user.id, name=payload.name, description=payload.description.strip())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_response(project)


@app.put("/api/v1/projects/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, payload: ProjectUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProjectRead:
    project = owned_project(project_id, user, db)
    project.name = payload.name
    project.description = payload.description.strip()
    db.commit()
    db.refresh(project)
    return project_response(project)


@app.delete("/api/v1/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    project = owned_project(project_id, user, db)
    db.delete(project)
    db.commit()


@app.get("/api/v1/projects/{project_id}/tasks", response_model=list[TaskRead])
def list_tasks(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Task]:
    owned_project(project_id, user, db)
    return list(db.scalars(select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())).all())


@app.get("/api/v1/tasks", response_model=list[TaskRead])
def list_all_tasks(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Task]:
    return list(db.scalars(select(Task).join(Project).where(Project.owner_id == user.id).order_by(Task.created_at.desc())).all())


@app.post("/api/v1/projects/{project_id}/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(project_id: int, payload: TaskCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Task:
    owned_project(project_id, user, db)
    task = Task(project_id=project_id, title=payload.title, notes=payload.notes.strip(), priority=payload.priority, due_date=payload.due_date)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def owned_task(task_id: int, user: User, db: Session) -> Task:
    task = db.scalar(select(Task).join(Project).where(Task.id == task_id, Project.owner_id == user.id))
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.patch("/api/v1/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Task:
    task = owned_task(task_id, user, db)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(task, field, value.strip() if isinstance(value, str) and field == "notes" else value)
    if "status" in changes:
        task.completed_at = utcnow() if changes["status"] == "done" else None
    db.commit()
    db.refresh(task)
    return task


@app.delete("/api/v1/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    task = owned_task(task_id, user, db)
    db.delete(task)
    db.commit()


@app.get("/api/v1/dashboard", response_model=Dashboard)
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Dashboard:
    tasks = db.scalars(select(Task).join(Project).where(Project.owner_id == user.id)).all()
    today = date.today()
    week_end = today + timedelta(days=7)
    return Dashboard(
        total_projects=db.scalar(select(func.count(Project.id)).where(Project.owner_id == user.id)) or 0,
        total_tasks=len(tasks),
        active_tasks=sum(task.status != "done" for task in tasks),
        completed_tasks=sum(task.status == "done" for task in tasks),
        in_progress_tasks=sum(task.status == "in_progress" for task in tasks),
        due_soon_tasks=sum(task.due_date is not None and today <= task.due_date <= week_end and task.status != "done" for task in tasks),
        overdue_tasks=sum(task.due_date is not None and task.due_date < today and task.status != "done" for task in tasks),
    )


# The production image places the compiled React application here. Local
# development keeps using Vite on port 5173, so this is enabled only in builds.
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIST_PATH", Path(__file__).resolve().parents[1] / "frontend_dist")).resolve()


if (FRONTEND_DIR / "index.html").is_file():
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        requested = (FRONTEND_DIR / full_path).resolve()
        if requested.is_relative_to(FRONTEND_DIR) and requested.is_file():
            return FileResponse(requested)
        return FileResponse(FRONTEND_DIR / "index.html")
