"""CRM Analytics — pipeline, conversion, forecast, activity, and win/loss endpoints."""
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id, require_permission
from app.models.crm import Lead, Contact, Customer, Opportunity, Activity
from app.models.tenant_models import Campaign
from app.models.global_models import User

router = APIRouter(prefix="/crm/analytics", tags=["crm-analytics"])


def _parse_date(val: str | None) -> date | None:
    if not val:
        return None
    try:
        return date.fromisoformat(val)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Pipeline Summary
# ---------------------------------------------------------------------------

@router.get("/pipeline-summary")
async def pipeline_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "view")),
):
    base = select(Opportunity).where(Opportunity.tenant_id == tenant_id)
    d_from = _parse_date(date_from)
    d_to = _parse_date(date_to)
    if d_from:
        base = base.where(Opportunity.created_at >= datetime.combine(d_from, datetime.min.time()))
    if d_to:
        base = base.where(Opportunity.created_at <= datetime.combine(d_to, datetime.max.time()))

    # Aggregate
    total_pipeline = (await db.execute(
        select(func.sum(Opportunity.expected_amount)).where(
            Opportunity.tenant_id == tenant_id,
            Opportunity.stage.notin_(["closed_won", "closed_lost", "won", "lost"]),
        )
    )).scalar() or 0

    weighted_pipeline = (await db.execute(
        select(func.sum(Opportunity.weighted_amount)).where(
            Opportunity.tenant_id == tenant_id,
            Opportunity.stage.notin_(["closed_won", "closed_lost", "won", "lost"]),
        )
    )).scalar() or 0

    open_deals = (await db.execute(
        select(func.count()).select_from(Opportunity).where(
            Opportunity.tenant_id == tenant_id,
            Opportunity.stage.notin_(["closed_won", "closed_lost", "won", "lost"]),
        )
    )).scalar() or 0

    won_count = (await db.execute(
        select(func.count()).select_from(Opportunity).where(
            Opportunity.tenant_id == tenant_id,
            Opportunity.stage.in_(["closed_won", "won"]),
        )
    )).scalar() or 0

    won_value = (await db.execute(
        select(func.sum(Opportunity.expected_amount)).where(
            Opportunity.tenant_id == tenant_id,
            Opportunity.stage.in_(["closed_won", "won"]),
        )
    )).scalar() or 0

    avg_deal_size = (await db.execute(
        select(func.avg(Opportunity.expected_amount)).where(
            Opportunity.tenant_id == tenant_id,
            Opportunity.expected_amount > 0,
        )
    )).scalar() or 0

    # Deals by stage
    stage_q = await db.execute(
        select(Opportunity.stage, func.count(), func.sum(Opportunity.expected_amount)).where(
            Opportunity.tenant_id == tenant_id,
        ).group_by(Opportunity.stage)
    )
    by_stage = [{"stage": r[0], "count": r[1], "value": float(r[2] or 0)} for r in stage_q.all()]

    return {
        "total_pipeline": float(total_pipeline),
        "weighted_pipeline": float(weighted_pipeline),
        "open_deals": open_deals,
        "won_count": won_count,
        "won_value": float(won_value),
        "avg_deal_size": round(float(avg_deal_size), 2),
        "by_stage": by_stage,
    }


# ---------------------------------------------------------------------------
# Conversion Funnel
# ---------------------------------------------------------------------------

@router.get("/conversion-funnel")
async def conversion_funnel(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "view")),
):
    status_q = await db.execute(
        select(Lead.status, func.count()).where(Lead.tenant_id == tenant_id).group_by(Lead.status)
    )
    by_status = {r[0]: r[1] for r in status_q.all()}
    total = sum(by_status.values())

    return {
        "total_leads": total,
        "by_status": by_status,
        "conversion_rate": round(by_status.get("converted", 0) / total * 100, 1) if total else 0,
        "qualification_rate": round(by_status.get("qualified", 0) / total * 100, 1) if total else 0,
    }


