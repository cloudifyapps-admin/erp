"""add is_active to tenant_users

Revision ID: d8e2f5a1b3c4
Revises: 1afaa02774db
Create Date: 2026-03-29 18:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "d8e2f5a1b3c4"
down_revision = "1afaa02774db"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_users",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("tenant_users", "is_active")
