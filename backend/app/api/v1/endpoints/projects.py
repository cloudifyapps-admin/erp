from datetime import datetime, date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id
from app.services.crud import CRUDService
from app.services.numbering import commit_number, peek_number
from app.models.global_models import User
from app.models.projects import Project, Task, Milestone, TimeLog

router = APIRouter(prefix="/projects", tags=["projects"])


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
# Projects
# ---------------------------------------------------------------------------

project_service = CRUDService(Project)


@router.get("")
async def list_projects(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters = {"status": status} if status else None
    items, total = await project_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name", "code", "description"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/{id}")
async def get_project(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await project_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    return _row_to_dict(obj)


@router.post("", status_code=201)
async def create_project(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    if not data.get("code"):
        data["code"] = await commit_number(db, tenant_id, "project")
    obj = await project_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{id}")
async def update_project(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await project_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{id}", status_code=204)
async def delete_project(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await project_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

task_service = CRUDService(Task)


@router.get("/{project_id}/tasks")
async def list_tasks(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {"project_id": project_id}
    if status:
        filters["status"] = status
    items, total = await task_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["title", "description"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/{project_id}/tasks/{id}")
async def get_task(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(Task).where(
            and_(Task.id == id, Task.tenant_id == tenant_id, Task.project_id == project_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    return _row_to_dict(obj)


@router.post("/{project_id}/tasks", status_code=201)
async def create_task(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    # Validate project belongs to tenant
    proj = await project_service.get_by_id(db, project_id, tenant_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    data["project_id"] = project_id
    obj = await task_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/tasks/{id}")
async def update_task(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(Task).where(
            and_(Task.id == id, Task.tenant_id == tenant_id, Task.project_id == project_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    data["updated_by"] = user.id
    for key, value in data.items():
        if hasattr(obj, key):
            setattr(obj, key, value)
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/tasks/{id}", status_code=204)
async def delete_task(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(Task).where(
            and_(Task.id == id, Task.tenant_id == tenant_id, Task.project_id == project_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(obj)
    await db.commit()


@router.patch("/{project_id}/tasks/{id}/status")
async def update_task_status(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Update only the status (and optionally status_id) of a task."""
    result = await db.execute(
        select(Task).where(
            and_(Task.id == id, Task.tenant_id == tenant_id, Task.project_id == project_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    if "status" in data:
        obj.status = data["status"]
    if "status_id" in data:
        obj.status_id = data["status_id"]
    obj.updated_by = user.id
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.patch("/{project_id}/tasks/reorder")
async def reorder_tasks(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Accepts {"order": [{"id": 1, "sort_order": 0}, ...]} and updates sort_order for each task.
    """
    order_list: List[dict] = data.get("order", [])
    if not order_list:
        raise HTTPException(status_code=400, detail="No order data provided")
    for entry in order_list:
        task_id = entry.get("id")
        sort_order = entry.get("sort_order")
        if task_id is None or sort_order is None:
            continue
        result = await db.execute(
            select(Task).where(
                and_(Task.id == task_id, Task.tenant_id == tenant_id, Task.project_id == project_id)
            )
        )
        obj = result.scalar_one_or_none()
        if obj:
            obj.sort_order = sort_order
            obj.updated_by = user.id
    await db.flush()
    await db.commit()
    return {"message": "Tasks reordered successfully"}


# ---------------------------------------------------------------------------
# Milestones
# ---------------------------------------------------------------------------

milestone_service = CRUDService(Milestone)


@router.get("/{project_id}/milestones")
async def list_milestones(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {"project_id": project_id}
    if status:
        filters["status"] = status
    items, total = await milestone_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["title", "description"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/{project_id}/milestones/{id}")
async def get_milestone(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(Milestone).where(
            and_(
                Milestone.id == id,
                Milestone.tenant_id == tenant_id,
                Milestone.project_id == project_id,
            )
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return _row_to_dict(obj)


@router.post("/{project_id}/milestones", status_code=201)
async def create_milestone(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    proj = await project_service.get_by_id(db, project_id, tenant_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    data["project_id"] = project_id
    obj = await milestone_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/milestones/{id}")
async def update_milestone(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(Milestone).where(
            and_(
                Milestone.id == id,
                Milestone.tenant_id == tenant_id,
                Milestone.project_id == project_id,
            )
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Milestone not found")
    data["updated_by"] = user.id
    for key, value in data.items():
        if hasattr(obj, key):
            setattr(obj, key, value)
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/milestones/{id}", status_code=204)
async def delete_milestone(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(Milestone).where(
            and_(
                Milestone.id == id,
                Milestone.tenant_id == tenant_id,
                Milestone.project_id == project_id,
            )
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Milestone not found")
    await db.delete(obj)
    await db.commit()


# ---------------------------------------------------------------------------
# Time Logs
# ---------------------------------------------------------------------------

timelog_service = CRUDService(TimeLog)


@router.get("/{project_id}/time-logs")
async def list_time_logs(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    task_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {"project_id": project_id}
    if task_id:
        filters["task_id"] = task_id
    items, total = await timelog_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["description"],
        filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/{project_id}/time-logs/{id}")
async def get_time_log(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(TimeLog).where(
            and_(
                TimeLog.id == id,
                TimeLog.tenant_id == tenant_id,
                TimeLog.project_id == project_id,
            )
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Time log not found")
    return _row_to_dict(obj)


@router.post("/{project_id}/time-logs", status_code=201)
async def create_time_log(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    proj = await project_service.get_by_id(db, project_id, tenant_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    data["project_id"] = project_id
    data.setdefault("user_id", user.id)
    obj = await timelog_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.post("/{project_id}/time-logs/start", status_code=201)
async def start_timer(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Start a timer for a task. Sets started_at to now, hours to 0."""
    proj = await project_service.get_by_id(db, project_id, tenant_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Ensure no active timer for the same user/task
    task_id = data.get("task_id")
    if task_id:
        existing = await db.execute(
            select(TimeLog).where(
                and_(
                    TimeLog.tenant_id == tenant_id,
                    TimeLog.user_id == user.id,
                    TimeLog.task_id == task_id,
                    TimeLog.started_at.isnot(None),
                    TimeLog.stopped_at.is_(None),
                )
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="An active timer already exists for this task",
            )

    now = datetime.utcnow()
    data["project_id"] = project_id
    data["user_id"] = user.id
    data["started_at"] = now
    data["stopped_at"] = None
    data["hours"] = 0
    data.setdefault("log_date", now.date().isoformat())
    obj = await timelog_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.post("/{project_id}/time-logs/{id}/stop")
async def stop_timer(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Stop a running timer; calculates hours from started_at to now."""
    result = await db.execute(
        select(TimeLog).where(
            and_(
                TimeLog.id == id,
                TimeLog.tenant_id == tenant_id,
                TimeLog.project_id == project_id,
            )
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Time log not found")
    if obj.stopped_at is not None:
        raise HTTPException(status_code=400, detail="Timer is already stopped")
    if obj.started_at is None:
        raise HTTPException(status_code=400, detail="Timer was not started")

    now = datetime.utcnow()
    duration = (now - obj.started_at).total_seconds() / 3600
    obj.stopped_at = now
    obj.hours = round(duration, 4)
    obj.updated_by = user.id
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/time-logs/{id}")
async def update_time_log(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(TimeLog).where(
            and_(
                TimeLog.id == id,
                TimeLog.tenant_id == tenant_id,
                TimeLog.project_id == project_id,
            )
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Time log not found")
    data["updated_by"] = user.id
    for key, value in data.items():
        if hasattr(obj, key):
            setattr(obj, key, value)
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/time-logs/{id}", status_code=204)
async def delete_time_log(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(TimeLog).where(
            and_(
                TimeLog.id == id,
                TimeLog.tenant_id == tenant_id,
                TimeLog.project_id == project_id,
            )
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Time log not found")
    await db.delete(obj)
    await db.commit()
