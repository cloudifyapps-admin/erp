from sqlalchemy import Column, Integer, String, Text, BigInteger, ForeignKey, Index
from app.core.database import Base
from app.models.base import TenantMixin, TimestampMixin


class Document(TenantMixin, Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    documentable_type = Column(String(255), nullable=True)
    documentable_id = Column(Integer, nullable=True)
    category = Column(String(100), nullable=True)

    __table_args__ = (
        Index("ix_documents_poly", "documentable_type", "documentable_id"),
        Index("ix_documents_tenant_category", "tenant_id", "category"),
    )


class Attachment(TimestampMixin, Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
