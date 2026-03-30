from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id
from app.services.crud import CRUDService
from app.services.numbering import commit_number, peek_number
from app.models.global_models import User
from app.models.hr import (
    Employee,
    Department,
    Attendance,
    LeaveRequest,
    HolidayList,
    Holiday,
    PayrollRun,
    PayrollSlip,
    PerformanceReview,
    ExpenseClaim,
    ExpenseClaimItem,
)

router = APIRouter(prefix="/hr", tags=["hr"])


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
# Employees
# ---------------------------------------------------------------------------

employee_service = CRUDService(Employee)


@router.get("/employees")
async def list_employees(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    department_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {}
    if status:
        filters["status"] = status
    if department_id:
        filters["department_id"] = department_id
    items, total = await employee_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search,
        search_fields=["first_name", "last_name", "employee_id", "email"],
        filters=filters or None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/employees/{id}")
async def get_employee(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await employee_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Employee not found")
    return _row_to_dict(obj)


@router.post("/employees", status_code=201)
async def create_employee(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    if not data.get("employee_id"):
        data["employee_id"] = await commit_number(db, tenant_id, "employee")
    obj = await employee_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/employees/{id}")
async def update_employee(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await employee_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/employees/{id}", status_code=204)
async def delete_employee(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await employee_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------

dept_service = CRUDService(Department)


@router.get("/departments")
async def list_departments(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    items, total = await dept_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name", "code"],
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/departments/{id}")
async def get_department(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await dept_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Department not found")
    return _row_to_dict(obj)


@router.post("/departments", status_code=201)
async def create_department(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    if not data.get("code"):
        data["code"] = await commit_number(db, tenant_id, "department")
    obj = await dept_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/departments/{id}")
async def update_department(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await dept_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Department not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/departments/{id}", status_code=204)
async def delete_department(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await dept_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Department not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

attendance_service = CRUDService(Attendance)


@router.get("/attendance")
async def list_attendance(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {}
    if status:
        filters["status"] = status
    if employee_id:
        filters["employee_id"] = employee_id
    items, total = await attendance_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        filters=filters or None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/attendance/{id}")
async def get_attendance(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await attendance_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    return _row_to_dict(obj)


@router.post("/attendance", status_code=201)
async def create_attendance(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await attendance_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/attendance/{id}")
async def update_attendance(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await attendance_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/attendance/{id}", status_code=204)
async def delete_attendance(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await attendance_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Leave Requests
# ---------------------------------------------------------------------------

leave_service = CRUDService(LeaveRequest)


@router.get("/leave-requests")
async def list_leave_requests(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {}
    if status:
        filters["status"] = status
    if employee_id:
        filters["employee_id"] = employee_id
    items, total = await leave_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["reason"],
        filters=filters or None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/leave-requests/{id}")
async def get_leave_request(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await leave_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Leave request not found")
    return _row_to_dict(obj)


@router.post("/leave-requests", status_code=201)
async def create_leave_request(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["number"] = await commit_number(db, tenant_id, "leave_request")
    obj = await leave_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/leave-requests/{id}")
async def update_leave_request(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    existing = await leave_service.get_by_id(db, id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if existing.status in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Cannot modify a processed leave request")
    obj = await leave_service.update(db, id, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/leave-requests/{id}", status_code=204)
async def delete_leave_request(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await leave_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Leave request not found")
    await db.commit()


@router.post("/leave-requests/{id}/approve")
async def approve_leave_request(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await leave_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if obj.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve a leave request with status '{obj.status}'")
    obj.status = "approved"
    obj.approved_by = user.id
    obj.approved_at = datetime.utcnow()
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.post("/leave-requests/{id}/reject")
async def reject_leave_request(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await leave_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if obj.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot reject a leave request with status '{obj.status}'")
    obj.status = "rejected"
    obj.approved_by = user.id
    obj.approved_at = datetime.utcnow()
    obj.rejection_reason = data.get("reason")
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


# ---------------------------------------------------------------------------
# Holiday Lists
# ---------------------------------------------------------------------------

holiday_list_service = CRUDService(HolidayList)
holiday_service = CRUDService(Holiday)


@router.get("/holiday-lists")
async def list_holiday_lists(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    items, total = await holiday_list_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name"],
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/holiday-lists/{id}")
async def get_holiday_list(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await holiday_list_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Holiday list not found")
    result = await db.execute(
        select(Holiday).where(Holiday.holiday_list_id == id).order_by(Holiday.holiday_date)
    )
    holidays = result.scalars().all()
    data = _row_to_dict(obj)
    data["holidays"] = [_row_to_dict(h) for h in holidays]
    return data


@router.post("/holiday-lists", status_code=201)
async def create_holiday_list(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    holidays = data.pop("holidays", [])
    obj = await holiday_list_service.create(db, data, tenant_id, user.id)
    for h in holidays:
        h["holiday_list_id"] = obj.id
        db.add(Holiday(**{**h, "tenant_id": tenant_id, "created_by": user.id, "updated_by": user.id}))
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(Holiday).where(Holiday.holiday_list_id == obj.id).order_by(Holiday.holiday_date)
    )
    resp = _row_to_dict(obj)
    resp["holidays"] = [_row_to_dict(h) for h in result.scalars().all()]
    return resp


@router.put("/holiday-lists/{id}")
async def update_holiday_list(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    holidays = data.pop("holidays", None)
    obj = await holiday_list_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Holiday list not found")
    if holidays is not None:
        await db.execute(
            Holiday.__table__.delete().where(Holiday.holiday_list_id == id)
        )
        for h in holidays:
            h["holiday_list_id"] = id
            db.add(Holiday(**{**h, "tenant_id": tenant_id, "created_by": user.id, "updated_by": user.id}))
        await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(Holiday).where(Holiday.holiday_list_id == id).order_by(Holiday.holiday_date)
    )
    resp = _row_to_dict(obj)
    resp["holidays"] = [_row_to_dict(h) for h in result.scalars().all()]
    return resp


@router.delete("/holiday-lists/{id}", status_code=204)
async def delete_holiday_list(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await holiday_list_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Holiday list not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Payroll Runs
# ---------------------------------------------------------------------------

payroll_run_service = CRUDService(PayrollRun)
payroll_slip_service = CRUDService(PayrollSlip)


@router.get("/payroll-runs")
async def list_payroll_runs(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters = {"status": status} if status else None
    items, total = await payroll_run_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["title"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/payroll-runs/{id}")
async def get_payroll_run(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await payroll_run_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    result = await db.execute(
        select(PayrollSlip).where(PayrollSlip.payroll_run_id == id)
    )
    slips = result.scalars().all()
    data = _row_to_dict(obj)
    data["slips"] = [_row_to_dict(s) for s in slips]
    return data


@router.post("/payroll-runs", status_code=201)
async def create_payroll_run(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["number"] = await commit_number(db, tenant_id, "payroll_run")
    obj = await payroll_run_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/payroll-runs/{id}")
async def update_payroll_run(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    existing = await payroll_run_service.get_by_id(db, id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    if existing.status == "processed":
        raise HTTPException(status_code=400, detail="Cannot modify a processed payroll run")
    obj = await payroll_run_service.update(db, id, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/payroll-runs/{id}", status_code=204)
async def delete_payroll_run(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await payroll_run_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    await db.commit()


@router.post("/payroll-runs/{id}/generate-slips")
async def generate_payroll_slips(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Generate payroll slips for the given payroll run.
    Accepts {"employee_ids": [...]} or generates for all active employees if omitted.
    """
    run = await payroll_run_service.get_by_id(db, id, tenant_id)
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    if run.status == "processed":
        raise HTTPException(status_code=400, detail="Payroll run is already processed")

    employee_ids: Optional[List[int]] = data.get("employee_ids")
    if employee_ids:
        employees_result = await db.execute(
            select(Employee).where(
                and_(Employee.tenant_id == tenant_id, Employee.id.in_(employee_ids))
            )
        )
    else:
        employees_result = await db.execute(
            select(Employee).where(
                and_(Employee.tenant_id == tenant_id, Employee.status == "active")
            )
        )
    employees = employees_result.scalars().all()

    generated = []
    for emp in employees:
        # Check if slip already exists
        existing_slip = await db.execute(
            select(PayrollSlip).where(
                and_(
                    PayrollSlip.payroll_run_id == id,
                    PayrollSlip.employee_id == emp.id,
                    PayrollSlip.tenant_id == tenant_id,
                )
            )
        )
        if existing_slip.scalar_one_or_none():
            continue

        slip_data = {
            "payroll_run_id": id,
            "employee_id": emp.id,
            "tenant_id": tenant_id,
            "created_by": user.id,
            "updated_by": user.id,
            "status": "draft",
        }
        slip = PayrollSlip(**slip_data)
        db.add(slip)
        generated.append(emp.id)

    run.status = "processing"
    run.updated_by = user.id
    await db.flush()
    await db.commit()
    return {"message": f"Generated slips for {len(generated)} employee(s)", "employee_ids": generated}


# ---------------------------------------------------------------------------
# Performance Reviews
# ---------------------------------------------------------------------------

review_service = CRUDService(PerformanceReview)


@router.get("/performance-reviews")
async def list_performance_reviews(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {}
    if status:
        filters["status"] = status
    if employee_id:
        filters["employee_id"] = employee_id
    items, total = await review_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["review_period", "comments"],
        filters=filters or None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/performance-reviews/{id}")
async def get_performance_review(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await review_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Performance review not found")
    return _row_to_dict(obj)


@router.post("/performance-reviews", status_code=201)
async def create_performance_review(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["number"] = await commit_number(db, tenant_id, "performance_review")
    obj = await review_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/performance-reviews/{id}")
async def update_performance_review(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await review_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Performance review not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/performance-reviews/{id}", status_code=204)
async def delete_performance_review(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await review_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Performance review not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Expense Claims
# ---------------------------------------------------------------------------

expense_service = CRUDService(ExpenseClaim)


@router.get("/expense-claims")
async def list_expense_claims(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {}
    if status:
        filters["status"] = status
    if employee_id:
        filters["employee_id"] = employee_id
    items, total = await expense_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["claim_number", "title", "description"],
        filters=filters or None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/expense-claims/{id}")
async def get_expense_claim(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await expense_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    result = await db.execute(
        select(ExpenseClaimItem).where(ExpenseClaimItem.expense_claim_id == id)
    )
    items = result.scalars().all()
    data = _row_to_dict(obj)
    data["items"] = [_row_to_dict(i) for i in items]
    return data


@router.post("/expense-claims", status_code=201)
async def create_expense_claim(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    line_items = data.pop("items", [])
    data["claim_number"] = await commit_number(db, tenant_id, "expense_claim")
    obj = await expense_service.create(db, data, tenant_id, user.id)
    for item in line_items:
        item["expense_claim_id"] = obj.id
        db.add(ExpenseClaimItem(**{**item, "tenant_id": tenant_id, "created_by": user.id, "updated_by": user.id}))
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(ExpenseClaimItem).where(ExpenseClaimItem.expense_claim_id == obj.id)
    )
    resp = _row_to_dict(obj)
    resp["items"] = [_row_to_dict(i) for i in result.scalars().all()]
    return resp


@router.put("/expense-claims/{id}")
async def update_expense_claim(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    existing = await expense_service.get_by_id(db, id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    if existing.status in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Cannot modify a processed expense claim")
    line_items = data.pop("items", None)
    obj = await expense_service.update(db, id, data, tenant_id, user.id)
    if line_items is not None:
        await db.execute(
            ExpenseClaimItem.__table__.delete().where(ExpenseClaimItem.expense_claim_id == id)
        )
        for item in line_items:
            item["expense_claim_id"] = id
            db.add(ExpenseClaimItem(**{**item, "tenant_id": tenant_id, "created_by": user.id, "updated_by": user.id}))
        await db.flush()
    await db.commit()
    await db.refresh(obj)
    result = await db.execute(
        select(ExpenseClaimItem).where(ExpenseClaimItem.expense_claim_id == id)
    )
    resp = _row_to_dict(obj)
    resp["items"] = [_row_to_dict(i) for i in result.scalars().all()]
    return resp


@router.delete("/expense-claims/{id}", status_code=204)
async def delete_expense_claim(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await expense_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    await db.commit()


@router.post("/expense-claims/{id}/approve")
async def approve_expense_claim(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await expense_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    if obj.status == "approved":
        raise HTTPException(status_code=400, detail="Expense claim is already approved")
    if obj.status == "rejected":
        raise HTTPException(status_code=400, detail="Expense claim has been rejected")
    obj.status = "approved"
    obj.approved_by = user.id
    obj.approved_at = datetime.utcnow()
    obj.updated_by = user.id
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)
