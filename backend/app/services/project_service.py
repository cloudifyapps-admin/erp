"""
Project-specific business logic beyond generic CRUD.
"""
from datetime import datetime
from typing import Optional
from collections import defaultdict

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.projects import (
    Project, Task, Milestone, TimeLog, TaskDependency,
)


async def calculate_project_progress(
    db: AsyncSession, project_id: int, tenant_id: int
) -> int:
    """Weighted average progress from task completion."""
    result = await db.execute(
        select(
            func.count(Task.id).label("total"),
            func.count(Task.id).filter(Task.status == "done").label("done"),
        ).where(
            and_(Task.project_id == project_id, Task.tenant_id == tenant_id)
        )
    )
    row = result.one()
    if row.total == 0:
        return 0
    return round((row.done / row.total) * 100)


async def calculate_milestone_progress(
    db: AsyncSession, milestone_id: int, tenant_id: int
) -> int:
    """Progress from child tasks of a milestone."""
    result = await db.execute(
        select(
            func.count(Task.id).label("total"),
            func.count(Task.id).filter(Task.status == "done").label("done"),
        ).where(
            and_(Task.milestone_id == milestone_id, Task.tenant_id == tenant_id)
        )
    )
    row = result.one()
    if row.total == 0:
        return 0
    return round((row.done / row.total) * 100)


async def update_task_actual_hours(
    db: AsyncSession, task_id: int, tenant_id: int
) -> float:
    """Sum time logs for a task and update actual_hours."""
    result = await db.execute(
        select(func.coalesce(func.sum(TimeLog.hours), 0)).where(
            and_(TimeLog.task_id == task_id, TimeLog.tenant_id == tenant_id)
        )
    )
    total = float(result.scalar())
    task_result = await db.execute(
        select(Task).where(and_(Task.id == task_id, Task.tenant_id == tenant_id))
    )
    task = task_result.scalar_one_or_none()
    if task:
        task.actual_hours = total
    return total


async def update_project_total_hours(
    db: AsyncSession, project_id: int, tenant_id: int
) -> float:
    """Sum all time logs for a project."""
    result = await db.execute(
        select(func.coalesce(func.sum(TimeLog.hours), 0)).where(
            and_(TimeLog.project_id == project_id, TimeLog.tenant_id == tenant_id)
        )
    )
    total = float(result.scalar())
    proj_result = await db.execute(
        select(Project).where(and_(Project.id == project_id, Project.tenant_id == tenant_id))
    )
    proj = proj_result.scalar_one_or_none()
    if proj:
        proj.total_hours = total
    return total


async def generate_wbs_codes(
    db: AsyncSession, project_id: int, tenant_id: int
) -> list[dict]:
    """Assign WBS codes based on milestone grouping and task hierarchy."""
    # Get milestones ordered by sort_order
    ms_result = await db.execute(
        select(Milestone).where(
            and_(Milestone.project_id == project_id, Milestone.tenant_id == tenant_id)
        ).order_by(Milestone.sort_order)
    )
    milestones = ms_result.scalars().all()

    # Get tasks ordered by sort_order
    task_result = await db.execute(
        select(Task).where(
            and_(Task.project_id == project_id, Task.tenant_id == tenant_id)
        ).order_by(Task.sort_order)
    )
    tasks = task_result.scalars().all()

    # Group tasks by milestone_id
    task_by_milestone = defaultdict(list)
    no_milestone_tasks = []
    for t in tasks:
        if t.parent_id:
            continue  # Skip subtasks for now
        if t.milestone_id:
            task_by_milestone[t.milestone_id].append(t)
        else:
            no_milestone_tasks.append(t)

    # Group subtasks by parent
    subtasks_by_parent = defaultdict(list)
    for t in tasks:
        if t.parent_id:
            subtasks_by_parent[t.parent_id].append(t)

    updated = []
    ms_idx = 1
    for ms in milestones:
        ms_tasks = task_by_milestone.get(ms.id, [])
        for t_idx, task in enumerate(ms_tasks, 1):
            task.wbs_code = f"{ms_idx}.{t_idx}"
            updated.append({"id": task.id, "wbs_code": task.wbs_code})
            for st_idx, sub in enumerate(subtasks_by_parent.get(task.id, []), 1):
                sub.wbs_code = f"{ms_idx}.{t_idx}.{st_idx}"
                updated.append({"id": sub.id, "wbs_code": sub.wbs_code})
        ms_idx += 1

    # Tasks without milestone
    for t_idx, task in enumerate(no_milestone_tasks, 1):
        task.wbs_code = f"0.{t_idx}"
        updated.append({"id": task.id, "wbs_code": task.wbs_code})
        for st_idx, sub in enumerate(subtasks_by_parent.get(task.id, []), 1):
            sub.wbs_code = f"0.{t_idx}.{st_idx}"
            updated.append({"id": sub.id, "wbs_code": sub.wbs_code})

    await db.flush()
    return updated