# ---------------------------------------------------------------------------
# Lead Source Analysis
# ---------------------------------------------------------------------------

@router.get("/lead-source-analysis")
async def lead_source_analysis(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "view")),
):
    source_q = await db.execute(
        select(
            Lead.source,
            func.count().label("count"),
            func.sum(case((Lead.status == "converted", 1), else_=0)).label("converted"),
        ).where(Lead.tenant_id == tenant_id).group_by(Lead.source)
    )
    results = []
    for r in source_q.all():
        count = r[1]
        converted = r[2] or 0
        results.append({
            "source": r[0] or "Unknown",
            "count": count,
            "converted": converted,
            "conversion_rate": round(converted / count * 100, 1) if count else 0,
        })
    return {"sources": results}


# ---------------------------------------------------------------------------
# Sales Forecast
# ---------------------------------------------------------------------------

@router.get("/sales-forecast")
async def sales_forecast(
    months: int = Query(6, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "view")),
):
    today = date.today()
    forecast = []
    for i in range(months):
        month_start = date(today.year + (today.month + i - 1) // 12, (today.month + i - 1) % 12 + 1, 1)
        if (today.month + i) % 12 == 0:
            month_end = date(today.year + (today.month + i) // 12, 12, 31)
        else:
            next_month = date(today.year + (today.month + i) // 12, (today.month + i) % 12 + 1, 1)
            month_end = next_month - timedelta(days=1)

        expected = (await db.execute(
            select(func.sum(Opportunity.expected_amount)).where(
                Opportunity.tenant_id == tenant_id,
                Opportunity.expected_close_date >= month_start,
                Opportunity.expected_close_date <= month_end,
                Opportunity.stage.notin_(["closed_lost", "lost"]),
            )
        )).scalar() or 0

        weighted = (await db.execute(
            select(func.sum(Opportunity.weighted_amount)).where(
                Opportunity.tenant_id == tenant_id,
                Opportunity.expected_close_date >= month_start,
                Opportunity.expected_close_date <= month_end,
                Opportunity.stage.notin_(["closed_lost", "lost"]),
            )
        )).scalar() or 0

        forecast.append({
            "month": month_start.strftime("%Y-%m"),
            "expected_revenue": float(expected),
            "weighted_revenue": float(weighted),
        })
    return {"forecast": forecast}


# ---------------------------------------------------------------------------
# Activity Metrics
# ---------------------------------------------------------------------------

@router.get("/activity-metrics")
async def activity_metrics(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("activities", "view")),
):
    conds = [Activity.tenant_id == tenant_id]
    d_from = _parse_date(date_from)
    d_to = _parse_date(date_to)
    if d_from:
        conds.append(Activity.created_at >= datetime.combine(d_from, datetime.min.time()))
    if d_to:
        conds.append(Activity.created_at <= datetime.combine(d_to, datetime.max.time()))

    # By type
    type_q = await db.execute(
        select(Activity.type, func.count()).where(*conds).group_by(Activity.type)
    )
    by_type = [{"type": r[0], "count": r[1]} for r in type_q.all()]

    # By user
    user_q = await db.execute(
        select(Activity.assigned_to, func.count()).where(*conds).group_by(Activity.assigned_to)
    )
    by_user = [{"user_id": r[0], "count": r[1]} for r in user_q.all()]

    # Overdue
    overdue = (await db.execute(
        select(func.count()).select_from(Activity).where(
            Activity.tenant_id == tenant_id,
            Activity.due_at < datetime.utcnow(),
            Activity.status == "pending",
        )
    )).scalar() or 0

    total = (await db.execute(
        select(func.count()).select_from(Activity).where(*conds)
    )).scalar() or 0

    return {
        "total": total,
        "by_type": by_type,
        "by_user": by_user,
        "overdue": overdue,
    }


# ---------------------------------------------------------------------------
# Top Performers
# ---------------------------------------------------------------------------

@router.get("/top-performers")
async def top_performers(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "view")),
):
    q = await db.execute(
        select(
            Opportunity.assigned_to,
            func.count().label("won_deals"),
            func.sum(Opportunity.expected_amount).label("revenue"),
        ).where(
            Opportunity.tenant_id == tenant_id,
            Opportunity.stage.in_(["closed_won", "won"]),
            Opportunity.assigned_to != None,
        ).group_by(Opportunity.assigned_to).order_by(func.sum(Opportunity.expected_amount).desc()).limit(limit)
    )
    performers = []
    for r in q.all():
        user_result = await db.execute(select(User.name, User.email).where(User.id == r[0]))
        user = user_result.first()
        performers.append({
            "user_id": r[0],
            "name": user[0] if user else "Unknown",
            "email": user[1] if user else "",
            "won_deals": r[1],
            "revenue": float(r[2] or 0),
        })
    return {"performers": performers}


