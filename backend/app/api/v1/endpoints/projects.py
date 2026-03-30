from datetime import datetime, date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id, require_permission
from app.services.crud import CRUDService
from app.services.numbering import commit_number, peek_number
from app.services.project_service import (
    calculate_project_progress,
    calculate_milestone_progress,
    get_gantt_data,
    generate_wbs_codes,
    update_task_actual_hours,
    update_project_total_hours,
)
from app.models.global_models import User
from app.models.projects import (
    Project, Task, Milestone, TimeLog,
    TaskDependency, TaskChecklist, TaskLabelAssignment,
    TaskComment, TaskAttachment, TaskWatcher,
    ProjectMember, ProjectComment, ProjectAttachment,
    ProjectTemplate, ProjectPhase, ResourceAllocation, UserSkill,
)

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
        "pages": max((total + per_page - 1) // per_page, 1),
    }


def _row_to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ---------------------------------------------------------------------------
# Projects CRUD
# ---------------------------------------------------------------------------

project_service = CRUDService(Project)

template_service = CRUDService(ProjectTemplate)
phase_service = CRUDService(ProjectPhase)
alloc_service = CRUDService(ResourceAllocation)
skill_service = CRUDService(UserSkill)


@router.get("")
async def list_projects(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category_id: Optional[int] = None,
    manager_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {}
    if status:
        filters["status"] = status
    if priority:
        filters["priority"] = priority
    if category_id:
        filters["category_id"] = category_id
    if manager_id:
        filters["manager_id"] = manager_id
    items, total = await project_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name", "code", "description"],
        filters=filters if filters else None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/my-tasks")
async def my_tasks(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "view")),
):
    """All tasks assigned to the current user across projects."""
    skip, limit = _paginate(page, per_page)
    q = select(Task).where(
        and_(Task.tenant_id == tenant_id, Task.assigned_to == user.id)
    )
    count_q = select(func.count(Task.id)).where(
        and_(Task.tenant_id == tenant_id, Task.assigned_to == user.id)
    )
    if status:
        q = q.where(Task.status == status)
        count_q = count_q.where(Task.status == status)
    if priority:
        q = q.where(Task.priority == priority)
        count_q = count_q.where(Task.priority == priority)
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(Task.due_date.asc().nullslast()).offset(skip).limit(limit))
    items = result.scalars().all()
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)



# ---------------------------------------------------------------------------
# Project Templates
# ---------------------------------------------------------------------------


@router.get("/templates")
async def list_templates(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    skip, limit = _paginate(page, per_page)
    items, total = await template_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name", "description"],
    )
    results = []
    for i in items:
        d = _row_to_dict(i)
        td = i.template_data or {}
        d["task_count"] = len(td.get("tasks", []))
        d["milestone_count"] = len(td.get("milestones", []))
        results.append(d)
    return _list_response(results, total, page, per_page)


@router.get("/templates/{id}")
async def get_template(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    obj = await template_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Template not found")
    d = _row_to_dict(obj)
    td = obj.template_data or {}
    d["task_count"] = len(td.get("tasks", []))
    d["milestone_count"] = len(td.get("milestones", []))
    return d


@router.post("/templates", status_code=201)
async def create_template(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "create")),
):
    obj = await template_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.post("/templates/from-project/{project_id}", status_code=201)
