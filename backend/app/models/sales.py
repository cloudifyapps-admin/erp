from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Boolean, Numeric, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
from app.models.base import TenantMixin, TimestampMixin


class Quotation(TenantMixin, Base):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=True)
    issue_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    exchange_rate = Column(Numeric(18, 8), default=1.0)
    subtotal = Column(Numeric(18, 4), default=0)
    tax_amount = Column(Numeric(18, 4), default=0)
    discount_amount = Column(Numeric(18, 4), default=0)
    total = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="draft")
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_quotation_number"),
        Index("ix_quotations_tenant_status", "tenant_id", "status"),
    )


class QuotationItem(TimestampMixin, Base):
    __tablename__ = "quotation_items"

    id = Column(Integer, primary_key=True, index=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    unit_id = Column(Integer, ForeignKey("units_of_measure.id"), nullable=True)
    unit_price = Column(Numeric(18, 4), nullable=False)
    discount_percent = Column(Numeric(8, 4), default=0)
    tax_percent = Column(Numeric(8, 4), default=0)
    line_total = Column(Numeric(18, 4), nullable=False)
    sort_order = Column(Integer, default=0)


class SalesOrder(TenantMixin, Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=True)
    order_date = Column(Date, nullable=False)
    expected_date = Column(Date, nullable=True)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    exchange_rate = Column(Numeric(18, 8), default=1.0)
    subtotal = Column(Numeric(18, 4), default=0)
    tax_amount = Column(Numeric(18, 4), default=0)
    discount_amount = Column(Numeric(18, 4), default=0)
    total = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="draft")
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    shipping_address = Column(Text, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_sales_order_number"),
        Index("ix_sales_orders_tenant_status", "tenant_id", "status"),
    )


class SalesOrderItem(TimestampMixin, Base):
    __tablename__ = "sales_order_items"

    id = Column(Integer, primary_key=True, index=True)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    unit_id = Column(Integer, ForeignKey("units_of_measure.id"), nullable=True)
    unit_price = Column(Numeric(18, 4), nullable=False)
    discount_percent = Column(Numeric(8, 4), default=0)
    tax_percent = Column(Numeric(8, 4), default=0)
    line_total = Column(Numeric(18, 4), nullable=False)
    delivered_quantity = Column(Numeric(18, 4), default=0)
    sort_order = Column(Integer, default=0)


class Delivery(TenantMixin, Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=False)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    delivery_date = Column(Date, nullable=False)
    status = Column(String(20), default="pending")
    shipping_address = Column(Text, nullable=True)
    tracking_number = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_delivery_number"),
    )


class DeliveryItem(TimestampMixin, Base):
    __tablename__ = "delivery_items"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id", ondelete="CASCADE"), nullable=False)
    sales_order_item_id = Column(Integer, ForeignKey("sales_order_items.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    notes = Column(Text, nullable=True)


class Invoice(TenantMixin, Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=False)
    type = Column(String(20), nullable=False, default="tax")
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=True)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    currency_id = Column(Integer, ForeignKey("currencies.id", ondelete="CASCADE"), nullable=False)
    exchange_rate = Column(Numeric(18, 8), default=1.0)
    subtotal = Column(Numeric(18, 4), default=0)
    tax_amount = Column(Numeric(18, 4), default=0)
    discount_amount = Column(Numeric(18, 4), default=0)
    total = Column(Numeric(18, 4), default=0)
    paid_amount = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="draft")
    # Recurring
    is_recurring = Column(Boolean, default=False)
    recurring_frequency = Column(String(20), nullable=True)
    recurring_start_date = Column(Date, nullable=True)
    recurring_end_date = Column(Date, nullable=True)
    next_recurring_date = Column(Date, nullable=True)
    parent_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    recurring_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_invoice_number"),
        Index("ix_invoices_tenant_type_status", "tenant_id", "type", "status"),
    )


class InvoiceItem(TimestampMixin, Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    unit_id = Column(Integer, ForeignKey("units_of_measure.id"), nullable=True)
    unit_price = Column(Numeric(18, 4), nullable=False)
    discount_percent = Column(Numeric(8, 4), default=0)
    tax_percent = Column(Numeric(8, 4), default=0)
    line_total = Column(Numeric(18, 4), nullable=False)
    sort_order = Column(Integer, default=0)
