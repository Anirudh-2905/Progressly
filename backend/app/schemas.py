from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserCredentials(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("Enter a valid email address")
        return value


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Project name cannot be empty")
        return value


class ProjectUpdate(ProjectCreate):
    pass


class ProjectRead(ProjectCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    task_count: int = 0
    completed_count: int = 0


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    notes: str = Field(default="", max_length=2000)
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be empty")
        return value


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)
    status: str | None = Field(default=None, pattern="^(todo|in_progress|done)$")
    priority: str | None = Field(default=None, pattern="^(low|medium|high)$")
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def clean_optional_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be empty")
        return value


class TaskRead(TaskCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class Dashboard(BaseModel):
    total_projects: int
    total_tasks: int
    active_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    due_soon_tasks: int
    overdue_tasks: int

