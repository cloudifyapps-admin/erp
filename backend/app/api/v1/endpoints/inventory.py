from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id
from app.services.crud import CRUDService
from app.services.numbering import commit_number, peek_number
from app.models.global_models import User
from app.models.inventory import (
    Product,
    Warehouse,
    StockLevel,
    StockMovement,
    StockAdjustment,
    StockAdjustmentItem,
    StockTransfer,
    StockTransferItem,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _paginate(page: int, per_page: int):
    return (page - 1) * per_page, per_page


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
# Products
# ---------------------------------------------------------------------------

product_service = CRUDService(Product)


@router.get("/products")
async def list_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {}
    if status:
        filters["status"] = status
    if type:
        filters["type"] = type
    items, total = await product_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name", "sku", "barcode", "description"],
        filters=filters or None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/products/{id}")
async def get_product(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await product_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")
    return _row_to_dict(obj)


@router.post("/products", status_code=201)
async def create_product(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    if not data.get("sku"):
        data["sku"] = await commit_number(db, tenant_id, "product")
    obj = await product_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/products/{id}")
async def update_product(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await product_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/products/{id}", status_code=204)
async def delete_product(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await product_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Warehouses
# ---------------------------------------------------------------------------

warehouse_service = CRUDService(Warehouse)


@router.get("/warehouses")
async def list_warehouses(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    items, total = await warehouse_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name", "code", "city"],
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/warehouses/{id}")
async def get_warehouse(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await warehouse_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return _row_to_dict(obj)


@router.post("/warehouses", status_code=201)
async def create_warehouse(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    if not data.get("code"):
        data["code"] = await commit_number(db, tenant_id, "warehouse")
    obj = await warehouse_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/warehouses/{id}")
async def update_warehouse(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await warehouse_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/warehouses/{id}", status_code=204)
async def delete_warehouse(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await warehouse_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Stock Levels (read-only)
# ---------------------------------------------------------------------------

stock_level_service = CRUDService(StockLevel)


@router.get("/stock-levels")
async def list_stock_levels(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    product_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {}
    if product_id:
        filters["product_id"] = product_id
    if warehouse_id:
        filters["warehouse_id"] = warehouse_id
    items, total = await stock_level_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        filters=filters or None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


# ---------------------------------------------------------------------------
# Stock Movements (read-only)
# ---------------------------------------------------------------------------

stock_movement_service = CRUDService(StockMovement)


@router.get("/stock-movements")
async def list_stock_movements(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    product_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {}
    if product_id:
        filters["product_id"] = product_id
    if warehouse_id:
        filters["warehouse_id"] = warehouse_id
    if type:
        filters["type"] = type
    items, total = await stock_movement_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        filters=filters or None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


# ---------------------------------------------------------------------------
# Stock Adjustments
# ---------------------------------------------------------------------------

adj_service = CRUDService(StockAdjustment)


@router.get("/stock-adjustments")
async def list_stock_adjustments(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters = {"status": status} if status else None
    items, total = await adj_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["reference_number", "reason"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/stock-adjustments/{id}")
async def get_stock_adjustment(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await adj_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Stock adjustment not found")
    result = await db.execute(
        select(StockAdjustmentItem).where(StockAdjustmentItem.stock_adjustment_id == id)
    )
    items = result.scalars().all()
    data = _row_to_dict(obj)
    data["items"] = [_row_to_dict(i) for i in items]
    return data


@router.post("/stock-adjustments", status_code=201)
async def create_stock_adjustment(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    line_items = data.pop("items", [])
    data["reference_number"] = await commit_number(db, tenant_id, "stock_adjustment")
    obj = await adj_service.create(db, data, tenant_id, user.id)
    for item in line_items:
        item["stock_adjustment_id"] = obj.id
        db.add(StockAdjustmentItem(**item))
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(StockAdjustmentItem).where(StockAdjustmentItem.stock_adjustment_id == obj.id)
    )
    resp = _row_to_dict(obj)
    resp["items"] = [_row_to_dict(i) for i in result.scalars().all()]
    return resp


@router.put("/stock-adjustments/{id}")
async def update_stock_adjustment(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    existing = await adj_service.get_by_id(db, id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Stock adjustment not found")
    if existing.status == "approved":
        raise HTTPException(status_code=400, detail="Cannot modify an approved adjustment")
    line_items = data.pop("items", None)
    obj = await adj_service.update(db, id, data, tenant_id, user.id)
    if line_items is not None:
        await db.execute(
            StockAdjustmentItem.__table__.delete().where(
                StockAdjustmentItem.stock_adjustment_id == id
            )
        )
        for item in line_items:
            item["stock_adjustment_id"] = id
            db.add(StockAdjustmentItem(**item))
        await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(StockAdjustmentItem).where(StockAdjustmentItem.stock_adjustment_id == id)
    )
    resp = _row_to_dict(obj)
    resp["items"] = [_row_to_dict(i) for i in result.scalars().all()]
    return resp


@router.delete("/stock-adjustments/{id}", status_code=204)
async def delete_stock_adjustment(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await adj_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Stock adjustment not found")
    await db.commit()


@router.post("/stock-adjustments/{id}/approve")
async def approve_stock_adjustment(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await adj_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Stock adjustment not found")
    if obj.status == "approved":
        raise HTTPException(status_code=400, detail="Adjustment is already approved")
    obj.status = "approved"
    obj.approved_by = user.id
    obj.approved_at = datetime.utcnow()
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


# ---------------------------------------------------------------------------
# Stock Transfers
# ---------------------------------------------------------------------------

transfer_service = CRUDService(StockTransfer)


@router.get("/stock-transfers")
async def list_stock_transfers(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters = {"status": status} if status else None
    items, total = await transfer_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["reference_number", "notes"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/stock-transfers/{id}")
async def get_stock_transfer(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await transfer_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    result = await db.execute(
        select(StockTransferItem).where(StockTransferItem.stock_transfer_id == id)
    )
    items = result.scalars().all()
    data = _row_to_dict(obj)
    data["items"] = [_row_to_dict(i) for i in items]
    return data


@router.post("/stock-transfers", status_code=201)
async def create_stock_transfer(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    line_items = data.pop("items", [])
    data["reference_number"] = await commit_number(db, tenant_id, "stock_transfer")
    obj = await transfer_service.create(db, data, tenant_id, user.id)
    for item in line_items:
        item["stock_transfer_id"] = obj.id
        db.add(StockTransferItem(**item))
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(StockTransferItem).where(StockTransferItem.stock_transfer_id == obj.id)
    )
    resp = _row_to_dict(obj)
    resp["items"] = [_row_to_dict(i) for i in result.scalars().all()]
    return resp


@router.put("/stock-transfers/{id}")
async def update_stock_transfer(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    existing = await transfer_service.get_by_id(db, id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    if existing.status == "transferred":
        raise HTTPException(status_code=400, detail="Cannot modify a completed transfer")
    line_items = data.pop("items", None)
    obj = await transfer_service.update(db, id, data, tenant_id, user.id)
    if line_items is not None:
        await db.execute(
            StockTransferItem.__table__.delete().where(
                StockTransferItem.stock_transfer_id == id
            )
        )
        for item in line_items:
            item["stock_transfer_id"] = id
            db.add(StockTransferItem(**item))
        await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(StockTransferItem).where(StockTransferItem.stock_transfer_id == id)
    )
    resp = _row_to_dict(obj)
    resp["items"] = [_row_to_dict(i) for i in result.scalars().all()]
    return resp


@router.delete("/stock-transfers/{id}", status_code=204)
async def delete_stock_transfer(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await transfer_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    await db.commit()
