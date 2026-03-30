from datetime import datetime
from typing import Optional, List, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id, require_permission
from app.services.crud import CRUDService
from app.services.numbering import commit_number, peek_number
from app.models.global_models import User
from app.models.purchase import (
    Vendor,
    PurchaseRequest,
    PurchaseOrder,
    PurchaseOrderItem,
    GoodsReceipt,
    GoodsReceiptItem,
)

router = APIRouter(prefix="/purchase", tags=["purchase"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _paginate(page: int, per_page: int):
    skip = (page - 1) * per_page
    return skip, per_page


def _list_response(items: list, total: int, page: int, per_page: int) -> dict:
    return {
        "data": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


def _row_to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ---------------------------------------------------------------------------
# Vendors
# ---------------------------------------------------------------------------

vendor_service = CRUDService(Vendor)


@router.get("/vendors")
async def list_vendors(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("vendors", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {"status": status} if status else None
    items, total = await vendor_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name", "code", "email", "phone"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/vendors/{id}")
async def get_vendor(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("vendors", "view")),
):
    obj = await vendor_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return _row_to_dict(obj)


@router.post("/vendors", status_code=201)
async def create_vendor(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("vendors", "create")),
):
    if not data.get("code"):
        data["code"] = await commit_number(db, tenant_id, "vendor")
    obj = await vendor_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/vendors/{id}")
async def update_vendor(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("vendors", "edit")),
):
    obj = await vendor_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/vendors/{id}", status_code=204)
async def delete_vendor(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("vendors", "delete")),
):
    deleted = await vendor_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Purchase Requests
# ---------------------------------------------------------------------------

pr_service = CRUDService(PurchaseRequest)


@router.get("/purchase-requests")
async def list_purchase_requests(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("purchase-requests", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {"status": status} if status else None
    items, total = await pr_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["number", "title"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/purchase-requests/{id}")
async def get_purchase_request(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("purchase-requests", "view")),
):
    obj = await pr_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    return _row_to_dict(obj)


@router.post("/purchase-requests", status_code=201)
async def create_purchase_request(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("purchase-requests", "create")),
):
    data["number"] = await commit_number(db, tenant_id, "purchase_request")
    data.setdefault("requested_by", user.id)
    obj = await pr_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/purchase-requests/{id}")
async def update_purchase_request(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("purchase-requests", "edit")),
):
    obj = await pr_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/purchase-requests/{id}", status_code=204)
async def delete_purchase_request(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("purchase-requests", "delete")),
):
    deleted = await pr_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Purchase Orders
# ---------------------------------------------------------------------------

po_service = CRUDService(PurchaseOrder)
po_item_service = CRUDService(PurchaseOrderItem)


@router.get("/purchase-orders")
async def list_purchase_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("purchase-orders", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {"status": status} if status else None
    items, total = await po_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["number", "notes"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/purchase-orders/{id}")
async def get_purchase_order(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("purchase-orders", "view")),
):
    obj = await po_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    result = await db.execute(
        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == id)
        .order_by(PurchaseOrderItem.sort_order)
    )
    items = result.scalars().all()
    data = _row_to_dict(obj)
    data["items"] = [_row_to_dict(i) for i in items]
    return data


@router.post("/purchase-orders", status_code=201)
async def create_purchase_order(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("purchase-orders", "create")),
):
    line_items = data.pop("items", [])
    data["number"] = await commit_number(db, tenant_id, "purchase_order")
    obj = await po_service.create(db, data, tenant_id, user.id)
    for idx, item in enumerate(line_items):
        item["purchase_order_id"] = obj.id
        item.setdefault("sort_order", idx)
        row = PurchaseOrderItem(**item)
        db.add(row)
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == obj.id)
        .order_by(PurchaseOrderItem.sort_order)
    )
    resp = _row_to_dict(obj)
    resp["items"] = [_row_to_dict(i) for i in result.scalars().all()]
    return resp


@router.put("/purchase-orders/{id}")
async def update_purchase_order(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("purchase-orders", "edit")),
):
    line_items = data.pop("items", None)
    obj = await po_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if line_items is not None:
        await db.execute(
            PurchaseOrderItem.__table__.delete().where(PurchaseOrderItem.purchase_order_id == id)
        )
        for idx, item in enumerate(line_items):
            item["purchase_order_id"] = id
            item.setdefault("sort_order", idx)
            db.add(PurchaseOrderItem(**item))
        await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == id)
        .order_by(PurchaseOrderItem.sort_order)
    )
    resp = _row_to_dict(obj)
    resp["items"] = [_row_to_dict(i) for i in result.scalars().all()]
    return resp


@router.delete("/purchase-orders/{id}", status_code=204)
async def delete_purchase_order(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("purchase-orders", "delete")),
):
    deleted = await po_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Goods Receipts
# ---------------------------------------------------------------------------

gr_service = CRUDService(GoodsReceipt)


@router.get("/goods-receipts")
async def list_goods_receipts(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("goods-receipts", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {"status": status} if status else None
    items, total = await gr_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["number", "notes"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/goods-receipts/{id}")
async def get_goods_receipt(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("goods-receipts", "view")),
):
    obj = await gr_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Goods receipt not found")
    result = await db.execute(
        select(GoodsReceiptItem).where(GoodsReceiptItem.goods_receipt_id == id)
    )
    items = result.scalars().all()
    data = _row_to_dict(obj)
    data["items"] = [_row_to_dict(i) for i in items]
    return data


@router.post("/goods-receipts", status_code=201)
async def create_goods_receipt(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("goods-receipts", "create")),
):
    line_items = data.pop("items", [])
    data["number"] = await commit_number(db, tenant_id, "goods_receipt")
    obj = await gr_service.create(db, data, tenant_id, user.id)
    for item in line_items:
        item["goods_receipt_id"] = obj.id
        db.add(GoodsReceiptItem(**item))
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(GoodsReceiptItem).where(GoodsReceiptItem.goods_receipt_id == obj.id)
    )
    resp = _row_to_dict(obj)
    resp["items"] = [_row_to_dict(i) for i in result.scalars().all()]
    return resp


@router.put("/goods-receipts/{id}")
async def update_goods_receipt(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("goods-receipts", "edit")),
):
    line_items = data.pop("items", None)
    obj = await gr_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Goods receipt not found")
    if line_items is not None:
        await db.execute(
            GoodsReceiptItem.__table__.delete().where(GoodsReceiptItem.goods_receipt_id == id)
        )
        for item in line_items:
            item["goods_receipt_id"] = id
            db.add(GoodsReceiptItem(**item))
        await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(GoodsReceiptItem).where(GoodsReceiptItem.goods_receipt_id == id)
    )
    resp = _row_to_dict(obj)
    resp["items"] = [_row_to_dict(i) for i in result.scalars().all()]
    return resp


@router.delete("/goods-receipts/{id}", status_code=204)
async def delete_goods_receipt(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("goods-receipts", "delete")),
):
    deleted = await gr_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Goods receipt not found")
    await db.commit()
