"""
Phase 3: Project Analytics — portfolio summary, time reports, budget variance, health scorecards.
"""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.database import get_db
from app.core.deps import get_current_tenant_id
from app.models.projects import (
    Project, Task, Milestone, TimeLog, ProjectExpense,
    ProjectInvoice, ProjectRisk, ProjectIssue,
)
from app.models.global_models import User

router = APIRouter(prefix="/projects/analytics", tags=["project-analytics"])


def _row_to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


@router.get("/portfolio-summary")
async def portfolio_summary(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """All projects with health indicator, budget status, schedule status."""
    result = await db.execute(
        select(Project).where(Project.tenant_id == tenant_id).order_by(Project.id.desc())
    )
    projects = result.scalars().all()
    data = []
    for p in projects:
        # Task stats
        task_result = await db.execute(
            select(
                func.count(Task.id).label("total"),
                func.count(Task.id).filter(Task.status == "done").label("done"),
                func.count(Task.id).filter(
                    and_(Task.due_date < date.today(), Task.status != "done")
                ).label("overdue"),
            ).where(and_(Task.project_id == p.id, Task.tenant_id == tenant_id))
        )
        ts = task_result.one()

        # Expense total
        exp_result = await db.execute(
            select(func.coalesce(func.sum(ProjectExpense.amount), 0)).where(
                and_(ProjectExpense.project_id == p.id, ProjectExpense.tenant_id == tenant_id)
            )
        )
        total_expenses = float(exp_result.scalar())

        # Health calculation
        schedule_health = "on_track"
        if ts.overdue > 0:
            schedule_health = "at_risk" if ts.overdue <= 3 else "off_track"

        budget_health = "on_track"
        if p.budget and float(p.budget) > 0:
            ratio = total_expenses / float(p.budget)
            if ratio >= 1.0:
                budget_health = "off_track"
            elif ratio >= 0.8:
                budget_health = "at_risk"

        overall = "on_track"
        if schedule_health == "off_track" or budget_health == "off_track":
            overall = "off_track"
        elif schedule_health == "at_risk" or budget_health == "at_risk":
            overall = "at_risk"

        data.append({
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "status": p.status,
            "priority": p.priority,
            "progress": p.progress,
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "budget": float(p.budget) if p.budget else 0,
            "actual_cost": total_expenses,
            "total_tasks": ts.total,
            "completed_tasks": ts.done,
            "overdue_tasks": ts.overdue,
            "schedule_health": schedule_health,
            "budget_health": budget_health,
            "overall_health": overall,
            "manager_id": p.manager_id,
        })
    return {"data": data}


@router.get("/time-reports")
async def time_reports(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    project_id: Optional[int] = None,
    user_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Time logs aggregated by user, project, date range."""
    q = select(TimeLog).where(TimeLog.tenant_id == tenant_id)
    if start_date:
        q = q.where(TimeLog.log_date >= date.fromisoformat(start_date))
    if end_date:
        q = q.where(TimeLog.log_date <= date.fromisoformat(end_date))
    if project_id:
        q = q.where(TimeLog.project_id == project_id)
    if user_id:
        q = q.where(TimeLog.user_id == user_id)

    result = await db.execute(q.order_by(TimeLog.log_date.desc()))
    logs = result.scalars().all()

    # Aggregate by user
    user_summary = {}
    project_summary = {}
    total_hours = 0
    billable_hours = 0

    for log in logs:
        hours = float(log.hours)
        total_hours += hours
        if log.is_billable:
            billable_hours += hours

        uid = log.user_id
        if uid not in user_summary:
            user_result = await db.execute(select(User).where(User.id == uid))
            u = user_result.scalar_one_or_none()
            user_summary[uid] = {
                "user_id": uid,
                "user_name": u.name if u else "Unknown",
                "total_hours": 0,
                "billable_hours": 0,
            }
        user_summary[uid]["total_hours"] += hours
        if log.is_billable:
            user_summary[uid]["billable_hours"] += hours

        pid = log.project_id
        if pid not in project_summary:
            proj_result = await db.execute(select(Project).where(Project.id == pid))
            proj = proj_result.scalar_one_or_none()
            project_summary[pid] = {
                "project_id": pid,
                "project_name": proj.name if proj else "Unknown",
                "total_hours": 0,
                "billable_hours": 0,
            }
        project_summary[pid]["total_hours"] += hours
        if log.is_billable:
            project_summary[pid]["billable_hours"] += hours

    return {
        "total_hours": round(total_hours, 2),
        "billable_hours": round(billable_hours, 2),
        "non_billable_hours": round(total_hours - billable_hours, 2),
        "by_user": list(user_summary.values()),
        "by_project": list(project_summary.values()),
        "entries": [_row_to_dict(l) for l in logs[:200]],
    }


@router.get("/budget-variance")
async def budget_variance(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Planned vs actual across all projects."""
    result = await db.execute(
        select(Project).where(
            and_(Project.tenant_id == tenant_id, Project.budget.isnot(None))
        )
    )
    projects = result.scalars().all()
    data = []
    for p in projects:
        exp_result = await db.execute(
            select(func.coalesce(func.sum(ProjectExpense.amount), 0)).where(
                and_(ProjectExpense.project_id == p.id, ProjectExpense.tenant_id == tenant_id)
            )
        )
        actual = float(exp_result.scalar())
        budget = float(p.budget) if p.budget else 0
        data.append({
            "project_id": p.id,
            "project_name": p.name,
            "budget": budget,
            "actual": actual,
            "variance": budget - actual,
            "variance_percent": round(((budget - actual) / budget * 100) if budget > 0 else 0, 2),
        })
    return {"data": data}


@router.get("/milestone-tracking")
async def milestone_tracking(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Milestones with on-time/delayed status."""
    result = await db.execute(
        select(Milestone).where(Milestone.tenant_id == tenant_id).order_by(Milestone.due_date.asc().nullslast())
    )
    milestones = result.scalars().all()
    data = []
    for m in milestones:
        status_detail = "on_track"
        if m.status == "completed":
            status_detail = "completed"
        elif m.due_date and m.due_date < date.today():
            status_detail = "overdue"
        elif m.due_date and m.due_date <= date.today() + timedelta(days=7):
            status_detail = "due_soon"

        proj_result = await db.execute(select(Project).where(Project.id == m.project_id))
        proj = proj_result.scalar_one_or_none()

        data.append({
            "id": m.id,
            "title": m.title,
            "project_id": m.project_id,
            "project_name": proj.name if proj else "Unknown",
            "due_date": m.due_date.isoformat() if m.due_date else None,
            "status": m.status,
            "status_detail": status_detail,
            "progress": m.progress,
            "is_billing_milestone": m.is_billing_milestone,
            "billing_amount": float(m.billing_amount) if m.billing_amount else None,
        })
    return {"data": data}


@router.get("/task-trends")
async def task_trends(
    project_id: Optional[int] = None,
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Tasks created vs completed over time (for burn-down/burn-up)."""
    start = date.today() - timedelta(days=days)
    q_base = and_(Task.tenant_id == tenant_id)
    if project_id:
        q_base = and_(q_base, Task.project_id == project_id)

    # Total tasks at start
    total_at_start = (await db.execute(
        select(func.count(Task.id)).where(and_(q_base, Task.created_at <= start))
    )).scalar() or 0

    # Get tasks created and completed per day
    data_points = []
    running_total = total_at_start
    running_completed = 0

    for i in range(days + 1):
        d = start + timedelta(days=i)
        created = (await db.execute(
            select(func.count(Task.id)).where(
                and_(q_base, func.date(Task.created_at) == d)
            )
        )).scalar() or 0
        completed = (await db.execute(
            select(func.count(Task.id)).where(
                and_(q_base, func.date(Task.completed_at) == d)
            )
        )).scalar() or 0
        running_total += created
        running_completed += completed
        data_points.append({
            "date": d.isoformat(),
            "created": created,
            "completed": completed,
            "total_open": running_total - running_completed,
            "total_completed": running_completed,
        })

    return {"data": data_points}


@router.get("/{project_id}/health-scorecard")
async def health_scorecard(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Composite health score: schedule, budget, scope."""
    proj_result = await db.execute(
        select(Project).where(and_(Project.id == project_id, Project.tenant_id == tenant_id))
    )
    proj = proj_result.scalar_one_or_none()
    if not proj:
        return {"error": "Project not found"}

    # Schedule health
    task_result = await db.execute(
        select(
            func.count(Task.id).label("total"),
            func.count(Task.id).filter(Task.status == "done").label("done"),
            func.count(Task.id).filter(
                and_(Task.due_date < date.today(), Task.status != "done")
            ).label("overdue"),
        ).where(and_(Task.project_id == project_id, Task.tenant_id == tenant_id))
    )
    ts = task_result.one()
    overdue_rate = (ts.overdue / ts.total * 100) if ts.total > 0 else 0
    schedule_score = max(100 - overdue_rate * 5, 0)

    # Budget health
    exp_result = await db.execute(
        select(func.coalesce(func.sum(ProjectExpense.amount), 0)).where(
            and_(ProjectExpense.project_id == project_id, ProjectExpense.tenant_id == tenant_id)
        )
    )
    total_expenses = float(exp_result.scalar())
    budget = float(proj.budget) if proj.budget else 0
    if budget > 0:
        budget_ratio = total_expenses / budget
        budget_score = max(100 - max(budget_ratio - 0.8, 0) * 500, 0)
    else:
        budget_score = 100

    # Scope health (task completion rate)
    scope_score = (ts.done / ts.total * 100) if ts.total > 0 else 100

    # Risk count
    risk_result = await db.execute(
        select(func.count(ProjectRisk.id)).where(
            and_(
                ProjectRisk.project_id == project_id,
                ProjectRisk.tenant_id == tenant_id,
                ProjectRisk.status.notin_(["resolved", "closed"]),
            )
        )
    )
    open_risks = risk_result.scalar() or 0

    # Issue count
    issue_result = await db.execute(
        select(func.count(ProjectIssue.id)).where(
            and_(
                ProjectIssue.project_id == project_id,
                ProjectIssue.tenant_id == tenant_id,
                ProjectIssue.status.notin_(["resolved", "closed"]),
            )
        )
    )
    open_issues = issue_result.scalar() or 0

    overall = round((schedule_score + budget_score + scope_score) / 3)

    return {
        "project_id": project_id,
        "schedule_score": round(schedule_score),
        "budget_score": round(budget_score),
        "scope_score": round(scope_score),
        "overall_score": overall,
        "overall_health": "on_track" if overall >= 70 else ("at_risk" if overall >= 40 else "off_track"),
        "total_tasks": ts.total,
        "completed_tasks": ts.done,
        "overdue_tasks": ts.overdue,
        "budget": budget,
        "actual_cost": total_expenses,
        "open_risks": open_risks,
        "open_issues": open_issues,
    }
