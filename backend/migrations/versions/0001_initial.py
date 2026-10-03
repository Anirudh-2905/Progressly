"""initial project and task tables"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("projects", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(length=120), nullable=False), sa.Column("description", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()))
    op.create_table("tasks", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False), sa.Column("title", sa.String(length=160), nullable=False), sa.Column("notes", sa.Text(), nullable=False), sa.Column("status", sa.String(length=20), nullable=False), sa.Column("priority", sa.String(length=20), nullable=False), sa.Column("due_date", sa.Date(), nullable=True), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()))


def downgrade() -> None:
    op.drop_table("tasks")
    op.drop_table("projects")

