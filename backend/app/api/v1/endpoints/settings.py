"""
Settings endpoints:
  GET  /settings/organization           — fetch org settings
  PUT  /settings/organization           — update org settings

  GET  /settings/master-data/types      — list supported master data types
  GET  /settings/master-data/{type}     — list items for a master data type
  POST /settings/master-data/{type}     — create an item
  PUT  /settings/master-data/{type}/{id} — update an item
  DELETE /settings/master-data/{type}/{id} — delete an item
"""
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id
from app.core.security import create_invitation_token
from app.core.config import settings
from app.services.crud import CRUDService
from app.models.global_models import User, Tenant, TenantUser, TeamInvitation
from app.models.tenant_models import (
    OrganizationSettings,
    Role,
    Permission,
    RolePermission,
    UserRole,
    UnitOfMeasure,
    TaxRegion,
    TaxType,
    ProductCategory,
    ProductBrand,
    LeadSource,
    LeadStatus,
    OpportunityStage,
    ActivityType,
    TaskStatus,
    TicketStatus,
    TicketPriority,
    TicketCategory,
    DocumentCategory,
    Salutation,
    LeaveType,
    Industry,
    CustomerRating,
    LostReason,
    Competitor,
    Territory,
    ProjectCategory,
    TaskLabel,
    CostCategory,
    RiskCategory,
)

router = APIRouter(prefix="/settings", tags=["settings"])


# ---------------------------------------------------------------------------
# Master data registry
# Maps URL-safe type slugs → (Model, search_fields, has_sort_order)
# ---------------------------------------------------------------------------

MASTER_DATA_REGISTRY: dict[str, tuple] = {
    "units-of-measure":    (UnitOfMeasure,    ["name", "abbreviation"], True),
    "tax-regions":         (TaxRegion,        ["name", "code"],         True),
    "tax-types":           (TaxType,          ["name", "code"],         False),
    "product-categories":  (ProductCategory,  ["name"],                 True),
    "product-brands":      (ProductBrand,     ["name"],                 True),
    "lead-sources":        (LeadSource,       ["name"],                 True),
    "lead-statuses":       (LeadStatus,       ["name"],                 True),
    "opportunity-stages":  (OpportunityStage, ["name"],                 True),
    "activity-types":      (ActivityType,     ["name"],                 True),
    "task-statuses":       (TaskStatus,       ["name"],                 True),
    "ticket-statuses":     (TicketStatus,     ["name"],                 True),
    "ticket-priorities":   (TicketPriority,   ["name"],                 True),
    "ticket-categories":   (TicketCategory,   ["name"],                 True),
    "document-categories": (DocumentCategory, ["name"],                 True),
    "salutations":         (Salutation,       ["name"],                 False),
    "leave-types":         (LeaveType,        ["name"],                 False),
    "industries":          (Industry,         ["name"],                 True),
    "customer-ratings":    (CustomerRating,   ["name"],                 True),
    "lost-reasons":        (LostReason,       ["name"],                 True),
    "competitors":         (Competitor,       ["name"],                 True),
    "territories":         (Territory,        ["name"],                 True),
    "project-categories":  (ProjectCategory,  ["name"],                 True),
    "task-labels":         (TaskLabel,        ["name"],                 True),
    "cost-categories":     (CostCategory,     ["name"],                 True),
    "risk-categories":     (RiskCategory,     ["name"],                 True),
}


def _get_registry_entry(type_slug: str):
    entry = MASTER_DATA_REGISTRY.get(type_slug)
    if not entry:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown master data type '{type_slug}'. "
                   f"Available: {list(MASTER_DATA_REGISTRY.keys())}",
        )
    return entry


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
# Organization Settings
# ---------------------------------------------------------------------------

