from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id
from app.services.crud import CRUDService
from app.services.numbering import commit_number, peek_number
from app.models.sales import (
    Quotation,
    QuotationItem,
    SalesOrder,
    SalesOrderItem,
    Delivery,
    DeliveryItem,
    Invoice,
    InvoiceItem,
)
from app.models.global_models import User
from typing import Optional

router = APIRouter(prefix="/sales", tags=["sales"])

# ---------------------------------------------------------------------------
# CRUD service instances
# ---------------------------------------------------------------------------

quotation_svc = CRUDService(Quotation)
sales_order_svc = CRUDService(SalesOrder)
delivery_svc = CRUDService(Delivery)
invoice_svc = CRUDService(Invoice)


# ---------------------------------------------------------------------------
# Helper: fetch items for a parent
# ---------------------------------------------------------------------------

async def _get_items(db: AsyncSession, model, fk_field: str, parent_id: int) -> list:
    result = await db.execute(
        select(model)
        .where(getattr(model, fk_field) == parent_id)
        .order_by(model.sort_order if hasattr(model, "sort_order") else model.id)
    )
    return list(result.scalars().all())


def _row_to_dict(obj) -> dict:
    """Convert a SQLAlchemy model instance to a plain dict."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


async def _build_parent_with_items(
    db: AsyncSession,
    parent,
    item_model,
    fk_field: str,
) -> dict:
    data = _row_to_dict(parent)
    items = await _get_items(db, item_model, fk_field, parent.id)
    data["items"] = [_row_to_dict(i) for i in items]
    return data


# ---------------------------------------------------------------------------
# QUOTATIONS
# ---------------------------------------------------------------------------

@router.get("/quotations")
async def list_quotations(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    skip = (page - 1) * per_page
    filters = {"status": status} if status else None
    items, total = await quotation_svc.get_list(
        db,
        tenant_id=tenant_id,
        skip=skip,
        limit=per_page,
        search=search,
        search_fields=["number"],
        filters=filters,
    )
    return {
        "data": [_row_to_dict(q) for q in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.post("/quotations", status_code=201)
async def create_quotation(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    items_data: list = payload.pop("items", [])

    number = await commit_number(db, tenant_id, "quotation")
    payload["number"] = number

    quotation = await quotation_svc.create(db, payload, tenant_id, current_user.id)

    created_items = []
    for idx, item_data in enumerate(items_data):
        item_data["quotation_id"] = quotation.id
        item_data.setdefault("sort_order", idx)
        obj = QuotationItem(**item_data)
        db.add(obj)
        created_items.append(obj)

    await db.flush()
    for obj in created_items:
        await db.refresh(obj)

    await db.commit()
    await db.refresh(quotation)

    return await _build_parent_with_items(db, quotation, QuotationItem, "quotation_id")


@router.get("/quotations/{quotation_id}")
async def get_quotation(
    quotation_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    quotation = await quotation_svc.get_by_id(db, quotation_id, tenant_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return await _build_parent_with_items(db, quotation, QuotationItem, "quotation_id")


@router.put("/quotations/{quotation_id}")
async def update_quotation(
    quotation_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    items_data: list = payload.pop("items", None)

    quotation = await quotation_svc.update(db, quotation_id, payload, tenant_id, current_user.id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    if items_data is not None:
        # Replace all items
        existing = await _get_items(db, QuotationItem, "quotation_id", quotation_id)
        for item in existing:
            await db.delete(item)
        await db.flush()

        for idx, item_data in enumerate(items_data):
            item_data["quotation_id"] = quotation_id
            item_data.setdefault("sort_order", idx)
            db.add(QuotationItem(**item_data))

        await db.flush()

    await db.commit()
    await db.refresh(quotation)
    return await _build_parent_with_items(db, quotation, QuotationItem, "quotation_id")


@router.delete("/quotations/{quotation_id}", status_code=204)
async def delete_quotation(
    quotation_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    deleted = await quotation_svc.delete(db, quotation_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Quotation not found")
    await db.commit()


@router.post("/quotations/{quotation_id}/duplicate", status_code=201)
async def duplicate_quotation(
    quotation_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    original = await quotation_svc.get_by_id(db, quotation_id, tenant_id)
    if not original:
        raise HTTPException(status_code=404, detail="Quotation not found")

    new_number = await commit_number(db, tenant_id, "quotation")

    clone_data = {
        c.name: getattr(original, c.name)
        for c in original.__table__.columns
        if c.name not in ("id", "tenant_id", "created_by", "updated_by", "created_at", "updated_at")
    }
    clone_data["number"] = new_number
    clone_data["status"] = "draft"

    new_quotation = await quotation_svc.create(db, clone_data, tenant_id, current_user.id)

    original_items = await _get_items(db, QuotationItem, "quotation_id", quotation_id)
    for item in original_items:
        item_data = {
            c.name: getattr(item, c.name)
            for c in item.__table__.columns
            if c.name not in ("id", "created_at", "updated_at")
        }
        item_data["quotation_id"] = new_quotation.id
        db.add(QuotationItem(**item_data))

    await db.flush()
    await db.commit()
    await db.refresh(new_quotation)

    return await _build_parent_with_items(db, new_quotation, QuotationItem, "quotation_id")


# ---------------------------------------------------------------------------
# SALES ORDERS
# ---------------------------------------------------------------------------

@router.get("/sales-orders")
async def list_sales_orders(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    skip = (page - 1) * per_page
    filters = {"status": status} if status else None
    items, total = await sales_order_svc.get_list(
        db,
        tenant_id=tenant_id,
        skip=skip,
        limit=per_page,
        search=search,
        search_fields=["number"],
        filters=filters,
    )
    return {
        "data": [_row_to_dict(o) for o in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.post("/sales-orders", status_code=201)
async def create_sales_order(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    items_data: list = payload.pop("items", [])

    number = await commit_number(db, tenant_id, "sales_order")
    payload["number"] = number

    sales_order = await sales_order_svc.create(db, payload, tenant_id, current_user.id)

    created_items = []
    for idx, item_data in enumerate(items_data):
        item_data["sales_order_id"] = sales_order.id
        item_data.setdefault("sort_order", idx)
        obj = SalesOrderItem(**item_data)
        db.add(obj)
        created_items.append(obj)

    await db.flush()
    for obj in created_items:
        await db.refresh(obj)

    await db.commit()
    await db.refresh(sales_order)

    return await _build_parent_with_items(db, sales_order, SalesOrderItem, "sales_order_id")


@router.get("/sales-orders/{order_id}")
async def get_sales_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    sales_order = await sales_order_svc.get_by_id(db, order_id, tenant_id)
    if not sales_order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    return await _build_parent_with_items(db, sales_order, SalesOrderItem, "sales_order_id")


@router.put("/sales-orders/{order_id}")
async def update_sales_order(
    order_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    items_data: list = payload.pop("items", None)

    sales_order = await sales_order_svc.update(db, order_id, payload, tenant_id, current_user.id)
    if not sales_order:
        raise HTTPException(status_code=404, detail="Sales order not found")

    if items_data is not None:
        existing = await _get_items(db, SalesOrderItem, "sales_order_id", order_id)
        for item in existing:
            await db.delete(item)
        await db.flush()

        for idx, item_data in enumerate(items_data):
            item_data["sales_order_id"] = order_id
            item_data.setdefault("sort_order", idx)
            db.add(SalesOrderItem(**item_data))

        await db.flush()

    await db.commit()
    await db.refresh(sales_order)
    return await _build_parent_with_items(db, sales_order, SalesOrderItem, "sales_order_id")


@router.delete("/sales-orders/{order_id}", status_code=204)
async def delete_sales_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    deleted = await sales_order_svc.delete(db, order_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Sales order not found")
    await db.commit()


# ---------------------------------------------------------------------------
# DELIVERIES
# ---------------------------------------------------------------------------

@router.get("/deliveries")
async def list_deliveries(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    skip = (page - 1) * per_page
    filters = {"status": status} if status else None
    items, total = await delivery_svc.get_list(
        db,
        tenant_id=tenant_id,
        skip=skip,
        limit=per_page,
        search=search,
        search_fields=["number"],
        filters=filters,
    )
    return {
        "data": [_row_to_dict(d) for d in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.post("/deliveries", status_code=201)
async def create_delivery(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    items_data: list = payload.pop("items", [])

    number = await commit_number(db, tenant_id, "delivery")
    payload["number"] = number

    delivery = await delivery_svc.create(db, payload, tenant_id, current_user.id)

    created_items = []
    for item_data in items_data:
        item_data["delivery_id"] = delivery.id
        obj = DeliveryItem(**item_data)
        db.add(obj)
        created_items.append(obj)

    await db.flush()
    for obj in created_items:
        await db.refresh(obj)

    await db.commit()
    await db.refresh(delivery)

    return await _build_parent_with_items(db, delivery, DeliveryItem, "delivery_id")


@router.get("/deliveries/{delivery_id}")
async def get_delivery(
    delivery_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    delivery = await delivery_svc.get_by_id(db, delivery_id, tenant_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return await _build_parent_with_items(db, delivery, DeliveryItem, "delivery_id")


@router.put("/deliveries/{delivery_id}")
async def update_delivery(
    delivery_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    items_data: list = payload.pop("items", None)

    delivery = await delivery_svc.update(db, delivery_id, payload, tenant_id, current_user.id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if items_data is not None:
        existing = await _get_items(db, DeliveryItem, "delivery_id", delivery_id)
        for item in existing:
            await db.delete(item)
        await db.flush()

        for item_data in items_data:
            item_data["delivery_id"] = delivery_id
            db.add(DeliveryItem(**item_data))

        await db.flush()

    await db.commit()
    await db.refresh(delivery)
    return await _build_parent_with_items(db, delivery, DeliveryItem, "delivery_id")


@router.delete("/deliveries/{delivery_id}", status_code=204)
async def delete_delivery(
    delivery_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    deleted = await delivery_svc.delete(db, delivery_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Delivery not found")
    await db.commit()


# ---------------------------------------------------------------------------
# INVOICES
# ---------------------------------------------------------------------------

@router.get("/invoices")
async def list_invoices(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None, description="Filter by invoice type: tax, proforma"),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    skip = (page - 1) * per_page
    filters: dict = {}
    if status:
        filters["status"] = status
    if type:
        filters["type"] = type

    items, total = await invoice_svc.get_list(
        db,
        tenant_id=tenant_id,
        skip=skip,
        limit=per_page,
        search=search,
        search_fields=["number"],
        filters=filters or None,
    )
    return {
        "data": [_row_to_dict(i) for i in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.post("/invoices", status_code=201)
async def create_invoice(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    items_data: list = payload.pop("items", [])

    # Determine invoice type and pick correct numbering series
    invoice_type = payload.get("type", "tax")
    numbering_key = "proforma_invoice" if invoice_type == "proforma" else "invoice"

    number = await commit_number(db, tenant_id, numbering_key)
    payload["number"] = number

    invoice = await invoice_svc.create(db, payload, tenant_id, current_user.id)

    created_items = []
    for idx, item_data in enumerate(items_data):
        item_data["invoice_id"] = invoice.id
        item_data.setdefault("sort_order", idx)
        obj = InvoiceItem(**item_data)
        db.add(obj)
        created_items.append(obj)

    await db.flush()
    for obj in created_items:
        await db.refresh(obj)

    await db.commit()
    await db.refresh(invoice)

    return await _build_parent_with_items(db, invoice, InvoiceItem, "invoice_id")


@router.get("/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    invoice = await invoice_svc.get_by_id(db, invoice_id, tenant_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return await _build_parent_with_items(db, invoice, InvoiceItem, "invoice_id")


@router.put("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    items_data: list = payload.pop("items", None)

    invoice = await invoice_svc.update(db, invoice_id, payload, tenant_id, current_user.id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if items_data is not None:
        existing = await _get_items(db, InvoiceItem, "invoice_id", invoice_id)
        for item in existing:
            await db.delete(item)
        await db.flush()

        for idx, item_data in enumerate(items_data):
            item_data["invoice_id"] = invoice_id
            item_data.setdefault("sort_order", idx)
            db.add(InvoiceItem(**item_data))

        await db.flush()

    await db.commit()
    await db.refresh(invoice)
    return await _build_parent_with_items(db, invoice, InvoiceItem, "invoice_id")


@router.delete("/invoices/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    deleted = await invoice_svc.delete(db, invoice_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await db.commit()


@router.post("/invoices/{invoice_id}/duplicate", status_code=201)
async def duplicate_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    original = await invoice_svc.get_by_id(db, invoice_id, tenant_id)
    if not original:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice_type = original.type or "tax"
    numbering_key = "proforma_invoice" if invoice_type == "proforma" else "invoice"
    new_number = await commit_number(db, tenant_id, numbering_key)

    clone_data = {
        c.name: getattr(original, c.name)
        for c in original.__table__.columns
        if c.name not in ("id", "tenant_id", "created_by", "updated_by", "created_at", "updated_at")
    }
    clone_data["number"] = new_number
    clone_data["status"] = "draft"
    # Reset payment state for the clone
    clone_data["paid_amount"] = 0
    clone_data["parent_invoice_id"] = None
    clone_data["recurring_count"] = 0
    clone_data["next_recurring_date"] = None

    new_invoice = await invoice_svc.create(db, clone_data, tenant_id, current_user.id)

    original_items = await _get_items(db, InvoiceItem, "invoice_id", invoice_id)
    for item in original_items:
        item_data = {
            c.name: getattr(item, c.name)
            for c in item.__table__.columns
            if c.name not in ("id", "created_at", "updated_at")
        }
        item_data["invoice_id"] = new_invoice.id
        db.add(InvoiceItem(**item_data))

    await db.flush()
    await db.commit()
    await db.refresh(new_invoice)

    return await _build_parent_with_items(db, new_invoice, InvoiceItem, "invoice_id")
