"""
Phase 4: Project Risk Management — risks, issues, change requests, status reports, meetings.
"""
from datetime import datetime, date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id
from app.services.crud import CRUDService
from app.services.numbering import commit_number
from app.models.global_models import User
from app.models.projects import (
    ProjectRisk, ProjectIssue, ChangeRequest, StatusReport,
    MeetingNote, Project, Task, Milestone,
)


router = APIRouter(prefix="/projects", tags=["project-risk"])


def _row_to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def _paginate(page, per_page):
    return (page - 1) * per_page, per_page


def _list_response(items, total, page, per_page):
    return {
        "data": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max((total + per_page - 1) // per_page, 1),
    }


PROBABILITY_MAP = {"very_low": 1, "low": 2, "medium": 3, "high": 4, "very_high": 5}
IMPACT_MAP = {"very_low": 1, "low": 2, "medium": 3, "high": 4, "very_high": 5}


# ---------------------------------------------------------------------------
# Risks
# ---------------------------------------------------------------------------

risk_service = CRUDService(ProjectRisk)


@router.get("/{project_id}/risks")
async def list_risks(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {"project_id": project_id}
    if status:
        filters["status"] = status
    items, total = await risk_service.get_list(
        db, tenant_id, skip=skip, limit=limit, filters=filters,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.post("/{project_id}/risks", status_code=201)
async def create_risk(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["project_id"] = project_id
    p = PROBABILITY_MAP.get(data.get("probability", "medium"), 3)
    i = IMPACT_MAP.get(data.get("impact", "medium"), 3)
    data["risk_score"] = p * i
    obj = await risk_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/risks/{id}")
async def update_risk(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    if "probability" in data or "impact" in data:
        result = await db.execute(
            select(ProjectRisk).where(and_(ProjectRisk.id == id, ProjectRisk.tenant_id == tenant_id))
        )
        existing = result.scalar_one_or_none()
        if existing:
            p = PROBABILITY_MAP.get(data.get("probability", existing.probability), 3)
            i = IMPACT_MAP.get(data.get("impact", existing.impact), 3)
            data["risk_score"] = p * i
    if data.get("status") == "resolved":
        data["resolved_at"] = datetime.utcnow()
    obj = await risk_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Risk not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/risks/{id}", status_code=204)
async def delete_risk(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await risk_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Risk not found")
    await db.commit()


@router.get("/{project_id}/risk-matrix")
async def risk_matrix(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(ProjectRisk).where(
            and_(
                ProjectRisk.project_id == project_id,
                ProjectRisk.tenant_id == tenant_id,
                ProjectRisk.status.notin_(["resolved", "closed"]),
            )
        )
    )
    risks = result.scalars().all()
    matrix = {}
    for r in risks:
        p = PROBABILITY_MAP.get(r.probability, 3)
        i = IMPACT_MAP.get(r.impact, 3)
        key = f"{p}_{i}"
        if key not in matrix:
            matrix[key] = []
        matrix[key].append({"id": r.id, "title": r.title, "status": r.status})
    return {
        "risks": [_row_to_dict(r) for r in risks],
        "matrix": matrix,
        "total": len(risks),
    }


# ---------------------------------------------------------------------------
# Issues
# ---------------------------------------------------------------------------

issue_service = CRUDService(ProjectIssue)


@router.get("/{project_id}/issues")
async def list_issues(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {"project_id": project_id}
    if status:
        filters["status"] = status
    if priority:
        filters["priority"] = priority
    items, total = await issue_service.get_list(
        db, tenant_id, skip=skip, limit=limit, filters=filters,
    )
    results = []
    for i in items:
        d = _row_to_dict(i)
        if i.reported_by:
            u = (await db.execute(select(User).where(User.id == i.reported_by))).scalar_one_or_none()
            d["reporter_name"] = u.name if u else None
        if i.assigned_to:
            u = (await db.execute(select(User).where(User.id == i.assigned_to))).scalar_one_or_none()
            d["assigned_to_name"] = u.name if u else None
        results.append(d)
    return _list_response(results, total, page, per_page)


@router.post("/{project_id}/issues", status_code=201)
async def create_issue(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["project_id"] = project_id
    data.setdefault("reported_by", user.id)
    obj = await issue_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/issues/{id}")
async def update_issue(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    if data.get("status") in ("resolved", "closed"):
        data["resolved_at"] = datetime.utcnow()
    obj = await issue_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Issue not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/issues/{id}", status_code=204)
async def delete_issue(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await issue_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Issue not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Change Requests
# ---------------------------------------------------------------------------

cr_service = CRUDService(ChangeRequest)


@router.get("/{project_id}/change-requests")
async def list_change_requests(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {"project_id": project_id}
    if status:
        filters["status"] = status
    items, total = await cr_service.get_list(
        db, tenant_id, skip=skip, limit=limit, filters=filters,
    )
    results = []
    for i in items:
        d = _row_to_dict(i)
        if i.requested_by:
            u = (await db.execute(select(User).where(User.id == i.requested_by))).scalar_one_or_none()
            d["requested_by_name"] = u.name if u else None
        if i.approved_by:
            u = (await db.execute(select(User).where(User.id == i.approved_by))).scalar_one_or_none()
            d["approved_by_name"] = u.name if u else None
        results.append(d)
    return _list_response(results, total, page, per_page)


@router.post("/{project_id}/change-requests", status_code=201)
async def create_change_request(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["project_id"] = project_id
    data["requested_by"] = user.id
    if not data.get("number"):
        data["number"] = await commit_number(db, tenant_id, "change_request")
    obj = await cr_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/change-requests/{id}")
async def update_change_request(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await cr_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Change request not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/change-requests/{id}", status_code=204)
async def delete_change_request(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await cr_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Change request not found")
    await db.commit()


@router.patch("/{project_id}/change-requests/{id}/approve")
async def approve_change_request(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(ChangeRequest).where(and_(ChangeRequest.id == id, ChangeRequest.tenant_id == tenant_id))
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Change request not found")
    obj.status = data.get("status", "approved")
    obj.approved_by = user.id
    obj.approved_at = datetime.utcnow()
    obj.updated_by = user.id
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


# ---------------------------------------------------------------------------
# Status Reports
# ---------------------------------------------------------------------------

report_service = CRUDService(StatusReport)


@router.get("/{project_id}/status-reports")
async def list_status_reports(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    items, total = await report_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        filters={"project_id": project_id},
        order_by="report_date",
        sort_direction="desc",
    )
    results = []
    for i in items:
        d = _row_to_dict(i)
        if i.created_by:
            u = (await db.execute(select(User).where(User.id == i.created_by))).scalar_one_or_none()
            d["created_by_name"] = u.name if u else None
        results.append(d)
    return _list_response(results, total, page, per_page)


@router.post("/{project_id}/status-reports/generate", status_code=201)
async def generate_status_report(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Auto-generate a status report from current project data."""
    today = date.today()
    period_type = data.get("period_type", "weekly")
    if period_type == "weekly":
        period_start = today - timedelta(days=7)
    else:
        period_start = today.replace(day=1)
    period_end = today

    # Accomplishments: tasks completed in period
    comp_result = await db.execute(
        select(Task).where(
            and_(
                Task.project_id == project_id,
                Task.tenant_id == tenant_id,
                Task.status == "done",
                Task.completed_at >= period_start,
                Task.completed_at <= period_end,
            )
        )
    )
    accomplishments = [t.title for t in comp_result.scalars().all()]

    # Planned next: tasks due in next period
    next_end = today + timedelta(days=7 if period_type == "weekly" else 30)
    planned_result = await db.execute(
        select(Task).where(
            and_(
                Task.project_id == project_id,
                Task.tenant_id == tenant_id,
                Task.status != "done",
                Task.due_date >= today,
                Task.due_date <= next_end,
            )
        )
    )
    planned_next = [t.title for t in planned_result.scalars().all()]

    # Risks/Issues
    risk_result = await db.execute(
        select(ProjectRisk).where(
            and_(
                ProjectRisk.project_id == project_id,
                ProjectRisk.tenant_id == tenant_id,
                ProjectRisk.status.notin_(["resolved", "closed"]),
            )
        )
    )
    risks = [r.title for r in risk_result.scalars().all()]

    issue_result = await db.execute(
        select(ProjectIssue).where(
            and_(
                ProjectIssue.project_id == project_id,
                ProjectIssue.tenant_id == tenant_id,
                ProjectIssue.status.notin_(["resolved", "closed"]),
            )
        )
    )
    issues = [i.title for i in issue_result.scalars().all()]

    number = await commit_number(db, tenant_id, "status_report")

    report_data = {
        "project_id": project_id,
        "number": number,
        "report_date": today.isoformat(),
        "period_type": period_type,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "summary": data.get("summary", f"Status report for {period_start} to {period_end}"),
        "accomplishments": accomplishments,
        "planned_next": planned_next,
        "risks_issues": risks + issues,
        "status": "draft",
    }
    obj = await report_service.create(db, report_data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/status-reports/{id}")
async def update_status_report(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await report_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Status report not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.patch("/{project_id}/status-reports/{id}/publish")
async def publish_status_report(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(StatusReport).where(and_(StatusReport.id == id, StatusReport.tenant_id == tenant_id))
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Status report not found")
    obj.status = "published"
    obj.updated_by = user.id
    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/status-reports/{id}", status_code=204)
async def delete_status_report(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await report_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Status report not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Meeting Notes
# ---------------------------------------------------------------------------

meeting_service = CRUDService(MeetingNote)


@router.get("/{project_id}/meetings")
async def list_meetings(
    project_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    items, total = await meeting_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        filters={"project_id": project_id},
        order_by="meeting_date",
        sort_direction="desc",
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/{project_id}/meetings/{id}")
async def get_meeting(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await meeting_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return _row_to_dict(obj)


@router.post("/{project_id}/meetings", status_code=201)
async def create_meeting(
    project_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["project_id"] = project_id
    obj = await meeting_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{project_id}/meetings/{id}")
async def update_meeting(
    project_id: int,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await meeting_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{project_id}/meetings/{id}", status_code=204)
async def delete_meeting(
    project_id: int,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await meeting_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Integration endpoints
# ---------------------------------------------------------------------------

@router.post("/{project_id}/link-opportunity/{opportunity_id}")
async def link_opportunity(
    project_id: int,
    opportunity_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(Project).where(and_(Project.id == project_id, Project.tenant_id == tenant_id))
    )
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    proj.opportunity_id = opportunity_id
    proj.updated_by = user.id
    await db.flush()
    await db.commit()
    return {"message": "Opportunity linked", "opportunity_id": opportunity_id}
