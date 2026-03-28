from sqlalchemy import Column, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import declared_attr


class TimestampMixin:
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class TenantMixin(TimestampMixin):
    @declared_attr
    def tenant_id(cls):
        return Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    @declared_attr
    def created_by(cls):
        return Column(Integer, ForeignKey("users.id"), nullable=False)

    @declared_attr
    def updated_by(cls):
        return Column(Integer, ForeignKey("users.id"), nullable=False)
