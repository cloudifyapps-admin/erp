from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Numeric, ForeignKey, Boolean, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
from app.models.base import TenantMixin, TimestampMixin


# ---------------------------------------------------------------------------
# Core CRM Entities
# ---------------------------------------------------------------------------


class Lead(TenantMixin, Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    salutation_id = Column(Integer, ForeignKey("salutations.id"), nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    mobile = Column(String(50), nullable=True)
    company = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    # Classification (FK-based for tenant-scoped configurability)
    source = Column(String(50), nullable=True)  # legacy — kept for migration
    source_id = Column(Integer, ForeignKey("lead_sources.id"), nullable=True)
    status = Column(String(50), default="new")  # legacy — kept for migration
    status_id = Column(Integer, ForeignKey("lead_statuses.id"), nullable=True)
    industry_id = Column(Integer, ForeignKey("industries.id"), nullable=True)
    rating_id = Column(Integer, ForeignKey("customer_ratings.id"), nullable=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    territory_id = Column(Integer, ForeignKey("territories.id"), nullable=True)
    # Scoring
    lead_score = Column(Integer, default=0)
    score_details = Column(JSONB, server_default='{}')
    # Firmographics
    annual_revenue = Column(Numeric(18, 2), nullable=True)
    employee_count = Column(Integer, nullable=True)
    # Assignment & follow-up
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_activity_at = Column(DateTime, nullable=True)
    next_follow_up_at = Column(DateTime, nullable=True)
    # Notes & custom
    notes = Column(Text, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')
    # Conversion tracking
    converted_to_contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    converted_to_customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    converted_to_opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=True)
    converted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_leads_tenant_status", "tenant_id", "status"),
        Index("ix_leads_tenant_assigned", "tenant_id", "assigned_to"),
        Index("ix_leads_tenant_score", "tenant_id", "lead_score"),
        Index("ix_leads_next_followup", "tenant_id", "next_follow_up_at"),
    )


class Contact(TenantMixin, Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    salutation_id = Column(Integer, ForeignKey("salutations.id"), nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    mobile = Column(String(50), nullable=True)
    company = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    department = Column(String(100), nullable=True)
    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    # Status & preferences
    status = Column(String(20), default="active")
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    do_not_email = Column(Boolean, default=False)
    do_not_call = Column(Boolean, default=False)
    last_activity_at = Column(DateTime, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        Index("ix_contacts_tenant_email", "tenant_id", "email"),
    )


class Customer(TenantMixin, Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    code = Column(String(50), nullable=False)
    type = Column(String(20), nullable=False, default="company")
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    website = Column(String(255), nullable=True)
    tax_id = Column(String(100), nullable=True)
    # Billing
    billing_attention = Column(String(255), nullable=True)
    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    billing_phone = Column(String(50), nullable=True)
    # Shipping
    shipping_attention = Column(String(255), nullable=True)
    shipping_address_line_1 = Column(String(255), nullable=True)
    shipping_address_line_2 = Column(String(255), nullable=True)
    shipping_city = Column(String(100), nullable=True)
    shipping_state = Column(String(100), nullable=True)
    shipping_postal_code = Column(String(20), nullable=True)
    shipping_country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    shipping_phone = Column(String(50), nullable=True)
    # Settings
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    # Enterprise classification
    industry_id = Column(Integer, ForeignKey("industries.id"), nullable=True)
    rating_id = Column(Integer, ForeignKey("customer_ratings.id"), nullable=True)
    territory_id = Column(Integer, ForeignKey("territories.id"), nullable=True)
    parent_customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    annual_revenue = Column(Numeric(18, 2), nullable=True)
    employee_count = Column(Integer, nullable=True)
    account_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_activity_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="active")
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_customer_code"),
        Index("ix_customers_tenant_email", "tenant_id", "email"),
        Index("ix_customers_tenant_status", "tenant_id", "status"),
    )


class CustomerContact(TimestampMixin, Base):
    __tablename__ = "customer_contacts"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(100), nullable=True)
    is_primary = Column(Boolean, default=False)


class Opportunity(TenantMixin, Base):
    __tablename__ = "opportunities"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=True)
    title = Column(String(255), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    expected_amount = Column(Integer, nullable=True)
    weighted_amount = Column(Numeric(18, 2), nullable=True)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    # Stage (FK-based for tenant-scoped configurability)
    stage = Column(String(50), default="qualification")  # legacy — kept for migration
    stage_id = Column(Integer, ForeignKey("opportunity_stages.id"), nullable=True)
    probability = Column(Integer, default=0)
    expected_close_date = Column(Date, nullable=True)
    # Campaign & territory
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    territory_id = Column(Integer, ForeignKey("territories.id"), nullable=True)
    # Win/loss tracking
    lost_reason_id = Column(Integer, ForeignKey("lost_reasons.id"), nullable=True)
    lost_reason_detail = Column(Text, nullable=True)
    won_at = Column(DateTime, nullable=True)
    lost_at = Column(DateTime, nullable=True)
    # Assignment & follow-up
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_activity_at = Column(DateTime, nullable=True)
    next_follow_up_at = Column(DateTime, nullable=True)
    # Link to quotation
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=True)
    notes = Column(Text, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')
    sort_order = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_opportunities_tenant_stage", "tenant_id", "stage"),
        Index("ix_opportunities_close_date", "tenant_id", "expected_close_date"),
        Index("ix_opportunities_weighted", "tenant_id", "weighted_amount"),
    )


class Activity(TenantMixin, Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # Polymorphic link (lead, contact, customer, opportunity)
    activitable_type = Column(String(255), nullable=True)
    activitable_id = Column(Integer, nullable=True)
    # Direct contact link
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    # Scheduling
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    due_at = Column(DateTime, nullable=True)
    start_at = Column(DateTime, nullable=True)
    end_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending")
    # Outcome & details
    outcome = Column(String(50), nullable=True)
    location = Column(String(255), nullable=True)
    # Reminder
    reminder_at = Column(DateTime, nullable=True)
    is_reminder_sent = Column(Boolean, default=False)

    __table_args__ = (
        Index("ix_activities_poly", "activitable_type", "activitable_id"),
        Index("ix_activities_tenant_status", "tenant_id", "status"),
    )


# ---------------------------------------------------------------------------
# Opportunity Sub-Entities
# ---------------------------------------------------------------------------


class OpportunityCompetitor(TimestampMixin, Base):
    __tablename__ = "opportunity_competitors"

    id = Column(Integer, primary_key=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    competitor_id = Column(Integer, ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False)
    strengths = Column(Text, nullable=True)
    weaknesses = Column(Text, nullable=True)
    status = Column(String(20), default="active")  # active, eliminated


class OpportunityProduct(TimestampMixin, Base):
    __tablename__ = "opportunity_products"

    id = Column(Integer, primary_key=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(18, 4), default=1)
    unit_price = Column(Numeric(18, 2), default=0)
    total = Column(Numeric(18, 2), default=0)
    notes = Column(Text, nullable=True)


# ---------------------------------------------------------------------------
# Tags (Polymorphic)
# ---------------------------------------------------------------------------


class Tag(TenantMixin, Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    color = Column(String(20), nullable=True)
    slug = Column(String(100), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_tag_slug"),
    )


class EntityTag(TimestampMixin, Base):
    __tablename__ = "entity_tags"

    id = Column(Integer, primary_key=True, index=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)

    __table_args__ = (
        Index("ix_entity_tags_poly", "entity_type", "entity_id"),
        UniqueConstraint("tag_id", "entity_type", "entity_id", name="uq_entity_tag"),
    )


# ---------------------------------------------------------------------------
# Notes (Timeline)
# ---------------------------------------------------------------------------


class Note(TenantMixin, Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    is_pinned = Column(Boolean, default=False)

    __table_args__ = (
        Index("ix_notes_poly", "entity_type", "entity_id"),
    )


# ---------------------------------------------------------------------------
# Audit Log
# ---------------------------------------------------------------------------


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    action = Column(String(20), nullable=False)  # create, update, delete
    changes = Column(JSONB, server_default='{}')  # {field: {old, new}}
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default="now()")

    __table_args__ = (
        Index("ix_audit_logs_entity", "tenant_id", "entity_type", "entity_id"),
        Index("ix_audit_logs_created", "tenant_id", "created_at"),
    )


# ---------------------------------------------------------------------------
# Email Templates
# ---------------------------------------------------------------------------


class EmailTemplate(TenantMixin, Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    html_body = Column(Text, nullable=False)
    text_body = Column(Text, nullable=True)
    category = Column(String(50), nullable=False)  # lead_assignment, follow_up_reminder, stage_change, deal_won, deal_lost, welcome, custom
    variables = Column(JSONB, server_default='[]')  # list of placeholder names
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_email_template_slug"),
    )


# ---------------------------------------------------------------------------
# Lead Scoring Rules
# ---------------------------------------------------------------------------


class LeadScoringRule(TenantMixin, Base):
    __tablename__ = "lead_scoring_rules"

    id = Column(Integer, primary_key=True, index=True)
    field = Column(String(100), nullable=False)  # e.g. "email", "phone", "company", "industry_id", "annual_revenue"
    operator = Column(String(50), nullable=False)  # is_set, equals, contains, greater_than, less_than
    value = Column(String(255), nullable=True)  # comparison value (null for is_set)
    score = Column(Integer, nullable=False, default=0)  # points to add (negative to subtract)
    category = Column(String(50), default="demographic")  # demographic, behavioral
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


# ---------------------------------------------------------------------------
# Web-to-Lead Forms
# ---------------------------------------------------------------------------


class WebForm(TenantMixin, Base):
    __tablename__ = "web_forms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    api_key = Column(String(64), unique=True, nullable=False)
    fields = Column(JSONB, server_default='[]')  # list of field configs to capture
    default_assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    default_source_id = Column(Integer, ForeignKey("lead_sources.id"), nullable=True)
    redirect_url = Column(String(500), nullable=True)
    thank_you_message = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
