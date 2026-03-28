from sqlalchemy import Column, Integer, String, Boolean, Text, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
from app.models.base import TenantMixin


class Role(TenantMixin, Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_role_slug"),
    )


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    module = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)

    from app.models.base import TimestampMixin


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "role_id", "tenant_id", name="uq_user_role_tenant"),
    )


class OrganizationSettings(TenantMixin, Base):
    __tablename__ = "organization_settings"

    id = Column(Integer, primary_key=True, index=True)
    # Company
    name = Column(String(255), nullable=True)
    legal_name = Column(String(255), nullable=True)
    logo_path = Column(String(500), nullable=True)
    icon_path = Column(String(500), nullable=True)
    letterhead_path = Column(String(500), nullable=True)
    # Address
    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    # Contact
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    website = Column(String(255), nullable=True)
    fax = Column(String(50), nullable=True)
    # Signatory
    signatory_name = Column(String(255), nullable=True)
    signatory_designation = Column(String(255), nullable=True)
    signatory_signature_path = Column(String(500), nullable=True)
    # Tax & Legal
    tax_id = Column(String(100), nullable=True)
    gst_state_id = Column(Integer, ForeignKey("gst_states.id"), nullable=True)
    lut_arn = Column(String(100), nullable=True)
    lut_date = Column(String(20), nullable=True)
    cin = Column(String(50), nullable=True)
    msme_udyam = Column(String(50), nullable=True)
    pan = Column(String(20), nullable=True)
    tan = Column(String(20), nullable=True)
    # Numbering
    number_series = Column(JSONB, nullable=False, server_default='{}')
    # Defaults
    default_currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    default_timezone = Column(String(100), nullable=True)
    default_country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    default_language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)
    default_date_format = Column(String(20), default="Y-m-d")
    default_number_format = Column(String(20), default="1,000.00")
    fiscal_year_start = Column(Integer, default=1)
    custom_fields = Column(JSONB, server_default='{}')


# Master Data Tables
class UnitOfMeasure(TenantMixin, Base):
    __tablename__ = "units_of_measure"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    abbreviation = Column(String(20), nullable=True)
    type = Column(String(50), nullable=True)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_uom_slug"),
    )


class TaxRegion(TenantMixin, Base):
    __tablename__ = "tax_regions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tax_region_code"),
    )


class TaxType(TenantMixin, Base):
    __tablename__ = "tax_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    rate = Column(Numeric(8, 4), nullable=False)
    tax_region_id = Column(Integer, ForeignKey("tax_regions.id"), nullable=True)
    is_compound = Column(Boolean, default=False)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class ProductCategory(TenantMixin, Base):
    __tablename__ = "product_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    parent_id = Column(Integer, ForeignKey("product_categories.id"), nullable=True)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_product_category_slug"),
    )


class ProductBrand(TenantMixin, Base):
    __tablename__ = "product_brands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    logo_url = Column(String(500), nullable=True)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class LeadSource(TenantMixin, Base):
    __tablename__ = "lead_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class LeadStatus(TenantMixin, Base):
    __tablename__ = "lead_statuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    color = Column(String(20), nullable=True)
    is_default = Column(Boolean, default=False)
    is_won = Column(Boolean, default=False)
    is_lost = Column(Boolean, default=False)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class OpportunityStage(TenantMixin, Base):
    __tablename__ = "opportunity_stages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    color = Column(String(20), nullable=True)
    probability = Column(Integer, default=0)
    is_won = Column(Boolean, default=False)
    is_lost = Column(Boolean, default=False)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class ActivityType(TenantMixin, Base):
    __tablename__ = "activity_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    icon = Column(String(50), nullable=True)
    color = Column(String(20), nullable=True)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class TaskStatus(TenantMixin, Base):
    __tablename__ = "task_statuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    color = Column(String(20), nullable=True)
    is_default = Column(Boolean, default=False)
    is_closed = Column(Boolean, default=False)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class TicketStatus(TenantMixin, Base):
    __tablename__ = "ticket_statuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    color = Column(String(20), nullable=True)
    is_default = Column(Boolean, default=False)
    is_closed = Column(Boolean, default=False)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class TicketPriority(TenantMixin, Base):
    __tablename__ = "ticket_priorities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    color = Column(String(20), nullable=True)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class TicketCategory(TenantMixin, Base):
    __tablename__ = "ticket_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class DocumentCategory(TenantMixin, Base):
    __tablename__ = "document_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class Salutation(TenantMixin, Base):
    __tablename__ = "salutations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)


class LeaveType(TenantMixin, Base):
    __tablename__ = "leave_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
