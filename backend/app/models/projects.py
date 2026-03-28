from sqlalchemy import Column, Integer, String, Boolean, Text, Date, DateTime, ForeignKey, Numeric, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
from app.models.base import TenantMixin, TimestampMixin


class Project(TenantMixin, Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    budget = Column(Numeric(18, 4), nullable=True)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    status = Column(String(20), default="planning")
    progress = Column(Integer, default=0)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_project_code"),
    )


class Milestone(TenantMixin, Base):
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(String(20), default="pending")
    sort_order = Column(Integer, default=0)


class Task(TenantMixin, Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    milestone_id = Column(Integer, ForeignKey("milestones.id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="todo")
    status_id = Column(Integer, ForeignKey("task_statuses.id"), nullable=True)
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    estimated_hours = Column(Numeric(8, 2), nullable=True)
    sort_order = Column(Integer, default=0)
    color = Column(String(7), nullable=True)
    # Recurring
    is_recurring = Column(Boolean, default=False)
    recurring_frequency = Column(String(20), nullable=True)
    recurring_end_date = Column(Date, nullable=True)
    next_recurring_date = Column(Date, nullable=True)
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    recurring_count = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_tasks_tenant_project_status", "tenant_id", "project_id", "status"),
    )


class TimeLog(TenantMixin, Base):
    __tablename__ = "time_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    hours = Column(Numeric(8, 2), nullable=False)
    log_date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    is_billable = Column(Boolean, default=False)
    started_at = Column(DateTime, nullable=True)
    stopped_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_time_logs_tenant_project_date", "tenant_id", "project_id", "log_date"),
    )
