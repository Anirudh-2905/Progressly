"""add users, sessions, ownership, and task tracking timestamps"""

from alembic import op
import sqlalchemy as sa


revision = "0002_auth_and_task_tracking"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table(
        "user_sessions",
        sa.Column("token_hash", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("owner_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_projects_owner_id_users", "users", ["owner_id"], ["id"], ondelete="CASCADE")
        batch.create_index("ix_projects_owner_id", ["owner_id"])
    with op.batch_alter_table("tasks") as batch:
        batch.add_column(sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False))
        batch.add_column(sa.Column("completed_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.drop_column("completed_at")
        batch.drop_column("updated_at")
    with op.batch_alter_table("projects") as batch:
        batch.drop_index("ix_projects_owner_id")
        batch.drop_constraint("fk_projects_owner_id_users", type_="foreignkey")
        batch.drop_column("owner_id")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

