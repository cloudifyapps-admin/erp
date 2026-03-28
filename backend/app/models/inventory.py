from sqlalchemy import Column, Integer, String, Boolean, Text, Date, DateTime, ForeignKey, Numeric, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
from app.models.base import TenantMixin, TimestampMixin


class Product(TenantMixin, Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    sku = Column(String(100), nullable=True)
    barcode = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    type = Column(String(20), nullable=False, default="product")
    category_id = Column(Integer, ForeignKey("product_categories.id"), nullable=True)
    unit_id = Column(Integer, ForeignKey("units_of_measure.id"), nullable=True)
    purchase_price = Column(Numeric(18, 4), default=0)
    selling_price = Column(Numeric(18, 4), default=0)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    tax_type_id = Column(Integer, ForeignKey("tax_types.id"), nullable=True)
    track_inventory = Column(Boolean, default=True)
    reorder_level = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="active")
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "sku", name="uq_product_sku"),
        Index("ix_products_tenant_status", "tenant_id", "status"),
    )


class ProductVariant(TenantMixin, Base):
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    sku = Column(String(100), nullable=True)
    price_adjustment = Column(Numeric(18, 4), default=0)
    attributes = Column(JSONB, server_default='{}')
    is_active = Column(Boolean, default=True)


class Warehouse(TenantMixin, Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_warehouse_code"),
    )


class StockMovement(TenantMixin, Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    unit_cost = Column(Numeric(18, 4), nullable=True)
    reference_type = Column(String(255), nullable=True)
    reference_id = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        Index("ix_stock_movements_product_wh", "product_id", "warehouse_id"),
        Index("ix_stock_movements_ref", "reference_type", "reference_id"),
    )


class StockLevel(TenantMixin, Base):
    __tablename__ = "stock_levels"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(18, 4), default=0)
    reserved_quantity = Column(Numeric(18, 4), default=0)
    available_quantity = Column(Numeric(18, 4), default=0)

    __table_args__ = (
        UniqueConstraint("tenant_id", "product_id", "warehouse_id", name="uq_stock_level"),
    )


class StockAdjustment(TenantMixin, Base):
    __tablename__ = "stock_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    reference_number = Column(String(50), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), default="draft")
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)


class StockAdjustmentItem(TimestampMixin, Base):
    __tablename__ = "stock_adjustment_items"

    id = Column(Integer, primary_key=True, index=True)
    stock_adjustment_id = Column(Integer, ForeignKey("stock_adjustments.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    expected_quantity = Column(Numeric(18, 4), default=0)
    actual_quantity = Column(Numeric(18, 4), default=0)
    difference = Column(Numeric(18, 4), default=0)
    notes = Column(Text, nullable=True)


class StockTransfer(TenantMixin, Base):
    __tablename__ = "stock_transfers"

    id = Column(Integer, primary_key=True, index=True)
    reference_number = Column(String(50), nullable=False)
    from_warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    to_warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="draft")
    notes = Column(Text, nullable=True)
    transferred_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "reference_number", name="uq_stock_transfer_ref"),
    )


class StockTransferItem(TimestampMixin, Base):
    __tablename__ = "stock_transfer_items"

    id = Column(Integer, primary_key=True, index=True)
    stock_transfer_id = Column(Integer, ForeignKey("stock_transfers.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    notes = Column(Text, nullable=True)
