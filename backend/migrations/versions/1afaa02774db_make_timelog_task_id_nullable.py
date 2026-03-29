"""make_timelog_task_id_nullable

Revision ID: 1afaa02774db
Revises: c7f1d4e3a8b2
Create Date: 2026-03-29 12:57:12.726834

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1afaa02774db'
down_revision: Union[str, None] = 'c7f1d4e3a8b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('time_logs', 'task_id', existing_type=sa.INTEGER(), nullable=True)


def downgrade() -> None:
    op.alter_column('time_logs', 'task_id', existing_type=sa.INTEGER(), nullable=False)