async def calculate_critical_path(
    db: AsyncSession, project_id: int, tenant_id: int
) -> list[int]:
    """
    Forward/backward pass on task dependency graph.
    Returns list of task IDs on the critical path.
    """
    # Get all tasks
    task_result = await db.execute(
        select(Task).where(
            and_(Task.project_id == project_id, Task.tenant_id == tenant_id)
        )
    )
    tasks = {t.id: t for t in task_result.scalars().all()}
    if not tasks:
        return []

    # Get all dependencies
    dep_result = await db.execute(
        select(TaskDependency).where(TaskDependency.tenant_id == tenant_id)
    )
    deps = dep_result.scalars().all()

    # Build adjacency: predecessors[task_id] = [depends_on_task_id, ...]
    predecessors = defaultdict(list)
    successors = defaultdict(list)
    for d in deps:
        if d.task_id in tasks and d.depends_on_task_id in tasks:
            predecessors[d.task_id].append((d.depends_on_task_id, d.lag_days))
            successors[d.depends_on_task_id].append((d.task_id, d.lag_days))

    # Duration = estimated_hours / 8 (convert to days), minimum 1 day
    def duration(task_id: int) -> float:
        t = tasks[task_id]
        if t.estimated_hours:
            return max(float(t.estimated_hours) / 8, 0.125)
        return 1.0

    # Forward pass: earliest start (ES) and earliest finish (EF)
    es = {}
    ef = {}
    for tid in tasks:
        es[tid] = 0.0
        ef[tid] = 0.0

    # Topological order via Kahn's algorithm
    in_degree = defaultdict(int)
    for tid in tasks:
        in_degree[tid] = len(predecessors.get(tid, []))
    queue = [tid for tid in tasks if in_degree[tid] == 0]
    topo_order = []
    while queue:
        tid = queue.pop(0)
        topo_order.append(tid)
        for succ_id, lag in successors.get(tid, []):
            in_degree[succ_id] -= 1
            if in_degree[succ_id] == 0:
                queue.append(succ_id)

    # Forward pass
    for tid in topo_order:
        preds = predecessors.get(tid, [])
        if preds:
            es[tid] = max(ef[pred_id] + lag for pred_id, lag in preds)
        ef[tid] = es[tid] + duration(tid)

    # Backward pass
    project_end = max(ef.values()) if ef else 0
    ls = {}
    lf = {}
    for tid in tasks:
        lf[tid] = project_end
        ls[tid] = project_end

    for tid in reversed(topo_order):
        succs = successors.get(tid, [])
        if succs:
            lf[tid] = min(ls[succ_id] - lag for succ_id, lag in succs)
        else:
            lf[tid] = project_end
        ls[tid] = lf[tid] - duration(tid)

    # Critical path: tasks where float (LS - ES) is ~0
    critical = [tid for tid in tasks if abs(ls[tid] - es[tid]) < 0.001]
    return critical


async def get_gantt_data(
    db: AsyncSession, project_id: int, tenant_id: int
) -> dict:
    """Return all data needed for Gantt chart rendering."""
    # Tasks
    task_result = await db.execute(
        select(Task).where(
            and_(Task.project_id == project_id, Task.tenant_id == tenant_id)
        ).order_by(Task.sort_order)
    )
    tasks = task_result.scalars().all()

    # Milestones
    ms_result = await db.execute(
        select(Milestone).where(
            and_(Milestone.project_id == project_id, Milestone.tenant_id == tenant_id)
        ).order_by(Milestone.sort_order)
    )
    milestones = ms_result.scalars().all()

    # Dependencies
    task_ids = [t.id for t in tasks]
    dep_result = await db.execute(
        select(TaskDependency).where(TaskDependency.task_id.in_(task_ids))
    ) if task_ids else None
    deps = dep_result.scalars().all() if dep_result else []

    # Critical path
    critical_path = await calculate_critical_path(db, project_id, tenant_id)

    def task_to_dict(t):
        return {
            "id": t.id,
            "title": t.title,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "status": t.status,
            "priority": t.priority,
            "progress": t.progress,
            "assigned_to": t.assigned_to,
            "milestone_id": t.milestone_id,
            "parent_id": t.parent_id,
            "estimated_hours": float(t.estimated_hours) if t.estimated_hours else None,
            "wbs_code": t.wbs_code,
            "is_critical": t.id in critical_path,
        }

    def ms_to_dict(m):
        return {
            "id": m.id,
            "title": m.title,
            "due_date": m.due_date.isoformat() if m.due_date else None,
            "status": m.status,
            "progress": m.progress,
        }

    def dep_to_dict(d):
        return {
            "id": d.id,
            "task_id": d.task_id,
            "depends_on_task_id": d.depends_on_task_id,
            "dependency_type": d.dependency_type,
            "lag_days": d.lag_days,
        }

    return {
        "tasks": [task_to_dict(t) for t in tasks],
        "milestones": [ms_to_dict(m) for m in milestones],
        "dependencies": [dep_to_dict(d) for d in deps],
        "critical_path": critical_path,
    }
