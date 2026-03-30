from sqlalchemy import Column, Integer, String, Boolean, Text, Date, DateTime, ForeignKey, Numeric, BigInteger, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
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
    # Phase 1 additions
    category_id = Column(Integer, ForeignKey("project_categories.id"), nullable=True)
    priority = Column(String(20), default="medium")
    billing_type = Column(String(20), nullable=True)
    actual_cost = Column(Numeric(18, 4), nullable=True)
    total_hours = Column(Numeric(10, 2), server_default="0")
    # Phase 2 additions
    opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=True)

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
    # Phase 1 additions
    progress = Column(Integer, default=0)
    completed_at = Column(DateTime, nullable=True)
    is_billing_milestone = Column(Boolean, default=False)
    billing_amount = Column(Numeric(18, 4), nullable=True)
    billing_status = Column(String(20), default="unbilled")


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
    # Phase 1 additions
    actual_hours = Column(Numeric(8, 2), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    wbs_code = Column(String(50), nullable=True)
    progress = Column(Integer, default=0)
    # Phase 2 additions
    phase_id = Column(Integer, ForeignKey("project_phases.id"), nullable=True)
    required_skills = Column(JSONB, server_default='[]')

    __table_args__ = (
        Index("ix_tasks_tenant_project_status", "tenant_id", "project_id", "status"),
    )


class TimeLog(TenantMixin, Base):
    __tablename__ = "time_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
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


# ---------------------------------------------------------------------------
# Phase 1: Task Dependencies
# ---------------------------------------------------------------------------

class TaskDependency(TenantMixin, Base):
    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    depends_on_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    dependency_type = Column(String(20), default="finish_to_start")
    lag_days = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("task_id", "depends_on_task_id", name="uq_task_dependency"),
    )


# ---------------------------------------------------------------------------
# Phase 1: Task Checklists
# ---------------------------------------------------------------------------

class TaskChecklist(TenantMixin, Base):
    __tablename__ = "task_checklists"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    sort_order = Column(Integer, default=0)


# ---------------------------------------------------------------------------
# Phase 1: Task Labels (master data is in tenant_models.py as TaskLabel)
# ---------------------------------------------------------------------------

class TaskLabelAssignment(Base):
    __tablename__ = "task_label_assignments"
    __table_args__ = (
        UniqueConstraint("task_id", "label_id", name="uq_task_label"),
    )

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    label_id = Column(Integer, ForeignKey("task_labels.id", ondelete="CASCADE"), nullable=False)


# ---------------------------------------------------------------------------
# Phase 1: Task Comments
# ---------------------------------------------------------------------------

class TaskComment(TenantMixin, Base):
    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("task_comments.id"), nullable=True)
    body = Column(Text, nullable=False)
    mentions = Column(JSONB, server_default='[]')
    is_internal = Column(Boolean, default=False)


# ---------------------------------------------------------------------------
# Phase 1: Task Attachments
# ---------------------------------------------------------------------------

class TaskAttachment(TimestampMixin, Base):
    __tablename__ = "task_attachments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)


# ---------------------------------------------------------------------------
# Phase 1: Task Watchers
# ---------------------------------------------------------------------------

class TaskWatcher(Base):
    __tablename__ = "task_watchers"
    __table_args__ = (
        UniqueConstraint("task_id", "user_id", name="uq_task_watcher"),
    )

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)


# ---------------------------------------------------------------------------
# Phase 1: Project Members
# ---------------------------------------------------------------------------

class ProjectMember(TenantMixin, Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), default="member")
    joined_at = Column(DateTime, server_default=func.now())
    billing_rate = Column(Numeric(10, 2), nullable=True)

    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member"),
    )


# ---------------------------------------------------------------------------
# Phase 1: Project Comments / Activity Feed
# ---------------------------------------------------------------------------

class ProjectComment(TenantMixin, Base):
    __tablename__ = "project_comments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    body = Column(Text, nullable=False)
    comment_type = Column(String(20), default="comment")
    mentions = Column(JSONB, server_default='[]')


# ---------------------------------------------------------------------------
# Phase 1: Project Attachments
# ---------------------------------------------------------------------------

class ProjectAttachment(TimestampMixin, Base):
    __tablename__ = "project_attachments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)


# ---------------------------------------------------------------------------
# Phase 2: Project Templates
# ---------------------------------------------------------------------------

class ProjectTemplate(TenantMixin, Base):
    __tablename__ = "project_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("project_categories.id"), nullable=True)
    default_billing_type = Column(String(20), nullable=True)
    template_data = Column(JSONB, server_default='{}')
    is_active = Column(Boolean, default=True)


# ---------------------------------------------------------------------------
# Phase 2: Project Phases
# ---------------------------------------------------------------------------

class ProjectPhase(TenantMixin, Base):
    __tablename__ = "project_phases"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String(20), default="pending")
    sort_order = Column(Integer, default=0)
    color = Column(String(20), nullable=True)


# ---------------------------------------------------------------------------
# Phase 2: Resource Allocation
# ---------------------------------------------------------------------------

