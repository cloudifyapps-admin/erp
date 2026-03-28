from sqlalchemy import Column, Integer, String, Boolean, Text, Date, DateTime, BigInteger, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
from app.models.base import TenantMixin, TimestampMixin


class Ticket(TenantMixin, Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("ticket_categories.id"), nullable=True)
    priority_id = Column(Integer, ForeignKey("ticket_priorities.id"), nullable=True)
    status_id = Column(Integer, ForeignKey("ticket_statuses.id"), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    due_date = Column(Date, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_ticket_number"),
        Index("ix_tickets_composite", "tenant_id", "status_id", "priority_id", "assigned_to"),
    )


class TicketComment(TenantMixin, Base):
    __tablename__ = "ticket_comments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    body = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)


class TicketAttachment(TimestampMixin, Base):
    __tablename__ = "ticket_attachments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