@router.get("/organization")
async def get_organization_settings(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(OrganizationSettings).where(OrganizationSettings.tenant_id == tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Organization settings not found")
    return _row_to_dict(obj)


@router.put("/organization")
async def update_organization_settings(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(OrganizationSettings).where(OrganizationSettings.tenant_id == tenant_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Organization settings not found")

    # Prevent overwriting tenant_id or primary key
    data.pop("id", None)
    data.pop("tenant_id", None)
    data["updated_by"] = user.id

    for key, value in data.items():
        if hasattr(obj, key):
            setattr(obj, key, value)

    await db.flush()
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


# ---------------------------------------------------------------------------
# Master Data — Types Catalogue
# ---------------------------------------------------------------------------

@router.get("/master-data/types")
async def list_master_data_types(
    _tenant_id: int = Depends(get_current_tenant_id),
):
    """Return all supported master data type slugs."""
    return {
        "types": [
            {"slug": slug, "label": slug.replace("-", " ").title()}
            for slug in MASTER_DATA_REGISTRY.keys()
        ]
    }


# ---------------------------------------------------------------------------
# Master Data — Default Values
# ---------------------------------------------------------------------------

MASTER_DATA_DEFAULTS: dict[str, list[dict]] = {
    "leave-types": [
        {"name": "Casual Leave", "code": "CL"},
        {"name": "Sick Leave", "code": "SL"},
        {"name": "Earned Leave", "code": "EL"},
        {"name": "Maternity Leave", "code": "ML"},
        {"name": "Paternity Leave", "code": "PL"},
        {"name": "Compensatory Off", "code": "CO"},
        {"name": "Loss of Pay", "code": "LOP"},
        {"name": "Bereavement Leave", "code": "BL"},
    ],
    "units-of-measure": [
        {"name": "Piece", "abbreviation": "pcs", "type": "quantity", "sort_order": 1},
        {"name": "Kilogram", "abbreviation": "kg", "type": "weight", "sort_order": 2},
        {"name": "Gram", "abbreviation": "g", "type": "weight", "sort_order": 3},
        {"name": "Litre", "abbreviation": "L", "type": "volume", "sort_order": 4},
        {"name": "Millilitre", "abbreviation": "mL", "type": "volume", "sort_order": 5},
        {"name": "Metre", "abbreviation": "m", "type": "length", "sort_order": 6},
        {"name": "Centimetre", "abbreviation": "cm", "type": "length", "sort_order": 7},
        {"name": "Box", "abbreviation": "box", "type": "quantity", "sort_order": 8},
        {"name": "Dozen", "abbreviation": "dz", "type": "quantity", "sort_order": 9},
        {"name": "Hour", "abbreviation": "hr", "type": "time", "sort_order": 10},
    ],
    "product-categories": [
        {"name": "Electronics", "sort_order": 1},
        {"name": "Furniture", "sort_order": 2},
        {"name": "Office Supplies", "sort_order": 3},
        {"name": "Software", "sort_order": 4},
        {"name": "Raw Materials", "sort_order": 5},
        {"name": "Consumables", "sort_order": 6},
        {"name": "Services", "sort_order": 7},
    ],
    "product-brands": [
        {"name": "Generic", "sort_order": 1},
        {"name": "In-House", "sort_order": 2},
    ],
    "lead-sources": [
        {"name": "Website", "sort_order": 1},
        {"name": "Referral", "sort_order": 2},
        {"name": "Cold Call", "sort_order": 3},
        {"name": "Social Media", "sort_order": 4},
        {"name": "Email Campaign", "sort_order": 5},
        {"name": "Trade Show", "sort_order": 6},
        {"name": "Advertisement", "sort_order": 7},
        {"name": "Partner", "sort_order": 8},
    ],
    "lead-statuses": [
        {"name": "New", "color": "#3b82f6", "is_default": True, "sort_order": 1},
        {"name": "Contacted", "color": "#8b5cf6", "sort_order": 2},
        {"name": "Qualified", "color": "#f59e0b", "sort_order": 3},
        {"name": "Unqualified", "color": "#6b7280", "sort_order": 4},
        {"name": "Converted", "color": "#22c55e", "is_won": True, "sort_order": 5},
        {"name": "Lost", "color": "#ef4444", "is_lost": True, "sort_order": 6},
    ],
    "opportunity-stages": [
        {"name": "Prospecting", "color": "#3b82f6", "probability": 10, "sort_order": 1},
        {"name": "Qualification", "color": "#8b5cf6", "probability": 20, "sort_order": 2},
        {"name": "Proposal", "color": "#f59e0b", "probability": 50, "sort_order": 3},
        {"name": "Negotiation", "color": "#f97316", "probability": 75, "sort_order": 4},
        {"name": "Closed Won", "color": "#22c55e", "probability": 100, "is_won": True, "sort_order": 5},
        {"name": "Closed Lost", "color": "#ef4444", "probability": 0, "is_lost": True, "sort_order": 6},
    ],
    "activity-types": [
        {"name": "Call", "icon": "phone", "color": "#3b82f6", "sort_order": 1},
        {"name": "Email", "icon": "mail", "color": "#8b5cf6", "sort_order": 2},
        {"name": "Meeting", "icon": "users", "color": "#22c55e", "sort_order": 3},
        {"name": "Task", "icon": "check-square", "color": "#f59e0b", "sort_order": 4},
        {"name": "Note", "icon": "file-text", "color": "#6b7280", "sort_order": 5},
        {"name": "Demo", "icon": "monitor", "color": "#f97316", "sort_order": 6},
    ],
    "task-statuses": [
        {"name": "To Do", "color": "#6b7280", "is_default": True, "sort_order": 1},
        {"name": "In Progress", "color": "#3b82f6", "sort_order": 2},
        {"name": "In Review", "color": "#f59e0b", "sort_order": 3},
        {"name": "Done", "color": "#22c55e", "is_closed": True, "sort_order": 4},
        {"name": "Cancelled", "color": "#ef4444", "is_closed": True, "sort_order": 5},
    ],
    "ticket-statuses": [
        {"name": "Open", "color": "#3b82f6", "is_default": True, "sort_order": 1},
        {"name": "In Progress", "color": "#f59e0b", "sort_order": 2},
        {"name": "Waiting on Customer", "color": "#8b5cf6", "sort_order": 3},
        {"name": "Resolved", "color": "#22c55e", "is_closed": True, "sort_order": 4},
        {"name": "Closed", "color": "#6b7280", "is_closed": True, "sort_order": 5},
    ],
    "ticket-priorities": [
        {"name": "Low", "color": "#6b7280", "sort_order": 1},
        {"name": "Medium", "color": "#f59e0b", "sort_order": 2},
        {"name": "High", "color": "#f97316", "sort_order": 3},
        {"name": "Critical", "color": "#ef4444", "sort_order": 4},
    ],
    "ticket-categories": [
        {"name": "Bug Report", "sort_order": 1},
        {"name": "Feature Request", "sort_order": 2},
        {"name": "General Inquiry", "sort_order": 3},
        {"name": "Technical Support", "sort_order": 4},
        {"name": "Billing", "sort_order": 5},
    ],
    "document-categories": [
        {"name": "Contracts", "sort_order": 1},
        {"name": "Invoices", "sort_order": 2},
        {"name": "Proposals", "sort_order": 3},
        {"name": "Reports", "sort_order": 4},
        {"name": "Policies", "sort_order": 5},
        {"name": "Templates", "sort_order": 6},
        {"name": "Other", "sort_order": 7},
    ],
    "industries": [
        {"name": "Technology", "slug": "technology", "sort_order": 1},
        {"name": "Healthcare", "slug": "healthcare", "sort_order": 2},
        {"name": "Financial Services", "slug": "financial-services", "sort_order": 3},
        {"name": "Manufacturing", "slug": "manufacturing", "sort_order": 4},
        {"name": "Retail & E-Commerce", "slug": "retail-ecommerce", "sort_order": 5},
        {"name": "Education", "slug": "education", "sort_order": 6},
        {"name": "Real Estate", "slug": "real-estate", "sort_order": 7},
        {"name": "Telecommunications", "slug": "telecommunications", "sort_order": 8},
        {"name": "Energy & Utilities", "slug": "energy-utilities", "sort_order": 9},
        {"name": "Professional Services", "slug": "professional-services", "sort_order": 10},
        {"name": "Media & Entertainment", "slug": "media-entertainment", "sort_order": 11},
        {"name": "Transportation & Logistics", "slug": "transportation-logistics", "sort_order": 12},
        {"name": "Government", "slug": "government", "sort_order": 13},
        {"name": "Non-Profit", "slug": "non-profit", "sort_order": 14},
        {"name": "Other", "slug": "other", "sort_order": 15},
    ],
    "customer-ratings": [
        {"name": "Hot", "slug": "hot", "color": "#ef4444", "sort_order": 1},
        {"name": "Warm", "slug": "warm", "color": "#f59e0b", "sort_order": 2},
        {"name": "Cold", "slug": "cold", "color": "#3b82f6", "sort_order": 3},
    ],
    "lost-reasons": [
        {"name": "Price too high", "slug": "price-too-high", "sort_order": 1},
        {"name": "Went with competitor", "slug": "competitor", "sort_order": 2},
        {"name": "No budget", "slug": "no-budget", "sort_order": 3},
        {"name": "No decision made", "slug": "no-decision", "sort_order": 4},
        {"name": "Poor timing", "slug": "poor-timing", "sort_order": 5},
        {"name": "Feature gap", "slug": "feature-gap", "sort_order": 6},
        {"name": "Lost contact", "slug": "lost-contact", "sort_order": 7},
        {"name": "Other", "slug": "other", "sort_order": 8},
    ],
    "salutations": [
        {"name": "Mr."},
        {"name": "Mrs."},
        {"name": "Ms."},
        {"name": "Dr."},
        {"name": "Prof."},
    ],
    "tax-regions": [
        {"name": "United States", "code": "US", "sort_order": 1},
        {"name": "European Union", "code": "EU", "sort_order": 2},
        {"name": "United Kingdom", "code": "UK", "sort_order": 3},
        {"name": "India", "code": "IN", "sort_order": 4},
    ],
    "tax-types": [
        {"name": "No Tax", "code": "NONE", "rate": 0},
        {"name": "Standard VAT", "code": "VAT", "rate": 20},
        {"name": "Reduced VAT", "code": "RVAT", "rate": 5},
        {"name": "GST", "code": "GST", "rate": 18},
        {"name": "Sales Tax", "code": "ST", "rate": 10},
    ],
}


@router.post("/master-data/{type}/seed-defaults", status_code=201)
async def seed_master_data_defaults(
    type: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Seed default values for a master data type. Only works if no records exist yet."""
    model, _, _ = _get_registry_entry(type)

    # Check if records already exist
    count_q = select(func.count()).select_from(model).where(model.tenant_id == tenant_id)
    existing = (await db.execute(count_q)).scalar() or 0
    if existing > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot seed defaults: {existing} record(s) already exist for '{type}'. "
                   "Defaults can only be loaded into an empty list.",
        )

    defaults = MASTER_DATA_DEFAULTS.get(type)
    if not defaults:
        raise HTTPException(
            status_code=404,
            detail=f"No default values defined for '{type}'.",
        )

    svc = CRUDService(model)
    created = []
    for item_data in defaults:
        obj = await svc.create(db, {**item_data, "is_active": True}, tenant_id, user.id)
        created.append(_row_to_dict(obj))

    await db.commit()
    return {"message": f"Loaded {len(created)} default {type}", "data": created}


# ---------------------------------------------------------------------------
# Master Data — Generic CRUD
# ---------------------------------------------------------------------------

@router.get("/master-data/{type}")
async def list_master_data(
    type: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    model, search_fields, has_sort = _get_registry_entry(type)
    svc = CRUDService(model)
    skip, limit = _paginate(page, per_page)
    order_by = "sort_order" if has_sort else None
    items, total = await svc.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=search_fields,
        order_by=order_by,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.post("/master-data/{type}", status_code=201)
async def create_master_data(
    type: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    model, _, _ = _get_registry_entry(type)
    svc = CRUDService(model)
    obj = await svc.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/master-data/{type}/{id}")
async def update_master_data(
    type: str,
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    model, _, _ = _get_registry_entry(type)
    svc = CRUDService(model)
    obj = await svc.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail=f"{type} item not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/master-data/{type}/{id}", status_code=204)
async def delete_master_data(
    type: str,
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    model, _, _ = _get_registry_entry(type)
    svc = CRUDService(model)
    deleted = await svc.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"{type} item not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Team Members
# ---------------------------------------------------------------------------

@router.get("/team-members")
async def list_team_members(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    from sqlalchemy import func, or_

    base = (
        select(
            User.id,
            User.name,
            User.email,
            TenantUser.created_at.label("joined_at"),
            TenantUser.is_active.label("is_active"),
            Role.name.label("role_name"),
            Role.id.label("role_id"),
        )
        .join(TenantUser, TenantUser.user_id == User.id)
        .outerjoin(UserRole, (UserRole.user_id == User.id) & (UserRole.tenant_id == tenant_id))
        .outerjoin(Role, Role.id == UserRole.role_id)
        .where(TenantUser.tenant_id == tenant_id)
    )

    if search:
        base = base.where(
            or_(
                User.name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
        )

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    skip, limit = _paginate(page, per_page)
    rows = (await db.execute(base.offset(skip).limit(limit))).all()

    items = [
        {
            "id": str(r.id),
            "full_name": r.name or r.email,
            "email": r.email,
            "role_name": r.role_name or "—",
            "role_id": str(r.role_id) if r.role_id else None,
            "status": "active" if getattr(r, "is_active", True) else "inactive",
            "joined_at": r.joined_at.isoformat() if r.joined_at else None,
            "last_active": None,
        }
        for r in rows
    ]
    return _list_response(items, total, page, per_page)


@router.patch("/team-members/{id}")
async def update_team_member(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Update a team member's role and/or active status."""
    result = await db.execute(
        select(TenantUser).where(TenantUser.user_id == id, TenantUser.tenant_id == tenant_id)
    )
    tu = result.scalar_one_or_none()
    if not tu:
        raise HTTPException(status_code=404, detail="Member not found")

    # Update is_active
    if "is_active" in data:
        if user.id == id and data["is_active"] is False:
            raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
        tu.is_active = bool(data["is_active"])

    # Update role
    if "role_id" in data and data["role_id"]:
        role_id = int(data["role_id"])
        # Check role exists
        role_result = await db.execute(select(Role).where(Role.id == role_id, Role.tenant_id == tenant_id))
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        # Upsert UserRole
        ur_result = await db.execute(
            select(UserRole).where(UserRole.user_id == id, UserRole.tenant_id == tenant_id)
        )
        ur = ur_result.scalar_one_or_none()
        if ur:
            ur.role_id = role_id
        else:
            db.add(UserRole(user_id=id, tenant_id=tenant_id, role_id=role_id))

    await db.commit()

    # Return updated member info
    member_result = await db.execute(
        select(
            User.id, User.name, User.email,
            TenantUser.created_at.label("joined_at"),
            TenantUser.is_active.label("is_active"),
            Role.name.label("role_name"),
            Role.id.label("role_id"),
        )
        .join(TenantUser, TenantUser.user_id == User.id)
        .outerjoin(UserRole, (UserRole.user_id == User.id) & (UserRole.tenant_id == tenant_id))
        .outerjoin(Role, Role.id == UserRole.role_id)
        .where(User.id == id, TenantUser.tenant_id == tenant_id)
    )
    r = member_result.first()
    return {
        "id": str(r.id),
        "full_name": r.name or r.email,
        "email": r.email,
        "role_name": r.role_name or "—",
        "role_id": str(r.role_id) if r.role_id else None,
        "status": "active" if r.is_active else "inactive",
        "joined_at": r.joined_at.isoformat() if r.joined_at else None,
        "last_active": None,
    }


@router.delete("/team-members/{id}", status_code=204)
async def remove_team_member(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    if user.id == id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    result = await db.execute(
        select(TenantUser).where(TenantUser.user_id == id, TenantUser.tenant_id == tenant_id)
    )
    tu = result.scalar_one_or_none()
    if not tu:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(tu)
    # Also remove role assignments
    roles_result = await db.execute(
        select(UserRole).where(UserRole.user_id == id, UserRole.tenant_id == tenant_id)
    )
    for ur in roles_result.scalars().all():
        await db.delete(ur)
    await db.commit()


# ---------------------------------------------------------------------------
# Team Invitations
# ---------------------------------------------------------------------------

@router.post("/team-invitations", status_code=201)
async def invite_team_member(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Send an invitation to join the tenant."""
    from datetime import datetime, timedelta
    from sqlalchemy import or_

    email = data.get("email", "").strip().lower()
    role_id = data.get("role_id")

    if not email:
        raise HTTPException(status_code=422, detail="Email is required")

    # Check if user is already a member
    existing_user = (await db.execute(
        select(User).where(User.email == email)
    )).scalar_one_or_none()

    if existing_user:
        already_member = (await db.execute(
            select(TenantUser).where(
                TenantUser.user_id == existing_user.id,
                TenantUser.tenant_id == tenant_id,
            )
        )).scalar_one_or_none()
        if already_member:
            raise HTTPException(status_code=409, detail="This user is already a team member")

    # Check for pending invitation to same email
    pending = (await db.execute(
        select(TeamInvitation).where(
            TeamInvitation.tenant_id == tenant_id,
            TeamInvitation.email == email,
            TeamInvitation.status == "pending",
        )
    )).scalar_one_or_none()
    if pending:
        raise HTTPException(
            status_code=409,
            detail="A pending invitation already exists for this email",
        )

    # Validate role_id if provided
    role_name = None
    if role_id:
        role = (await db.execute(
            select(Role).where(Role.id == int(role_id), Role.tenant_id == tenant_id)
        )).scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        role_name = role.name

    # Create invitation token
    token = create_invitation_token({
        "email": email,
        "tenant_id": tenant_id,
        "invited_by": user.id,
    })

    expires_at = datetime.utcnow() + timedelta(hours=settings.INVITATION_EXPIRE_HOURS)

    invitation = TeamInvitation(
        tenant_id=tenant_id,
        email=email,
        token=token,
        role_id=int(role_id) if role_id else None,
        invited_by=user.id,
        status="pending",
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    # Get tenant name for email
    tenant = (await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )).scalar_one()

    # Send invitation email via Celery
    from app.worker import app as celery_app
    invite_url = f"{settings.FRONTEND_URL}/accept-invitation?token={token}"
    celery_app.send_task(
        "app.tasks.send_invitation_email",
        args=[email, user.name, tenant.name, invite_url, role_name],
    )

    return {
        "id": invitation.id,
        "email": invitation.email,
        "status": invitation.status,
        "role_name": role_name,
        "expires_at": invitation.expires_at.isoformat(),
        "created_at": invitation.created_at.isoformat(),
    }


@router.get("/team-invitations")
async def list_team_invitations(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """List all invitations for the current tenant."""
    base = (
        select(
            TeamInvitation.id,
            TeamInvitation.email,
            TeamInvitation.status,
            TeamInvitation.expires_at,
            TeamInvitation.created_at,
            Role.name.label("role_name"),
            User.name.label("invited_by_name"),
        )
        .outerjoin(Role, Role.id == TeamInvitation.role_id)
        .join(User, User.id == TeamInvitation.invited_by)
        .where(TeamInvitation.tenant_id == tenant_id)
        .order_by(TeamInvitation.created_at.desc())
    )

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    skip, limit = _paginate(page, per_page)
    rows = (await db.execute(base.offset(skip).limit(limit))).all()

    items = [
        {
            "id": str(r.id),
            "email": r.email,
            "status": r.status,
            "role_name": r.role_name or "—",
            "invited_by": r.invited_by_name,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    return _list_response(items, total, page, per_page)


@router.delete("/team-invitations/{id}", status_code=204)
async def revoke_invitation(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Revoke a pending invitation."""
    result = await db.execute(
        select(TeamInvitation).where(
            TeamInvitation.id == id,
            TeamInvitation.tenant_id == tenant_id,
            TeamInvitation.status == "pending",
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already processed")
    invitation.status = "revoked"
    await db.commit()


@router.post("/team-invitations/{id}/resend")
async def resend_invitation(
    id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Resend a pending invitation email."""
    from datetime import datetime, timedelta

    result = await db.execute(
        select(TeamInvitation).where(
            TeamInvitation.id == id,
            TeamInvitation.tenant_id == tenant_id,
            TeamInvitation.status == "pending",
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already processed")

    # Refresh token and expiry
    invitation.token = create_invitation_token({
        "email": invitation.email,
        "tenant_id": tenant_id,
        "invited_by": user.id,
    })
    invitation.expires_at = datetime.utcnow() + timedelta(hours=settings.INVITATION_EXPIRE_HOURS)
    await db.commit()
    await db.refresh(invitation)

    # Get role name
    role_name = None
    if invitation.role_id:
        role = (await db.execute(
            select(Role).where(Role.id == invitation.role_id)
        )).scalar_one_or_none()
        role_name = role.name if role else None

    tenant = (await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )).scalar_one()

    from app.worker import app as celery_app
    invite_url = f"{settings.FRONTEND_URL}/accept-invitation?token={invitation.token}"
    celery_app.send_task(
        "app.tasks.send_invitation_email",
        args=[invitation.email, user.name, tenant.name, invite_url, role_name],
    )

    return {"message": "Invitation resent"}


# ---------------------------------------------------------------------------
# Team Roles
# ---------------------------------------------------------------------------

@router.post("/team-roles/seed-defaults", status_code=201)
async def seed_default_roles(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Seed default roles for the current tenant. Skips roles that already exist."""
    from app.api.v1.endpoints.auth import create_default_roles
    roles_map = await create_default_roles(db, tenant_id, user.id)
    await db.commit()
    return {
        "message": f"Created {len(roles_map)} default roles",
        "roles": [{"name": r.name, "slug": r.slug} for r in roles_map.values()],
    }


@router.get("/team-roles")
async def list_team_roles(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    svc = CRUDService(Role)
    skip, limit = _paginate(page, per_page)
    items, total = await svc.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name"],
    )
    role_ids = [i.id for i in items]
    # Count members per role
    member_counts: dict[int, int] = {}
    if role_ids:
        result = await db.execute(
            select(UserRole.role_id, func.count(UserRole.id))
            .where(UserRole.role_id.in_(role_ids), UserRole.tenant_id == tenant_id)
            .group_by(UserRole.role_id)
        )
        member_counts = dict(result.all())
    # Count permissions per role
    perm_counts: dict[int, int] = {}
    if role_ids:
        result = await db.execute(
            select(RolePermission.role_id, func.count(RolePermission.id))
            .where(RolePermission.role_id.in_(role_ids))
            .group_by(RolePermission.role_id)
        )
        perm_counts = dict(result.all())
    data = []
    for i in items:
        d = _row_to_dict(i)
        d["member_count"] = member_counts.get(i.id, 0)
        d["permissions_count"] = perm_counts.get(i.id, 0)
        data.append(d)
    return _list_response(data, total, page, per_page)


@router.get("/team-roles/{id}")
async def get_team_role(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    svc = CRUDService(Role)
    obj = await svc.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Role not found")
    role_data = _row_to_dict(obj)
    # Get permissions for this role
    result = await db.execute(
        select(Permission.slug).join(
            RolePermission, RolePermission.permission_id == Permission.id
        ).where(RolePermission.role_id == id)
    )
    role_data["permissions"] = [r[0] for r in result.all()]
    # Get member count
    result = await db.execute(
        select(func.count(UserRole.id))
        .where(UserRole.role_id == id, UserRole.tenant_id == tenant_id)
    )
    role_data["member_count"] = result.scalar() or 0
    return role_data


@router.post("/team-roles", status_code=201)
async def create_team_role(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    import re
    permissions = data.pop("permissions", [])
    # Auto-generate slug from name if not provided
    if not data.get("slug"):
        data["slug"] = re.sub(r"[^a-z0-9]+", "-", data.get("name", "").lower()).strip("-")
    svc = CRUDService(Role)
    obj = await svc.create(db, data, tenant_id, user.id)
    await db.flush()
    # Assign permissions
    if permissions:
        perm_result = await db.execute(
            select(Permission).where(Permission.slug.in_(permissions))
        )
        for perm in perm_result.scalars().all():
            db.add(RolePermission(role_id=obj.id, permission_id=perm.id))
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/team-roles/{id}")
@router.patch("/team-roles/{id}")
async def update_team_role(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    permissions = data.pop("permissions", None)
    svc = CRUDService(Role)
    obj = await svc.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Role not found")

    # Update permissions if provided
    if permissions is not None:
        # Remove old
        old = await db.execute(
            select(RolePermission).where(RolePermission.role_id == id)
        )
        for rp in old.scalars().all():
            await db.delete(rp)
        # Add new
        perm_result = await db.execute(
            select(Permission).where(Permission.slug.in_(permissions))
        )
        for perm in perm_result.scalars().all():
            db.add(RolePermission(role_id=obj.id, permission_id=perm.id))

    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/team-roles/{id}", status_code=204)
async def delete_team_role(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    svc = CRUDService(Role)
    deleted = await svc.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Role not found")
    await db.commit()