async def create_template_from_project(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "create")),
):
    proj = await project_service.get_by_id(db, project_id, tenant_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    # Get milestones
    ms_result = await db.execute(
        select(Milestone).where(
            and_(Milestone.project_id == project_id, Milestone.tenant_id == tenant_id)
        ).order_by(Milestone.sort_order)
    )
    milestones = [{"title": m.title, "description": m.description, "sort_order": m.sort_order}
                  for m in ms_result.scalars().all()]
    # Get tasks
    task_result = await db.execute(
        select(Task).where(
            and_(Task.project_id == project_id, Task.tenant_id == tenant_id)
        ).order_by(Task.sort_order)
    )
    tasks = [{"title": t.title, "description": t.description, "priority": t.priority,
              "estimated_hours": float(t.estimated_hours) if t.estimated_hours else None,
              "milestone_title": None, "sort_order": t.sort_order}
             for t in task_result.scalars().all()]
    template_data = {"milestones": milestones, "tasks": tasks}
    tpl = {
        "name": data.get("name", f"Template from {proj.name}"),
        "description": data.get("description", proj.description),
        "category_id": proj.category_id,
        "default_billing_type": proj.billing_type,
        "template_data": template_data,
    }
    obj = await template_service.create(db, tpl, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.post("/from-template/{template_id}", status_code=201)
async def create_project_from_template(
    template_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "create")),
):
    tpl = await template_service.get_by_id(db, template_id, tenant_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    # Create project
    project_data = {
        "name": data.get("name", f"New from {tpl.name}"),
        "description": data.get("description", tpl.description),
        "category_id": tpl.category_id,
        "billing_type": tpl.default_billing_type,
        "status": "planning",
    }
    project_data.update({k: v for k, v in data.items() if k not in ("name", "description")})
    if not project_data.get("code"):
        # Sync numbering counter with actual max project code to avoid conflicts
        max_code_result = await db.execute(
            select(func.max(Project.code)).where(Project.tenant_id == tenant_id)
        )
        max_code = max_code_result.scalar()
        if max_code:
            try:
                max_num = int(max_code.split("-")[-1])
            except (ValueError, IndexError):
                max_num = 0
            from app.models.tenant_models import OrganizationSettings
            org = (await db.execute(
                select(OrganizationSettings).where(OrganizationSettings.tenant_id == tenant_id)
            )).scalar_one_or_none()
            if org and org.number_series:
                ns = dict(org.number_series)
                proj_series = dict(ns.get("project", {"prefix": "PRJ", "padding": 4, "next_number": 1}))
                if proj_series.get("next_number", 1) <= max_num:
                    proj_series["next_number"] = max_num + 1
                    ns["project"] = proj_series
                    org.number_series = ns
                    await db.flush()
        project_data["code"] = await commit_number(db, tenant_id, "project")
    proj = await project_service.create(db, project_data, tenant_id, user.id)
    await db.flush()
    # Create milestones and tasks from template
    td = tpl.template_data or {}
    for ms_data in td.get("milestones", []):
        ms = Milestone(
            project_id=proj.id, tenant_id=tenant_id,
            title=ms_data["title"], description=ms_data.get("description"),
            sort_order=ms_data.get("sort_order", 0),
            created_by=user.id, updated_by=user.id,
        )
        db.add(ms)
    for task_data in td.get("tasks", []):
        t = Task(
            project_id=proj.id, tenant_id=tenant_id,
            title=task_data["title"], description=task_data.get("description"),
            priority=task_data.get("priority", "medium"),
            estimated_hours=task_data.get("estimated_hours"),
            sort_order=task_data.get("sort_order", 0),
            created_by=user.id, updated_by=user.id,
        )
        db.add(t)
    await db.commit()
    await db.refresh(proj)
    return _row_to_dict(proj)


@router.put("/templates/{id}")
async def update_template(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    obj = await template_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/templates/{id}", status_code=204)
async def delete_template(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "delete")),
):
    deleted = await template_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.commit()


