from collections.abc import Generator
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def normalize_database_url(url: str) -> str:
    """Select psycopg 3 when a provider supplies a generic Postgres URL."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


raw_database_url = os.getenv("DATABASE_URL")
if os.getenv("REQUIRE_DATABASE_URL", "false").lower() == "true" and not raw_database_url:
    raise RuntimeError("DATABASE_URL is required in this environment")
DATABASE_URL = normalize_database_url(raw_database_url or "sqlite:///./learning_tracker.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine_options = {"connect_args": connect_args, "pool_pre_ping": True}
if not DATABASE_URL.startswith("sqlite"):
    # Neon can suspend an idle compute; periodically replace old pooled connections.
    engine_options["pool_recycle"] = 300
engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
