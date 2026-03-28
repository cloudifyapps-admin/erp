from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Boolean, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
from app.models.base import TenantMixin, TimestampMixin


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
    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    source = Column(String(50), nullable=True)
    status = Column(String(50), default="new")
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')
    converted_to_contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    converted_to_customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    converted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_leads_tenant_status", "tenant_id", "status"),
        Index("ix_leads_tenant_assigned", "tenant_id", "assigned_to"),
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
    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    custom_fields = Column(JSONB, server_default='{}')


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
    title = Column(String(255), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    expected_amount = Column(Integer, nullable=True)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    stage = Column(String(50), default="qualification")
    probability = Column(Integer, default=0)
    expected_close_date = Column(Date, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')
    sort_order = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_opportunities_tenant_stage", "tenant_id", "stage"),
    )


class Activity(TenantMixin, Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    activitable_type = Column(String(255), nullable=True)
    activitable_id = Column(Integer, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    due_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending")

    __table_args__ = (
        Index("ix_activities_poly", "activitable_type", "activitable_id"),
        Index("ix_activities_tenant_status", "tenant_id", "status"),
    )
