from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Numeric, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
from app.models.base import TenantMixin, TimestampMixin


class Vendor(TenantMixin, Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    website = Column(String(255), nullable=True)
    tax_id = Column(String(100), nullable=True)
    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    status = Column(String(20), default="active")
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_vendor_code"),
    )


class PurchaseRequest(TenantMixin, Base):
    __tablename__ = "purchase_requests"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    required_date = Column(Date, nullable=True)
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="draft")
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_purchase_request_number"),
    )


class PurchaseOrder(TenantMixin, Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    purchase_request_id = Column(Integer, ForeignKey("purchase_requests.id"), nullable=True)
    order_date = Column(Date, nullable=False)
    expected_date = Column(Date, nullable=True)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    exchange_rate = Column(Numeric(18, 8), default=1.0)
    subtotal = Column(Numeric(18, 4), default=0)
    tax_amount = Column(Numeric(18, 4), default=0)
    discount_amount = Column(Numeric(18, 4), default=0)
    total = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="draft")
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_purchase_order_number"),
        Index("ix_purchase_orders_tenant_status", "tenant_id", "status"),
    )


class PurchaseOrderItem(TimestampMixin, Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    unit_id = Column(Integer, ForeignKey("units_of_measure.id"), nullable=True)
    unit_price = Column(Numeric(18, 4), nullable=False)
    discount_percent = Column(Numeric(8, 4), default=0)
    tax_percent = Column(Numeric(8, 4), default=0)
    line_total = Column(Numeric(18, 4), nullable=False)
    received_quantity = Column(Numeric(18, 4), default=0)
    sort_order = Column(Integer, default=0)


class GoodsReceipt(TenantMixin, Base):
    __tablename__ = "goods_receipts"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=False)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    receipt_date = Column(Date, nullable=False)
    status = Column(String(20), default="pending")
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_goods_receipt_number"),
    )


class GoodsReceiptItem(TimestampMixin, Base):
    __tablename__ = "goods_receipt_items"

    id = Column(Integer, primary_key=True, index=True)
    goods_receipt_id = Column(Integer, ForeignKey("goods_receipts.id", ondelete="CASCADE"), nullable=False)
    purchase_order_item_id = Column(Integer, ForeignKey("purchase_order_items.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    notes = Column(Text, nullable=True)
