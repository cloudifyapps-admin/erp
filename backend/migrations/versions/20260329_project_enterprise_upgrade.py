"""Project Management enterprise upgrade — all 4 phases

Revision ID: c7f1d4e3a8b2
Revises: b5e9c3d2f6a7
Create Date: 2026-03-29 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c7f1d4e3a8b2"
down_revision = "b5e9c3d2f6a7"
branch_labels = None
depends_on = None


def _tenant_cols():
    return [
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    ]


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # Master data tables
    # -----------------------------------------------------------------------
    for table_name, extra_cols, constraints in [
        ("project_categories", [], [sa.UniqueConstraint("tenant_id", "slug", name="uq_project_category_slug")]),
        ("task_labels", [sa.Column("color", sa.String(20), nullable=True)], [sa.UniqueConstraint("tenant_id", "slug", name="uq_task_label_slug")]),
        ("cost_categories", [], [sa.UniqueConstraint("tenant_id", "slug", name="uq_cost_category_slug")]),
        ("risk_categories", [], [sa.UniqueConstraint("tenant_id", "slug", name="uq_risk_category_slug")]),
    ]:
        cols = [
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            *_tenant_cols(),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(255), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true"),
            sa.Column("sort_order", sa.Integer(), server_default="0"),
            *extra_cols,
        ]
        op.create_table(table_name, *cols, *constraints)

    # -----------------------------------------------------------------------
    # Modify existing tables
    # -----------------------------------------------------------------------
    # Projects
    op.add_column("projects", sa.Column("category_id", sa.Integer(), sa.ForeignKey("project_categories.id"), nullable=True))
    op.add_column("projects", sa.Column("priority", sa.String(20), server_default="medium"))
    op.add_column("projects", sa.Column("billing_type", sa.String(20), nullable=True))
    op.add_column("projects", sa.Column("actual_cost", sa.Numeric(18, 4), nullable=True))
    op.add_column("projects", sa.Column("total_hours", sa.Numeric(10, 2), server_default="0"))
    op.add_column("projects", sa.Column("opportunity_id", sa.Integer(), sa.ForeignKey("opportunities.id"), nullable=True))

    # Tasks
    op.add_column("tasks", sa.Column("actual_hours", sa.Numeric(8, 2), nullable=True))
    op.add_column("tasks", sa.Column("completed_at", sa.DateTime(), nullable=True))
    op.add_column("tasks", sa.Column("wbs_code", sa.String(50), nullable=True))
    op.add_column("tasks", sa.Column("progress", sa.Integer(), server_default="0"))
    op.add_column("tasks", sa.Column("phase_id", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("required_skills", postgresql.JSONB(), server_default="[]"))

    # Milestones
    op.add_column("milestones", sa.Column("progress", sa.Integer(), server_default="0"))
    op.add_column("milestones", sa.Column("completed_at", sa.DateTime(), nullable=True))
    op.add_column("milestones", sa.Column("is_billing_milestone", sa.Boolean(), server_default="false"))
    op.add_column("milestones", sa.Column("billing_amount", sa.Numeric(18, 4), nullable=True))
    op.add_column("milestones", sa.Column("billing_status", sa.String(20), server_default="unbilled"))

    # -----------------------------------------------------------------------
    # Phase 1: Task Dependencies
    # -----------------------------------------------------------------------
    op.create_table(
        "task_dependencies",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("depends_on_task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dependency_type", sa.String(20), server_default="finish_to_start"),
        sa.Column("lag_days", sa.Integer(), server_default="0"),
        sa.UniqueConstraint("task_id", "depends_on_task_id", name="uq_task_dependency"),
    )

    # Phase 1: Task Checklists
    op.create_table(
        "task_checklists",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("is_completed", sa.Boolean(), server_default="false"),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("completed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
    )

    # Phase 1: Task Label Assignments
    op.create_table(
        "task_label_assignments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label_id", sa.Integer(), sa.ForeignKey("task_labels.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("task_id", "label_id", name="uq_task_label"),
    )

    # Phase 1: Task Comments
    op.create_table(
        "task_comments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("task_comments.id"), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("mentions", postgresql.JSONB(), server_default="[]"),
        sa.Column("is_internal", sa.Boolean(), server_default="false"),
    )

    # Phase 1: Task Attachments
    op.create_table(
        "task_attachments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )

    # Phase 1: Task Watchers
    op.create_table(
        "task_watchers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("task_id", "user_id", name="uq_task_watcher"),
    )

    # Phase 1: Project Members
    op.create_table(
        "project_members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), server_default="member"),
        sa.Column("joined_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("billing_rate", sa.Numeric(10, 2), nullable=True),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_member"),
    )

    # Phase 1: Project Comments
    op.create_table(
        "project_comments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("comment_type", sa.String(20), server_default="comment"),
        sa.Column("mentions", postgresql.JSONB(), server_default="[]"),
    )

    # Phase 1: Project Attachments
    op.create_table(
        "project_attachments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )

    # -----------------------------------------------------------------------
    # Phase 2: Templates, Phases, Allocations, Skills
    # -----------------------------------------------------------------------
    op.create_table(
        "project_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("project_categories.id"), nullable=True),
        sa.Column("default_billing_type", sa.String(20), nullable=True),
        sa.Column("template_data", postgresql.JSONB(), server_default="{}"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
    )

    op.create_table(
        "project_phases",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("color", sa.String(20), nullable=True),
    )

    # Add FK for tasks.phase_id now that table exists
    op.create_foreign_key("fk_tasks_phase_id", "tasks", "project_phases", ["phase_id"], ["id"])

    op.create_table(
        "resource_allocations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("hours_per_day", sa.Numeric(4, 2), server_default="8"),
        sa.Column("allocation_percent", sa.Integer(), server_default="100"),
        sa.Column("role", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "user_skills",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_name", sa.String(100), nullable=False),
        sa.Column("proficiency", sa.String(20), server_default="intermediate"),
    )
    op.create_index("ix_user_skills_tenant_user", "user_skills", ["tenant_id", "user_id"])

    # -----------------------------------------------------------------------
    # Phase 3: Finance
    # -----------------------------------------------------------------------
    op.create_table(
        "project_expenses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cost_category_id", sa.Integer(), sa.ForeignKey("cost_categories.id"), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("currency_id", sa.Integer(), sa.ForeignKey("currencies.id"), nullable=True),
        sa.Column("expense_date", sa.Date(), nullable=False),
        sa.Column("vendor_name", sa.String(255), nullable=True),
        sa.Column("receipt_path", sa.String(500), nullable=True),
        sa.Column("is_billable", sa.Boolean(), server_default="false"),
        sa.Column("approval_status", sa.String(20), server_default="pending"),
        sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("expense_claim_id", sa.Integer(), sa.ForeignKey("expense_claims.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "project_budget_lines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cost_category_id", sa.Integer(), sa.ForeignKey("cost_categories.id"), nullable=True),
        sa.Column("planned_amount", sa.Numeric(18, 4), server_default="0"),
        sa.Column("actual_amount", sa.Numeric(18, 4), server_default="0"),
        sa.Column("description", sa.String(255), nullable=True),
    )

    op.create_table(
        "billing_rates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("role_name", sa.String(50), nullable=True),
        sa.Column("hourly_rate", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency_id", sa.Integer(), sa.ForeignKey("currencies.id"), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
    )

    op.create_table(
        "project_invoices",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("milestone_id", sa.Integer(), sa.ForeignKey("milestones.id"), nullable=True),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("paid_date", sa.Date(), nullable=True),
    )

    # -----------------------------------------------------------------------
    # Phase 4: Risk, Issues, Change Requests, Reports, Meetings
    # -----------------------------------------------------------------------
    op.create_table(
        "project_risks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("risk_categories.id"), nullable=True),
        sa.Column("probability", sa.String(20), server_default="medium"),
        sa.Column("impact", sa.String(20), server_default="medium"),
        sa.Column("risk_score", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(20), server_default="identified"),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("mitigation_plan", sa.Text(), nullable=True),
        sa.Column("contingency_plan", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("custom_fields", postgresql.JSONB(), server_default="{}"),
    )

    op.create_table(
        "project_issues",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(20), server_default="medium"),
        sa.Column("status", sa.String(20), server_default="open"),
        sa.Column("assigned_to", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reported_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("related_risk_id", sa.Integer(), sa.ForeignKey("project_risks.id"), nullable=True),
        sa.Column("related_task_id", sa.Integer(), sa.ForeignKey("tasks.id"), nullable=True),
        sa.Column("related_ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=True),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "change_requests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.String(50), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("impact_analysis", sa.Text(), nullable=True),
        sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", sa.String(20), server_default="submitted"),
        sa.Column("priority", sa.String(20), server_default="medium"),
        sa.Column("budget_impact", sa.Numeric(18, 4), nullable=True),
        sa.Column("schedule_impact_days", sa.Integer(), nullable=True),
        sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("implemented_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("tenant_id", "number", name="uq_change_request_number"),
    )

    op.create_table(
        "status_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.String(50), nullable=True),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("period_type", sa.String(20), server_default="weekly"),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("accomplishments", postgresql.JSONB(), server_default="[]"),
        sa.Column("planned_next", postgresql.JSONB(), server_default="[]"),
        sa.Column("risks_issues", postgresql.JSONB(), server_default="[]"),
        sa.Column("kpi_snapshot", postgresql.JSONB(), server_default="{}"),
        sa.Column("status", sa.String(20), server_default="draft"),
    )

    op.create_table(
        "meeting_notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        *_tenant_cols(),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("meeting_date", sa.DateTime(), nullable=True),
        sa.Column("attendees", postgresql.JSONB(), server_default="[]"),
        sa.Column("agenda", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("action_items", postgresql.JSONB(), server_default="[]"),
    )


def downgrade() -> None:
    op.drop_table("meeting_notes")
    op.drop_table("status_reports")
    op.drop_table("change_requests")
    op.drop_table("project_issues")
    op.drop_table("project_risks")
    op.drop_table("project_invoices")
    op.drop_table("billing_rates")
    op.drop_table("project_budget_lines")
    op.drop_table("project_expenses")
    op.drop_index("ix_user_skills_tenant_user", table_name="user_skills")
    op.drop_table("user_skills")
    op.drop_table("resource_allocations")
    op.drop_constraint("fk_tasks_phase_id", "tasks", type_="foreignkey")
    op.drop_table("project_phases")
    op.drop_table("project_templates")
    op.drop_table("project_attachments")
    op.drop_table("project_comments")
    op.drop_table("project_members")
    op.drop_table("task_watchers")
    op.drop_table("task_attachments")
    op.drop_table("task_comments")
    op.drop_table("task_label_assignments")
    op.drop_table("task_checklists")
    op.drop_table("task_dependencies")
    op.drop_column("milestones", "billing_status")
    op.drop_column("milestones", "billing_amount")
    op.drop_column("milestones", "is_billing_milestone")
    op.drop_column("milestones", "completed_at")
    op.drop_column("milestones", "progress")
    op.drop_column("tasks", "required_skills")
    op.drop_column("tasks", "phase_id")
    op.drop_column("tasks", "progress")
    op.drop_column("tasks", "wbs_code")
    op.drop_column("tasks", "completed_at")
    op.drop_column("tasks", "actual_hours")
    op.drop_column("projects", "opportunity_id")
    op.drop_column("projects", "total_hours")
    op.drop_column("projects", "actual_cost")
    op.drop_column("projects", "billing_type")
    op.drop_column("projects", "priority")
    op.drop_column("projects", "category_id")
    op.drop_table("risk_categories")
    op.drop_table("cost_categories")
    op.drop_table("task_labels")
    op.drop_table("project_categories")
