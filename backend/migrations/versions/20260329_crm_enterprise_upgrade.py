"""CRM enterprise upgrade — new master data, enriched models, tags, notes, audit, scoring, email templates, web forms

Revision ID: b5e9c3d2f6a7
Revises: a3f8b2c1d4e5
Create Date: 2026-03-29 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b5e9c3d2f6a7"
down_revision = "a3f8b2c1d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # New master data lookup tables
    # -----------------------------------------------------------------------
    op.create_table(
        "industries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_industry_slug"),
    )

    op.create_table(
        "customer_ratings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_customer_rating_slug"),
    )

    op.create_table(
        "lost_reasons",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_lost_reason_slug"),
    )

    op.create_table(
        "competitors",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("strengths", sa.Text(), nullable=True),
        sa.Column("weaknesses", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
    )

    op.create_table(
        "territories",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=True),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("territories.id"), nullable=True),
        sa.Column("manager_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_territory_slug"),
    )

    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("type", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("budget", sa.Numeric(18, 2), nullable=True),
        sa.Column("actual_cost", sa.Numeric(18, 2), nullable=True),
        sa.Column("expected_revenue", sa.Numeric(18, 2), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("custom_fields", postgresql.JSONB(), server_default="{}"),
        sa.UniqueConstraint("tenant_id", "code", name="uq_campaign_code"),
    )

    # -----------------------------------------------------------------------
    # Enrich existing CRM tables — add new columns
    # -----------------------------------------------------------------------

    # -- Leads --
    op.add_column("leads", sa.Column("source_id", sa.Integer(), sa.ForeignKey("lead_sources.id"), nullable=True))
    op.add_column("leads", sa.Column("status_id", sa.Integer(), sa.ForeignKey("lead_statuses.id"), nullable=True))
    op.add_column("leads", sa.Column("industry_id", sa.Integer(), sa.ForeignKey("industries.id"), nullable=True))
    op.add_column("leads", sa.Column("rating_id", sa.Integer(), sa.ForeignKey("customer_ratings.id"), nullable=True))
    op.add_column("leads", sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=True))
    op.add_column("leads", sa.Column("territory_id", sa.Integer(), sa.ForeignKey("territories.id"), nullable=True))
    op.add_column("leads", sa.Column("lead_score", sa.Integer(), server_default="0"))
    op.add_column("leads", sa.Column("score_details", postgresql.JSONB(), server_default="{}"))
    op.add_column("leads", sa.Column("website", sa.String(255), nullable=True))
    op.add_column("leads", sa.Column("annual_revenue", sa.Numeric(18, 2), nullable=True))
    op.add_column("leads", sa.Column("employee_count", sa.Integer(), nullable=True))
    op.add_column("leads", sa.Column("last_activity_at", sa.DateTime(), nullable=True))
    op.add_column("leads", sa.Column("next_follow_up_at", sa.DateTime(), nullable=True))
    op.add_column("leads", sa.Column("converted_to_opportunity_id", sa.Integer(), sa.ForeignKey("opportunities.id"), nullable=True))
    op.create_index("ix_leads_tenant_score", "leads", ["tenant_id", "lead_score"])
    op.create_index("ix_leads_next_followup", "leads", ["tenant_id", "next_follow_up_at"])

    # -- Contacts --
    op.add_column("contacts", sa.Column("status", sa.String(20), server_default="active"))
    op.add_column("contacts", sa.Column("lead_id", sa.Integer(), sa.ForeignKey("leads.id"), nullable=True))
    op.add_column("contacts", sa.Column("department", sa.String(100), nullable=True))
    op.add_column("contacts", sa.Column("do_not_email", sa.Boolean(), server_default="false"))
    op.add_column("contacts", sa.Column("do_not_call", sa.Boolean(), server_default="false"))
    op.add_column("contacts", sa.Column("last_activity_at", sa.DateTime(), nullable=True))
    op.create_index("ix_contacts_tenant_email", "contacts", ["tenant_id", "email"])

    # -- Customers --
    op.add_column("customers", sa.Column("industry_id", sa.Integer(), sa.ForeignKey("industries.id"), nullable=True))
    op.add_column("customers", sa.Column("rating_id", sa.Integer(), sa.ForeignKey("customer_ratings.id"), nullable=True))
    op.add_column("customers", sa.Column("territory_id", sa.Integer(), sa.ForeignKey("territories.id"), nullable=True))
    op.add_column("customers", sa.Column("parent_customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=True))
    op.add_column("customers", sa.Column("annual_revenue", sa.Numeric(18, 2), nullable=True))
    op.add_column("customers", sa.Column("employee_count", sa.Integer(), nullable=True))
    op.add_column("customers", sa.Column("account_manager_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("customers", sa.Column("last_activity_at", sa.DateTime(), nullable=True))

    # -- Opportunities --
    op.add_column("opportunities", sa.Column("code", sa.String(50), nullable=True))
    op.add_column("opportunities", sa.Column("weighted_amount", sa.Numeric(18, 2), nullable=True))
    op.add_column("opportunities", sa.Column("stage_id", sa.Integer(), sa.ForeignKey("opportunity_stages.id"), nullable=True))
    op.add_column("opportunities", sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=True))
    op.add_column("opportunities", sa.Column("territory_id", sa.Integer(), sa.ForeignKey("territories.id"), nullable=True))
    op.add_column("opportunities", sa.Column("lost_reason_id", sa.Integer(), sa.ForeignKey("lost_reasons.id"), nullable=True))
    op.add_column("opportunities", sa.Column("lost_reason_detail", sa.Text(), nullable=True))
    op.add_column("opportunities", sa.Column("won_at", sa.DateTime(), nullable=True))
    op.add_column("opportunities", sa.Column("lost_at", sa.DateTime(), nullable=True))
    op.add_column("opportunities", sa.Column("last_activity_at", sa.DateTime(), nullable=True))
    op.add_column("opportunities", sa.Column("next_follow_up_at", sa.DateTime(), nullable=True))
    op.add_column("opportunities", sa.Column("quotation_id", sa.Integer(), sa.ForeignKey("quotations.id"), nullable=True))
    op.create_index("ix_opportunities_close_date", "opportunities", ["tenant_id", "expected_close_date"])
    op.create_index("ix_opportunities_weighted", "opportunities", ["tenant_id", "weighted_amount"])

    # -- Activities --
    op.add_column("activities", sa.Column("contact_id", sa.Integer(), sa.ForeignKey("contacts.id"), nullable=True))
    op.add_column("activities", sa.Column("outcome", sa.String(50), nullable=True))
    op.add_column("activities", sa.Column("location", sa.String(255), nullable=True))
    op.add_column("activities", sa.Column("start_at", sa.DateTime(), nullable=True))
    op.add_column("activities", sa.Column("end_at", sa.DateTime(), nullable=True))
    op.add_column("activities", sa.Column("reminder_at", sa.DateTime(), nullable=True))
    op.add_column("activities", sa.Column("is_reminder_sent", sa.Boolean(), server_default="false"))

    # -----------------------------------------------------------------------
    # New CRM entities
    # -----------------------------------------------------------------------

    op.create_table(
        "opportunity_competitors",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("opportunity_id", sa.Integer(), sa.ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("competitor_id", sa.Integer(), sa.ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("strengths", sa.Text(), nullable=True),
        sa.Column("weaknesses", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active"),
    )

    op.create_table(
        "opportunity_products",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("opportunity_id", sa.Integer(), sa.ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), server_default="1"),
        sa.Column("unit_price", sa.Numeric(18, 2), server_default="0"),
        sa.Column("total", sa.Numeric(18, 2), server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("slug", sa.String(100), nullable=True),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_tag_slug"),
    )

    op.create_table(
        "entity_tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.UniqueConstraint("tag_id", "entity_type", "entity_id", name="uq_entity_tag"),
    )
    op.create_index("ix_entity_tags_poly", "entity_tags", ["entity_type", "entity_id"])

    op.create_table(
        "notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), server_default="false"),
    )
    op.create_index("ix_notes_poly", "notes", ["entity_type", "entity_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("changes", postgresql.JSONB(), server_default="{}"),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_logs_entity", "audit_logs", ["tenant_id", "entity_type", "entity_id"])
    op.create_index("ix_audit_logs_created", "audit_logs", ["tenant_id", "created_at"])

    op.create_table(
        "email_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("html_body", sa.Text(), nullable=False),
        sa.Column("text_body", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("variables", postgresql.JSONB(), server_default="[]"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_email_template_slug"),
    )

    op.create_table(
        "lead_scoring_rules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("field", sa.String(100), nullable=False),
        sa.Column("operator", sa.String(50), nullable=False),
        sa.Column("value", sa.String(255), nullable=True),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("category", sa.String(50), server_default="demographic"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
    )

    op.create_table(
        "web_forms",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("api_key", sa.String(64), unique=True, nullable=False),
        sa.Column("fields", postgresql.JSONB(), server_default="[]"),
        sa.Column("default_assigned_to", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("default_source_id", sa.Integer(), sa.ForeignKey("lead_sources.id"), nullable=True),
        sa.Column("redirect_url", sa.String(500), nullable=True),
        sa.Column("thank_you_message", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
    )


def downgrade() -> None:
    # Drop new tables
    op.drop_table("web_forms")
    op.drop_table("lead_scoring_rules")
    op.drop_table("email_templates")
    op.drop_index("ix_audit_logs_created", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_notes_poly", table_name="notes")
    op.drop_table("notes")
    op.drop_index("ix_entity_tags_poly", table_name="entity_tags")
    op.drop_table("entity_tags")
    op.drop_table("tags")
    op.drop_table("opportunity_products")
    op.drop_table("opportunity_competitors")

    # Drop added columns — activities
    op.drop_column("activities", "is_reminder_sent")
    op.drop_column("activities", "reminder_at")
    op.drop_column("activities", "end_at")
    op.drop_column("activities", "start_at")
    op.drop_column("activities", "location")
    op.drop_column("activities", "outcome")
    op.drop_column("activities", "contact_id")

    # Drop added columns — opportunities
    op.drop_index("ix_opportunities_weighted", table_name="opportunities")
    op.drop_index("ix_opportunities_close_date", table_name="opportunities")
    op.drop_column("opportunities", "quotation_id")
    op.drop_column("opportunities", "next_follow_up_at")
    op.drop_column("opportunities", "last_activity_at")
    op.drop_column("opportunities", "lost_at")
    op.drop_column("opportunities", "won_at")
    op.drop_column("opportunities", "lost_reason_detail")
    op.drop_column("opportunities", "lost_reason_id")
    op.drop_column("opportunities", "territory_id")
    op.drop_column("opportunities", "campaign_id")
    op.drop_column("opportunities", "stage_id")
    op.drop_column("opportunities", "weighted_amount")
    op.drop_column("opportunities", "code")

    # Drop added columns — customers
    op.drop_column("customers", "last_activity_at")
    op.drop_column("customers", "account_manager_id")
    op.drop_column("customers", "employee_count")
    op.drop_column("customers", "annual_revenue")
    op.drop_column("customers", "parent_customer_id")
    op.drop_column("customers", "territory_id")
    op.drop_column("customers", "rating_id")
    op.drop_column("customers", "industry_id")

    # Drop added columns — contacts
    op.drop_index("ix_contacts_tenant_email", table_name="contacts")
    op.drop_column("contacts", "last_activity_at")
    op.drop_column("contacts", "do_not_call")
    op.drop_column("contacts", "do_not_email")
    op.drop_column("contacts", "department")
    op.drop_column("contacts", "lead_id")
    op.drop_column("contacts", "status")

    # Drop added columns — leads
    op.drop_index("ix_leads_next_followup", table_name="leads")
    op.drop_index("ix_leads_tenant_score", table_name="leads")
    op.drop_column("leads", "converted_to_opportunity_id")
    op.drop_column("leads", "next_follow_up_at")
    op.drop_column("leads", "last_activity_at")
    op.drop_column("leads", "employee_count")
    op.drop_column("leads", "annual_revenue")
    op.drop_column("leads", "website")
    op.drop_column("leads", "score_details")
    op.drop_column("leads", "lead_score")
    op.drop_column("leads", "territory_id")
    op.drop_column("leads", "campaign_id")
    op.drop_column("leads", "rating_id")
    op.drop_column("leads", "industry_id")
    op.drop_column("leads", "status_id")
    op.drop_column("leads", "source_id")

    # Drop master data tables
    op.drop_table("campaigns")
    op.drop_table("territories")
    op.drop_table("competitors")
    op.drop_table("lost_reasons")
    op.drop_table("customer_ratings")
    op.drop_table("industries")