@router.get("/resource-utilization")
async def resource_utilization(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    """Cross-project resource utilization."""
    q = select(ResourceAllocation).where(ResourceAllocation.tenant_id == tenant_id)
    if start_date:
        q = q.where(ResourceAllocation.end_date >= date.fromisoformat(start_date))
    if end_date:
        q = q.where(ResourceAllocation.start_date <= date.fromisoformat(end_date))
    result = await db.execute(q)
    allocations = result.scalars().all()
    # Group by user
    user_map = {}
    for a in allocations:
        uid = a.user_id
        if uid not in user_map:
            user_result = await db.execute(select(User).where(User.id == uid))
            u = user_result.scalar_one_or_none()
            user_map[uid] = {
                "user_id": uid,
                "user_name": u.name if u else "Unknown",
                "allocations": [],
                "total_allocation_percent": 0,
            }
        user_map[uid]["allocations"].append(_row_to_dict(a))
        user_map[uid]["total_allocation_percent"] += a.allocation_percent
    return {"data": list(user_map.values())}


@router.get("/skills/{user_id}")
async def list_user_skills(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    items, total = await skill_service.get_list(
        db, tenant_id, skip=0, limit=200,
        filters={"user_id": user_id},
    )
    return {"data": [_row_to_dict(i) for i in items], "total": total}


@router.post("/skills", status_code=201)
async def add_skill(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "create")),
):
    obj = await skill_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/skills/{id}", status_code=204)
async def delete_skill(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "delete")),
):
    deleted = await skill_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Skill not found")
    await db.commit()


@router.get("/{id}")
async def get_project(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    obj = await project_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    d = _row_to_dict(obj)
    # Add computed task counts
    total_q = select(func.count(Task.id)).where(
        and_(Task.project_id == id, Task.tenant_id == tenant_id)
    )
    done_q = select(func.count(Task.id)).where(
        and_(Task.project_id == id, Task.tenant_id == tenant_id, Task.status == "done")
    )
    d["total_tasks"] = (await db.execute(total_q)).scalar() or 0
    d["completed_tasks"] = (await db.execute(done_q)).scalar() or 0
    return d


@router.post("", status_code=201)
async def create_project(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "create")),
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
    _: bool = Depends(require_permission("projects", "edit")),
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
    _: bool = Depends(require_permission("projects", "delete")),
):
    deleted = await project_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Tasks CRUD
# ---------------------------------------------------------------------------

task_service = CRUDService(Task)


