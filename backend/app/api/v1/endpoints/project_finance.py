"""
Phase 3: Project Finance endpoints — expenses, budget, billing, profitability.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, extract

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id
from app.services.crud import CRUDService
from app.models.global_models import User
from app.models.projects import (
    Project, ProjectExpense, ProjectBudgetLine, BillingRate,
    ProjectInvoice, TimeLog, Milestone, Task,
)


router = APIRouter(prefix="/projects", tags=["project-finance"])


def _row_to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def _paginate(page: int, per_page: int):
    return (page - 1) * per_page, per_page


def _list_response(items, total, page, per_page):
    return {
        "data": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max((total + per_page - 1) // per_page, 1),
    }


# ---------------------------------------------------------------------------
# Project Expenses
# ---------------------------------------------------------------------------

expense_service = CRUDService(ProjectExpense)


@router.get("/{project_id}/expenses")
async def list_expenses(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    cost_category_id: Optional[int] = None,
    is_billable: Optional[bool] = None,
    approval_status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {"project_id": project_id}
    if cost_category_id:
        filters["cost_category_id"] = cost_category_id
    if is_billable is not None:
        filters["is_billable"] = is_billable
    if approval_status:
        filters["approval_status"] = approval_status
    items, total = await expense_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        filters=filters,
        order_by="expense_date",
        sort_direction="desc",
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.post("/{project_id}/expenses", status_code=201)
async def create_expense(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["project_id"] = project_id
    obj = await expense_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/expenses/{id}")
async def update_expense(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await expense_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Expense not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/expenses/{id}", status_code=204)
async def delete_expense(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await expense_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Expense not found")
    await db.commit()


@router.patch("/{project_id}/expenses/{id}/approve")
async def approve_expense(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(ProjectExpense).where(
            and_(ProjectExpense.id == id, ProjectExpense.tenant_id == tenant_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Expense not found")
    obj.approval_status = data.get("approval_status", "approved")
    obj.approved_by = user.id
    obj.approved_at = datetime.utcnow()
    obj.updated_by = user.id
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


# ---------------------------------------------------------------------------
# Budget Lines
# ---------------------------------------------------------------------------

budget_service = CRUDService(ProjectBudgetLine)


@router.get("/{project_id}/budget")
async def get_budget(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    items, total = await budget_service.get_list(
        db, tenant_id, skip=0, limit=200,
        filters={"project_id": project_id},
    )
    lines = [_row_to_dict(i) for i in items]
    total_planned = sum(float(l.get("planned_amount", 0) or 0) for l in lines)
    total_actual = sum(float(l.get("actual_amount", 0) or 0) for l in lines)
    # Get overall project budget
    proj_result = await db.execute(
        select(Project).where(and_(Project.id == project_id, Project.tenant_id == tenant_id))
    )
    proj = proj_result.scalar_one_or_none()
    return {
        "lines": lines,
        "total_planned": total_planned,
        "total_actual": total_actual,
        "project_budget": float(proj.budget) if proj and proj.budget else 0,
        "variance": total_planned - total_actual,
    }


@router.post("/{project_id}/budget-lines", status_code=201)
async def create_budget_line(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["project_id"] = project_id
    obj = await budget_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/budget-lines/{id}")
async def update_budget_line(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await budget_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Budget line not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/budget-lines/{id}", status_code=204)
async def delete_budget_line(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await budget_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Budget line not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Project Invoices
# ---------------------------------------------------------------------------

invoice_service = CRUDService(ProjectInvoice)


@router.get("/{project_id}/invoices")
async def list_project_invoices(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    items, total = await invoice_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        filters={"project_id": project_id},
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.post("/{project_id}/invoices", status_code=201)
async def create_project_invoice(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["project_id"] = project_id
    obj = await invoice_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.get("/{project_id}/unbilled-time")
async def unbilled_time(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(TimeLog).where(
            and_(
                TimeLog.project_id == project_id,
                TimeLog.tenant_id == tenant_id,
                TimeLog.is_billable == True,
                TimeLog.stopped_at.isnot(None),
            )
        )
    )
    logs = result.scalars().all()
    user_map = {}
    for log in logs:
        uid = log.user_id
        if uid not in user_map:
            user_result = await db.execute(select(User).where(User.id == uid))
            u = user_result.scalar_one_or_none()
            user_map[uid] = {
                "user_id": uid,
                "user_name": u.name if u else "Unknown",
                "total_hours": 0,
                "entries": [],
            }
        user_map[uid]["total_hours"] += float(log.hours)
        user_map[uid]["entries"].append(_row_to_dict(log))
    return {"data": list(user_map.values())}


@router.get("/{project_id}/profitability")
async def project_profitability(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    # Revenue from project invoices
    inv_result = await db.execute(
        select(
            func.coalesce(func.sum(ProjectInvoice.amount), 0)
        ).where(
            and_(ProjectInvoice.project_id == project_id, ProjectInvoice.tenant_id == tenant_id)
        )
    )
    total_revenue = float(inv_result.scalar())

    # Cost from expenses
    exp_result = await db.execute(
        select(
            func.coalesce(func.sum(ProjectExpense.amount), 0)
        ).where(
            and_(
                ProjectExpense.project_id == project_id,
                ProjectExpense.tenant_id == tenant_id,
                ProjectExpense.approval_status == "approved",
            )
        )
    )
    total_expenses = float(exp_result.scalar())

    # Labor cost from time logs
    time_result = await db.execute(
        select(
            func.coalesce(func.sum(TimeLog.hours), 0)
        ).where(
            and_(TimeLog.project_id == project_id, TimeLog.tenant_id == tenant_id)
        )
    )
    total_hours = float(time_result.scalar())

    total_cost = total_expenses
    margin = total_revenue - total_cost
    margin_percent = (margin / total_revenue * 100) if total_revenue > 0 else 0

    return {
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "total_hours": total_hours,
        "total_cost": total_cost,
        "margin": margin,
        "margin_percent": round(margin_percent, 2),
    }