class ResourceAllocation(TenantMixin, Base):
    __tablename__ = "resource_allocations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    hours_per_day = Column(Numeric(4, 2), default=8)
    allocation_percent = Column(Integer, default=100)
    role = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)


# ---------------------------------------------------------------------------
# Phase 2: User Skills
# ---------------------------------------------------------------------------

class UserSkill(TenantMixin, Base):
    __tablename__ = "user_skills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill_name = Column(String(100), nullable=False)
    proficiency = Column(String(20), default="intermediate")

    __table_args__ = (
        Index("ix_user_skills_tenant_user", "tenant_id", "user_id"),
    )


# ---------------------------------------------------------------------------
# Phase 3: Project Expenses
# ---------------------------------------------------------------------------

class ProjectExpense(TenantMixin, Base):
    __tablename__ = "project_expenses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    cost_category_id = Column(Integer, ForeignKey("cost_categories.id"), nullable=True)
    description = Column(String(500), nullable=True)
    amount = Column(Numeric(18, 4), nullable=False)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    expense_date = Column(Date, nullable=False)
    vendor_name = Column(String(255), nullable=True)
    receipt_path = Column(String(500), nullable=True)
    is_billable = Column(Boolean, default=False)
    approval_status = Column(String(20), default="pending")
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    expense_claim_id = Column(Integer, ForeignKey("expense_claims.id"), nullable=True)
    notes = Column(Text, nullable=True)


# ---------------------------------------------------------------------------
# Phase 3: Project Budget Lines
# ---------------------------------------------------------------------------

class ProjectBudgetLine(TenantMixin, Base):
    __tablename__ = "project_budget_lines"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    cost_category_id = Column(Integer, ForeignKey("cost_categories.id"), nullable=True)
    planned_amount = Column(Numeric(18, 4), default=0)
    actual_amount = Column(Numeric(18, 4), default=0)
    description = Column(String(255), nullable=True)


# ---------------------------------------------------------------------------
# Phase 3: Billing Rates
# ---------------------------------------------------------------------------

class BillingRate(TenantMixin, Base):
    __tablename__ = "billing_rates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role_name = Column(String(50), nullable=True)
    hourly_rate = Column(Numeric(10, 2), nullable=False)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)


# ---------------------------------------------------------------------------
# Phase 3: Project Invoices
# ---------------------------------------------------------------------------

class ProjectInvoice(TenantMixin, Base):
    __tablename__ = "project_invoices"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    milestone_id = Column(Integer, ForeignKey("milestones.id"), nullable=True)
    amount = Column(Numeric(18, 4), nullable=False)
    description = Column(String(500), nullable=True)
    status = Column(String(20), default="draft")
    invoice_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    paid_date = Column(Date, nullable=True)


# ---------------------------------------------------------------------------
# Phase 4: Project Risks
# ---------------------------------------------------------------------------

class ProjectRisk(TenantMixin, Base):
    __tablename__ = "project_risks"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("risk_categories.id"), nullable=True)
    probability = Column(String(20), default="medium")
    impact = Column(String(20), default="medium")
    risk_score = Column(Integer, default=0)
    status = Column(String(20), default="identified")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    mitigation_plan = Column(Text, nullable=True)
    contingency_plan = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_project_risk_number"),
    )


# ---------------------------------------------------------------------------
# Phase 4: Project Issues
# ---------------------------------------------------------------------------

class ProjectIssue(TenantMixin, Base):
    __tablename__ = "project_issues"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="open")
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    related_risk_id = Column(Integer, ForeignKey("project_risks.id"), nullable=True)
    related_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    related_ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True)
    resolution = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_project_issue_number"),
    )


# ---------------------------------------------------------------------------
# Phase 4: Change Requests
# ---------------------------------------------------------------------------

class ChangeRequest(TenantMixin, Base):
    __tablename__ = "change_requests"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    number = Column(String(50), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    impact_analysis = Column(Text, nullable=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="submitted")
    priority = Column(String(20), default="medium")
    budget_impact = Column(Numeric(18, 4), nullable=True)
    schedule_impact_days = Column(Integer, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    implemented_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_change_request_number"),
    )


# ---------------------------------------------------------------------------
# Phase 4: Status Reports
# ---------------------------------------------------------------------------

class StatusReport(TenantMixin, Base):
    __tablename__ = "status_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    number = Column(String(50), nullable=True)
    report_date = Column(Date, nullable=False)
    period_type = Column(String(20), default="weekly")
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    summary = Column(Text, nullable=True)
    accomplishments = Column(JSONB, server_default='[]')
    planned_next = Column(JSONB, server_default='[]')
    risks_issues = Column(JSONB, server_default='[]')
    kpi_snapshot = Column(JSONB, server_default='{}')
    status = Column(String(20), default="draft")


# ---------------------------------------------------------------------------
# Phase 4: Meeting Notes
# ---------------------------------------------------------------------------

class MeetingNote(TenantMixin, Base):
    __tablename__ = "meeting_notes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    meeting_date = Column(DateTime, nullable=True)
    attendees = Column(JSONB, server_default='[]')
    agenda = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    action_items = Column(JSONB, server_default='[]')