@router.get("/{project_id}/tasks")
async def list_tasks(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[int] = None,
    milestone_id: Optional[int] = None,
    phase_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {"project_id": project_id}
    if status:
        filters["status"] = status
    if priority:
        filters["priority"] = priority
    if assigned_to:
        filters["assigned_to"] = assigned_to
    if milestone_id:
        filters["milestone_id"] = milestone_id
    if phase_id:
        filters["phase_id"] = phase_id
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
    _: bool = Depends(require_permission("tasks", "view")),
):
    result = await db.execute(
        select(Task).where(
            and_(Task.id == id, Task.tenant_id == tenant_id, Task.project_id == project_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    d = _row_to_dict(obj)
    # Include labels
    label_result = await db.execute(
        select(TaskLabelAssignment).where(TaskLabelAssignment.task_id == id)
    )
    d["labels"] = [{"label_id": la.label_id} for la in label_result.scalars().all()]
    # Include checklist count
    cl_result = await db.execute(
        select(
            func.count(TaskChecklist.id).label("total"),
            func.count(TaskChecklist.id).filter(TaskChecklist.is_completed == True).label("done"),
        ).where(TaskChecklist.task_id == id)
    )
    cl = cl_result.one()
    d["checklist_total"] = cl.total
    d["checklist_done"] = cl.done
    # Include dependency count
    dep_result = await db.execute(
        select(func.count(TaskDependency.id)).where(TaskDependency.task_id == id)
    )
    d["dependency_count"] = dep_result.scalar() or 0
    # Include comment count
    comment_result = await db.execute(
        select(func.count(TaskComment.id)).where(TaskComment.task_id == id)
    )
    d["comment_count"] = comment_result.scalar() or 0
    # Include attachment count
    att_result = await db.execute(
        select(func.count(TaskAttachment.id)).where(TaskAttachment.task_id == id)
    )
    d["attachment_count"] = att_result.scalar() or 0
    return d


@router.post("/{project_id}/tasks", status_code=201)
async def create_task(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "create")),
):
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
    _: bool = Depends(require_permission("tasks", "edit")),
):
    result = await db.execute(
        select(Task).where(
            and_(Task.id == id, Task.tenant_id == tenant_id, Task.project_id == project_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    old_status = obj.status
    data["updated_by"] = user.id
    for key, value in data.items():
        if hasattr(obj, key):
            setattr(obj, key, value)
    # Auto-set completed_at
    if obj.status == "done" and old_status != "done":
        obj.completed_at = datetime.utcnow()
    elif obj.status != "done":
        obj.completed_at = None
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
    _: bool = Depends(require_permission("tasks", "delete")),
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
    _: bool = Depends(require_permission("tasks", "edit")),
):
    result = await db.execute(
        select(Task).where(
            and_(Task.id == id, Task.tenant_id == tenant_id, Task.project_id == project_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    old_status = obj.status
    if "status" in data:
        obj.status = data["status"]
    if "status_id" in data:
        obj.status_id = data["status_id"]
    if obj.status == "done" and old_status != "done":
        obj.completed_at = datetime.utcnow()
    elif obj.status != "done":
        obj.completed_at = None
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
    _: bool = Depends(require_permission("tasks", "edit")),
):
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
# Gantt Data & WBS
# ---------------------------------------------------------------------------

@router.get("/{project_id}/gantt-data")
async def gantt_data(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    proj = await project_service.get_by_id(db, project_id, tenant_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return await get_gantt_data(db, project_id, tenant_id)


@router.post("/{project_id}/generate-wbs")
async def gen_wbs(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    proj = await project_service.get_by_id(db, project_id, tenant_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    updated = await generate_wbs_codes(db, project_id, tenant_id)
    await db.commit()
    return {"updated": updated}


@router.post("/{project_id}/recalculate-progress")
async def recalc_progress(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    proj = await project_service.get_by_id(db, project_id, tenant_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    progress = await calculate_project_progress(db, project_id, tenant_id)
    proj.progress = progress
    total_hours = await update_project_total_hours(db, project_id, tenant_id)
    await db.commit()
    return {"progress": progress, "total_hours": total_hours}


# ---------------------------------------------------------------------------
# Task Dependencies
# ---------------------------------------------------------------------------

dep_service = CRUDService(TaskDependency)


@router.get("/{project_id}/tasks/{task_id}/dependencies")
async def list_dependencies(
    project_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "view")),
):
    # Predecessors
    pred_result = await db.execute(
        select(TaskDependency).where(
            and_(TaskDependency.task_id == task_id, TaskDependency.tenant_id == tenant_id)
        )
    )
    predecessors = [_row_to_dict(d) for d in pred_result.scalars().all()]
    # Successors
    succ_result = await db.execute(
        select(TaskDependency).where(
            and_(TaskDependency.depends_on_task_id == task_id, TaskDependency.tenant_id == tenant_id)
        )
    )
    successors = [_row_to_dict(d) for d in succ_result.scalars().all()]
    return {"predecessors": predecessors, "successors": successors}


@router.post("/{project_id}/tasks/{task_id}/dependencies", status_code=201)
async def add_dependency(
    project_id: int,
    task_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    depends_on = data.get("depends_on_task_id")
    if not depends_on:
        raise HTTPException(status_code=400, detail="depends_on_task_id is required")
    if depends_on == task_id:
        raise HTTPException(status_code=400, detail="A task cannot depend on itself")
    data["task_id"] = task_id
    obj = await dep_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/tasks/{task_id}/dependencies/{dep_id}", status_code=204)
async def remove_dependency(
    project_id: int,
    task_id: int,
    dep_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    result = await db.execute(
        select(TaskDependency).where(
            and_(TaskDependency.id == dep_id, TaskDependency.tenant_id == tenant_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Dependency not found")
    await db.delete(obj)
    await db.commit()


# ---------------------------------------------------------------------------
# Task Checklists
# ---------------------------------------------------------------------------

checklist_service = CRUDService(TaskChecklist)


@router.get("/{project_id}/tasks/{task_id}/checklists")
async def list_checklists(
    project_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "view")),
):
    items, total = await checklist_service.get_list(
        db, tenant_id, skip=0, limit=200,
        filters={"task_id": task_id},
        order_by="sort_order",
    )
    return {"data": [_row_to_dict(i) for i in items], "total": total}


@router.post("/{project_id}/tasks/{task_id}/checklists", status_code=201)
async def add_checklist_item(
    project_id: int,
    task_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    data["task_id"] = task_id
    obj = await checklist_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.patch("/{project_id}/tasks/{task_id}/checklists/{id}")
async def toggle_checklist_item(
    project_id: int,
    task_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    result = await db.execute(
        select(TaskChecklist).where(
            and_(TaskChecklist.id == id, TaskChecklist.tenant_id == tenant_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    for key, value in data.items():
        if hasattr(obj, key):
            setattr(obj, key, value)
    if data.get("is_completed"):
        obj.completed_at = datetime.utcnow()
        obj.completed_by = user.id
    elif "is_completed" in data and not data["is_completed"]:
        obj.completed_at = None
        obj.completed_by = None
    obj.updated_by = user.id
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/tasks/{task_id}/checklists/{id}", status_code=204)
async def delete_checklist_item(
    project_id: int,
    task_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    result = await db.execute(
        select(TaskChecklist).where(
            and_(TaskChecklist.id == id, TaskChecklist.tenant_id == tenant_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    await db.delete(obj)
    await db.commit()


@router.patch("/{project_id}/tasks/{task_id}/checklists/reorder")
async def reorder_checklist(
    project_id: int,
    task_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    for entry in data.get("order", []):
        item_id = entry.get("id")
        sort_order = entry.get("sort_order")
        if item_id is None or sort_order is None:
            continue
        result = await db.execute(
            select(TaskChecklist).where(
                and_(TaskChecklist.id == item_id, TaskChecklist.tenant_id == tenant_id)
            )
        )
        obj = result.scalar_one_or_none()
        if obj:
            obj.sort_order = sort_order
    await db.flush()
    await db.commit()
    return {"message": "Checklist reordered"}


# ---------------------------------------------------------------------------
# Task Labels
# ---------------------------------------------------------------------------

@router.post("/{project_id}/tasks/{task_id}/labels", status_code=201)
async def assign_label(
    project_id: int,
    task_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    label_id = data.get("label_id")
    if not label_id:
        raise HTTPException(status_code=400, detail="label_id is required")
    obj = TaskLabelAssignment(task_id=task_id, label_id=label_id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/tasks/{task_id}/labels/{label_id}", status_code=204)
async def remove_label(
    project_id: int,
    task_id: int,
    label_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    result = await db.execute(
        select(TaskLabelAssignment).where(
            and_(TaskLabelAssignment.task_id == task_id, TaskLabelAssignment.label_id == label_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Label assignment not found")
    await db.delete(obj)
    await db.commit()


@router.get("/{project_id}/tasks/{task_id}/labels")
async def list_task_labels(
    project_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "view")),
):
    result = await db.execute(
        select(TaskLabelAssignment).where(TaskLabelAssignment.task_id == task_id)
    )
    return {"data": [_row_to_dict(la) for la in result.scalars().all()]}


# ---------------------------------------------------------------------------
# Task Comments
# ---------------------------------------------------------------------------

comment_service = CRUDService(TaskComment)


@router.get("/{project_id}/tasks/{task_id}/comments")
async def list_task_comments(
    project_id: int,
    task_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "view")),
):
    skip, limit = _paginate(page, per_page)
    items, total = await comment_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        filters={"task_id": task_id},
        order_by="created_at",
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.post("/{project_id}/tasks/{task_id}/comments", status_code=201)
async def add_task_comment(
    project_id: int,
    task_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    data["task_id"] = task_id
    obj = await comment_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/tasks/{task_id}/comments/{id}")
async def update_task_comment(
    project_id: int,
    task_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    result = await db.execute(
        select(TaskComment).where(
            and_(TaskComment.id == id, TaskComment.tenant_id == tenant_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Comment not found")
    if "body" in data:
        obj.body = data["body"]
    if "mentions" in data:
        obj.mentions = data["mentions"]
    obj.updated_by = user.id
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/tasks/{task_id}/comments/{id}", status_code=204)
async def delete_task_comment(
    project_id: int,
    task_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "delete")),
):
    result = await db.execute(
        select(TaskComment).where(
            and_(TaskComment.id == id, TaskComment.tenant_id == tenant_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Comment not found")
    await db.delete(obj)
    await db.commit()


# ---------------------------------------------------------------------------
# Task Attachments
# ---------------------------------------------------------------------------

@router.get("/{project_id}/tasks/{task_id}/attachments")
async def list_task_attachments(
    project_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "view")),
):
    result = await db.execute(
        select(TaskAttachment).where(TaskAttachment.task_id == task_id)
    )
    return {"data": [_row_to_dict(a) for a in result.scalars().all()]}


@router.post("/{project_id}/tasks/{task_id}/attachments", status_code=201)
async def add_task_attachment(
    project_id: int,
    task_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    data["task_id"] = task_id
    data["uploaded_by"] = user.id
    obj = TaskAttachment(**data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/tasks/{task_id}/attachments/{id}", status_code=204)
async def delete_task_attachment(
    project_id: int,
    task_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "delete")),
):
    result = await db.execute(
        select(TaskAttachment).where(TaskAttachment.id == id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Attachment not found")
    await db.delete(obj)
    await db.commit()


# ---------------------------------------------------------------------------
# Task Watchers
# ---------------------------------------------------------------------------

@router.get("/{project_id}/tasks/{task_id}/watchers")
async def list_watchers(
    project_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "view")),
):
    result = await db.execute(
        select(TaskWatcher).where(TaskWatcher.task_id == task_id)
    )
    return {"data": [_row_to_dict(w) for w in result.scalars().all()]}


@router.post("/{project_id}/tasks/{task_id}/watchers", status_code=201)
async def add_watcher(
    project_id: int,
    task_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    user_id = data.get("user_id", user.id)
    obj = TaskWatcher(task_id=task_id, user_id=user_id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/tasks/{task_id}/watchers/{user_id}", status_code=204)
async def remove_watcher(
    project_id: int,
    task_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tasks", "edit")),
):
    result = await db.execute(
        select(TaskWatcher).where(
            and_(TaskWatcher.task_id == task_id, TaskWatcher.user_id == user_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Watcher not found")
    await db.delete(obj)
    await db.commit()


# ---------------------------------------------------------------------------
# Milestones CRUD
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
    _: bool = Depends(require_permission("milestones", "view")),
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
    _: bool = Depends(require_permission("milestones", "view")),
):
    result = await db.execute(
        select(Milestone).where(
            and_(Milestone.id == id, Milestone.tenant_id == tenant_id, Milestone.project_id == project_id)
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
    _: bool = Depends(require_permission("milestones", "create")),
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
    _: bool = Depends(require_permission("milestones", "edit")),
):
    result = await db.execute(
        select(Milestone).where(
            and_(Milestone.id == id, Milestone.tenant_id == tenant_id, Milestone.project_id == project_id)
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
    _: bool = Depends(require_permission("milestones", "delete")),
):
    result = await db.execute(
        select(Milestone).where(
            and_(Milestone.id == id, Milestone.tenant_id == tenant_id, Milestone.project_id == project_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Milestone not found")
    await db.delete(obj)
    await db.commit()


# ---------------------------------------------------------------------------
# Time Logs CRUD
# ---------------------------------------------------------------------------

timelog_service = CRUDService(TimeLog)


@router.get("/{project_id}/time-logs")
async def list_time_logs(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    task_id: Optional[int] = None,
    user_id: Optional[int] = None,
    is_billable: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("time-logs", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {"project_id": project_id}
    if task_id:
        filters["task_id"] = task_id
    if user_id:
        filters["user_id"] = user_id
    if is_billable is not None:
        filters["is_billable"] = is_billable
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
    _: bool = Depends(require_permission("time-logs", "view")),
):
    result = await db.execute(
        select(TimeLog).where(
            and_(TimeLog.id == id, TimeLog.tenant_id == tenant_id, TimeLog.project_id == project_id)
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
    _: bool = Depends(require_permission("time-logs", "create")),
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
    _: bool = Depends(require_permission("time-logs", "create")),
):
    proj = await project_service.get_by_id(db, project_id, tenant_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
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
            raise HTTPException(status_code=400, detail="An active timer already exists for this task")
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
    _: bool = Depends(require_permission("time-logs", "edit")),
):
    result = await db.execute(
        select(TimeLog).where(
            and_(TimeLog.id == id, TimeLog.tenant_id == tenant_id, TimeLog.project_id == project_id)
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
    # Update task actual hours
    if obj.task_id:
        await update_task_actual_hours(db, obj.task_id, tenant_id)
        await db.commit()
    return _row_to_dict(obj)


@router.put("/{project_id}/time-logs/{id}")
async def update_time_log(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("time-logs", "edit")),
):
    result = await db.execute(
        select(TimeLog).where(
            and_(TimeLog.id == id, TimeLog.tenant_id == tenant_id, TimeLog.project_id == project_id)
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
    _: bool = Depends(require_permission("time-logs", "delete")),
):
    result = await db.execute(
        select(TimeLog).where(
            and_(TimeLog.id == id, TimeLog.tenant_id == tenant_id, TimeLog.project_id == project_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Time log not found")
    await db.delete(obj)
    await db.commit()


# ---------------------------------------------------------------------------
# Project Members
# ---------------------------------------------------------------------------

member_service = CRUDService(ProjectMember)


@router.get("/{project_id}/members")
async def list_members(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    items, total = await member_service.get_list(
        db, tenant_id, skip=0, limit=200,
        filters={"project_id": project_id},
    )
    # Enrich with user info
    members = []
    for m in items:
        d = _row_to_dict(m)
        user_result = await db.execute(select(User).where(User.id == m.user_id))
        u = user_result.scalar_one_or_none()
        if u:
            d["user_name"] = u.name
            d["user_email"] = u.email
        members.append(d)
    return {"data": members, "total": total}


@router.post("/{project_id}/members", status_code=201)
async def add_member(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    data["project_id"] = project_id
    # Look up user by email if provided
    email = data.pop("email", None)
    if email and not data.get("user_id"):
        result = await db.execute(
            select(User).where(User.email == email)
        )
        target_user = result.scalar_one_or_none()
        if not target_user:
            raise HTTPException(status_code=404, detail=f"User with email '{email}' not found")
        data["user_id"] = target_user.id
    if not data.get("user_id"):
        raise HTTPException(status_code=400, detail="Either email or user_id is required")
    try:
        obj = await member_service.create(db, data, tenant_id, user.id)
        await db.commit()
        await db.refresh(obj)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="User is already a member of this project")
    return _row_to_dict(obj)


@router.put("/{project_id}/members/{id}")
async def update_member(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    result = await db.execute(
        select(ProjectMember).where(
            and_(ProjectMember.id == id, ProjectMember.tenant_id == tenant_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Member not found")
    for key, value in data.items():
        if hasattr(obj, key):
            setattr(obj, key, value)
    obj.updated_by = user.id
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/members/{id}", status_code=204)
async def remove_member(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    result = await db.execute(
        select(ProjectMember).where(
            and_(ProjectMember.id == id, ProjectMember.tenant_id == tenant_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(obj)
    await db.commit()


# ---------------------------------------------------------------------------
# Project Activity / Comments
# ---------------------------------------------------------------------------

proj_comment_service = CRUDService(ProjectComment)


@router.get("/{project_id}/activity")
async def project_activity(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    skip, limit = _paginate(page, per_page)
    items, total = await proj_comment_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        filters={"project_id": project_id},
        order_by="created_at",
        sort_direction="desc",
    )
    data = []
    for item in items:
        d = _row_to_dict(item)
        user_result = await db.execute(select(User).where(User.id == item.created_by))
        u = user_result.scalar_one_or_none()
        if u:
            d["user_name"] = u.name
            d["user_email"] = u.email
        data.append(d)
    return _list_response(data, total, page, per_page)


@router.post("/{project_id}/comments", status_code=201)
async def add_project_comment(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    data["project_id"] = project_id
    data.setdefault("comment_type", "comment")
    obj = await proj_comment_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/comments/{id}", status_code=204)
async def delete_project_comment(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "delete")),
):
    result = await db.execute(
        select(ProjectComment).where(
            and_(ProjectComment.id == id, ProjectComment.tenant_id == tenant_id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Comment not found")
    await db.delete(obj)
    await db.commit()


# ---------------------------------------------------------------------------
# Project Attachments
# ---------------------------------------------------------------------------

@router.get("/{project_id}/attachments")
async def list_project_attachments(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    result = await db.execute(
        select(ProjectAttachment).where(ProjectAttachment.project_id == project_id)
    )
    return {"data": [_row_to_dict(a) for a in result.scalars().all()]}


@router.post("/{project_id}/attachments", status_code=201)
async def add_project_attachment(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    data["project_id"] = project_id
    data["uploaded_by"] = user.id
    obj = ProjectAttachment(**data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/attachments/{id}", status_code=204)
async def delete_project_attachment(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "delete")),
):
    result = await db.execute(
        select(ProjectAttachment).where(ProjectAttachment.id == id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Attachment not found")
    await db.delete(obj)
    await db.commit()

# ---------------------------------------------------------------------------
# Phase 2: Project Phases
# ---------------------------------------------------------------------------



@router.get("/{project_id}/phases")
async def list_phases(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    items, total = await phase_service.get_list(
        db, tenant_id, skip=0, limit=200,
        filters={"project_id": project_id},
        order_by="sort_order",
    )
    return {"data": [_row_to_dict(i) for i in items], "total": total}


@router.post("/{project_id}/phases", status_code=201)
async def create_phase(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    data["project_id"] = project_id
    obj = await phase_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/phases/{id}")
async def update_phase(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    obj = await phase_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Phase not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/phases/{id}", status_code=204)
async def delete_phase(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "delete")),
):
    deleted = await phase_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Phase not found")
    await db.commit()


@router.patch("/{project_id}/phases/reorder")
async def reorder_phases(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    for entry in data.get("order", []):
        pid = entry.get("id")
        sort_order = entry.get("sort_order")
        if pid is None or sort_order is None:
            continue
        result = await db.execute(
            select(ProjectPhase).where(
                and_(ProjectPhase.id == pid, ProjectPhase.tenant_id == tenant_id)
            )
        )
        obj = result.scalar_one_or_none()
        if obj:
            obj.sort_order = sort_order
    await db.flush()
    await db.commit()
    return {"message": "Phases reordered"}


# ---------------------------------------------------------------------------
# Phase 2: Resource Allocation
# ---------------------------------------------------------------------------


@router.get("/{project_id}/allocations")
async def list_allocations(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "view")),
):
    items, total = await alloc_service.get_list(
        db, tenant_id, skip=0, limit=200,
        filters={"project_id": project_id},
    )
    data = []
    for item in items:
        d = _row_to_dict(item)
        user_result = await db.execute(select(User).where(User.id == item.user_id))
        u = user_result.scalar_one_or_none()
        if u:
            d["user_name"] = u.name
        data.append(d)
    return {"data": data, "total": total}


@router.post("/{project_id}/allocations", status_code=201)
async def create_allocation(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    data["project_id"] = project_id
    obj = await alloc_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/allocations/{id}")
async def update_allocation(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "edit")),
):
    obj = await alloc_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Allocation not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/allocations/{id}", status_code=204)
async def delete_allocation(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("projects", "delete")),
):
    deleted = await alloc_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Allocation not found")
    await db.commit()