# ---------------------------------------------------------------------------
# Win/Loss Analysis
# ---------------------------------------------------------------------------

@router.get("/win-loss-analysis")
async def win_loss_analysis(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "view")),
):
    won = (await db.execute(
        select(func.count()).select_from(Opportunity).where(
            Opportunity.tenant_id == tenant_id, Opportunity.stage.in_(["closed_won", "won"]),
        )
    )).scalar() or 0

    lost = (await db.execute(
        select(func.count()).select_from(Opportunity).where(
            Opportunity.tenant_id == tenant_id, Opportunity.stage.in_(["closed_lost", "lost"]),
        )
    )).scalar() or 0

    total = won + lost
    win_rate = round(won / total * 100, 1) if total else 0

    # Loss reasons breakdown
    from app.models.crm import Opportunity as Opp
    reason_q = await db.execute(
        select(Opp.lost_reason_id, func.count()).where(
            Opp.tenant_id == tenant_id,
            Opp.stage.in_(["closed_lost", "lost"]),
            Opp.lost_reason_id != None,
        ).group_by(Opp.lost_reason_id)
    )
    loss_reasons = [{"lost_reason_id": r[0], "count": r[1]} for r in reason_q.all()]

    return {
        "won": won, "lost": lost, "total": total,
        "win_rate": win_rate,
        "loss_reasons": loss_reasons,
    }


# ---------------------------------------------------------------------------
# Campaign ROI
# ---------------------------------------------------------------------------

@router.get("/campaign-roi")
async def campaign_roi(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("campaigns", "view")),
):
    campaigns_q = await db.execute(
        select(Campaign).where(Campaign.tenant_id == tenant_id)
    )
    results = []
    for camp in campaigns_q.scalars().all():
        leads_count = (await db.execute(
            select(func.count()).select_from(Lead).where(Lead.campaign_id == camp.id, Lead.tenant_id == tenant_id)
        )).scalar() or 0

        converted = (await db.execute(
            select(func.count()).select_from(Lead).where(
                Lead.campaign_id == camp.id, Lead.tenant_id == tenant_id, Lead.status == "converted",
            )
        )).scalar() or 0

        revenue = (await db.execute(
            select(func.sum(Opportunity.expected_amount)).where(
                Opportunity.campaign_id == camp.id, Opportunity.tenant_id == tenant_id,
                Opportunity.stage.in_(["closed_won", "won"]),
            )
        )).scalar() or 0

        cost = float(camp.actual_cost or camp.budget or 0)
        roi = round((float(revenue) - cost) / cost * 100, 1) if cost > 0 else 0

        results.append({
            "campaign_id": camp.id,
            "campaign_name": camp.name,
            "campaign_code": camp.code,
            "leads": leads_count,
            "converted": converted,
            "conversion_rate": round(converted / leads_count * 100, 1) if leads_count else 0,
            "revenue": float(revenue),
            "cost": cost,
            "roi": roi,
        })
    return {"campaigns": results}
