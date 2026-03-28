from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, Numeric, Text, UniqueConstraint, Index, func
from app.core.database import Base
from app.models.base import TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email_verified_at = Column(DateTime, nullable=True)
    current_tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    profile_photo_path = Column(String(255), nullable=True)


class Tenant(TimestampMixin, Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    personal_tenant = Column(Boolean, default=False)


class TenantUser(TimestampMixin, Base):
    __tablename__ = "tenant_users"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False, default="employee")

    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uq_tenant_user"),
    )


class TeamInvitation(TimestampMixin, Base):
    __tablename__ = "team_invitations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, accepted, expired, revoked
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_invitation_tenant_email", "tenant_id", "email"),
    )


class Country(TimestampMixin, Base):
    __tablename__ = "countries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(3), unique=True, nullable=False)
    phone_code = Column(String(10), nullable=True)
    flag_emoji = Column(String(10), nullable=True)
    is_active = Column(Boolean, default=True)


class Currency(TimestampMixin, Base):
    __tablename__ = "currencies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(3), unique=True, nullable=False)
    symbol = Column(String(10), nullable=False)
    decimal_places = Column(Integer, default=2)
    is_active = Column(Boolean, default=True)


class Language(TimestampMixin, Base):
    __tablename__ = "languages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(10), unique=True, nullable=False)
    direction = Column(String(3), default="ltr")
    is_active = Column(Boolean, default=True)


class Translation(TimestampMixin, Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, index=True)
    language_id = Column(Integer, ForeignKey("languages.id", ondelete="CASCADE"), nullable=False)
    group = Column(String(100), nullable=False)
    key = Column(String(255), nullable=False)
    value = Column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint("language_id", "group", "key", name="uq_translation"),
    )


class ExchangeRate(TimestampMixin, Base):
    __tablename__ = "exchange_rates"

    id = Column(Integer, primary_key=True, index=True)
    base_currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    target_currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    rate = Column(Numeric(18, 8), nullable=False)
    effective_date = Column(Date, nullable=False)

    __table_args__ = (
        Index("ix_exchange_rate_lookup", "base_currency_id", "target_currency_id", "effective_date"),
    )


class GstState(TimestampMixin, Base):
    __tablename__ = "gst_states"

    id = Column(Integer, primary_key=True, index=True)
    state_name = Column(String(255), nullable=False)
    state_code = Column(String(2), unique=True, nullable=False)
    alpha_code = Column(String(5), nullable=True)
    is_union_territory = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
