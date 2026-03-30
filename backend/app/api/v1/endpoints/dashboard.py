"""Dashboard endpoints — aggregated stats for the main dashboard."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_tenant_id, get_current_user
from app.models.global_models import User
from app.models.crm import Customer, Lead
from app.models.sales import SalesOrder
from app.models.projects import Project
from app.models.hr import Employee
from app.models.tickets import Ticket

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Return aggregated counts for dashboard stat cards."""

    async def _count(model, *filters):
        q = select(func.count()).select_from(model).where(
            model.tenant_id == tenant_id, *filters
        )
        result = await db.execute(q)
        return result.scalar() or 0

    total_customers = await _count(Customer)
    active_leads = await _count(Lead, Lead.status.notin_(["converted", "lost", "won"]))
    open_orders = await _count(SalesOrder, SalesOrder.status.notin_(["cancelled", "completed"]))
    active_projects = await _count(Project, Project.status.notin_(["completed", "archived", "cancelled"]))
    employees = await _count(Employee)
    open_tickets = await _count(Ticket, Ticket.resolved_at.is_(None))

    return {
        "total_customers": total_customers,
        "active_leads": active_leads,
        "open_orders": open_orders,
        "active_projects": active_projects,
        "employees": employees,
        "open_tickets": open_tickets,
    }
