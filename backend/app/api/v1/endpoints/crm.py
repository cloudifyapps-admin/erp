from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_tenant_id, get_current_user, require_permission
from app.core.database import get_db
from app.models.crm import Activity, Contact, Customer, CustomerContact, Lead, Opportunity
from app.models.global_models import User
from app.services.crud import CRUDService
from app.services.numbering import commit_number

router = APIRouter(prefix="/crm", tags=["crm"])

# ---------------------------------------------------------------------------
# Service instances
# ---------------------------------------------------------------------------

lead_service = CRUDService(Lead)
contact_service = CRUDService(Contact)
customer_service = CRUDService(Customer)
opportunity_service = CRUDService(Opportunity)
activity_service = CRUDService(Activity)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _paginate(page: int, per_page: int) -> tuple[int, int]:
    """Return (skip, limit) from 1-based page numbers."""
    page = max(1, page)
    per_page = max(1, min(per_page, 200))
    return (page - 1) * per_page, per_page


def _list_response(items, total: int, page: int, per_page: int) -> dict:
    return {
        "items": [_row(item) for item in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),  # ceiling division
    }


def _row(obj) -> dict:
    """Serialize a SQLAlchemy model instance to a plain dict."""
    return {
        c.name: getattr(obj, c.name)
        for c in obj.__table__.columns
    }


# ===========================================================================
# LEADS
# ===========================================================================

@router.get("/leads")
async def list_leads(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    assigned_to: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {}
    if status:
        filters["status"] = status
    if assigned_to is not None:
        filters["assigned_to"] = assigned_to

    items, total = await lead_service.get_list(
        db,
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        search=search,
        search_fields=["first_name", "last_name", "email", "company", "title"],
        filters=filters,
    )
    return _list_response(items, total, page, per_page)


@router.post("/leads", status_code=status.HTTP_201_CREATED)
async def create_lead(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    data = await request.json()
    lead = await lead_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.commit()
    await db.refresh(lead)
    return _row(lead)


@router.get("/leads/{lead_id}")
async def get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "view")),
):
    lead = await lead_service.get_by_id(db, lead_id, tenant_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return _row(lead)


@router.put("/leads/{lead_id}")
async def update_lead(
    lead_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    data = await request.json()
    lead = await lead_service.update(db, lead_id, data, tenant_id=tenant_id, user_id=current_user.id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    await db.commit()
    await db.refresh(lead)
    return _row(lead)


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    deleted = await lead_service.delete(db, lead_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    await db.commit()


# ---------------------------------------------------------------------------
# POST /leads/{id}/convert
# ---------------------------------------------------------------------------

@router.post("/leads/{lead_id}/convert", status_code=status.HTTP_201_CREATED)
async def convert_lead(
    lead_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    """
    Convert a lead into a Contact and (optionally) a Customer.

    Request body (all optional):
    {
        "contact": { ...extra contact fields... },
        "customer": { ...extra customer fields... },  // omit to skip customer creation
        "create_opportunity": { "title": "...", ... }  // omit to skip
    }
    """
    lead = await lead_service.get_by_id(db, lead_id, tenant_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if lead.status == "converted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Lead is already converted",
        )

    body: dict = await request.json()
    now = datetime.utcnow()

    # --- Create Contact ---
    contact_data = {
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "email": lead.email,
        "phone": lead.phone,
        "mobile": lead.mobile,
        "company": lead.company,
        "job_title": lead.job_title,
        "address_line_1": lead.address_line_1,
        "address_line_2": lead.address_line_2,
        "city": lead.city,
        "state": lead.state,
        "postal_code": lead.postal_code,
        "country_id": lead.country_id,
        "salutation_id": lead.salutation_id,
    }
    contact_data.update(body.get("contact") or {})
    # Remove keys that don't belong on Contact (e.g. tenant/audit cols added by service)
    for _k in ("id", "tenant_id", "created_by", "updated_by"):
        contact_data.pop(_k, None)

    contact = await contact_service.create(db, contact_data, tenant_id=tenant_id, user_id=current_user.id)
    await db.flush()

    customer = None
    customer_extra = body.get("customer")
    if customer_extra is not None:
        customer_code = await commit_number(db, tenant_id, "customer")
        customer_data = {
            "name": lead.company or f"{lead.first_name} {lead.last_name}".strip(),
            "company_name": lead.company,
            "display_name": lead.company or f"{lead.first_name} {lead.last_name}".strip(),
            "code": customer_code,
            "type": "company" if lead.company else "individual",
            "email": lead.email,
            "phone": lead.phone,
            "primary_contact_id": contact.id,
            "lead_id": lead.id,
        }
        customer_data.update(customer_extra)
        for _k in ("id", "tenant_id", "created_by", "updated_by"):
            customer_data.pop(_k, None)

        customer = await customer_service.create(db, customer_data, tenant_id=tenant_id, user_id=current_user.id)
        await db.flush()

        # Link contact to the new customer
        link = CustomerContact(
            customer_id=customer.id,
            contact_id=contact.id,
            is_primary=True,
        )
        db.add(link)
        await db.flush()

    # --- Optionally create an Opportunity ---
    opportunity = None
    opp_data = body.get("create_opportunity")
    if opp_data:
        opp_fields = {
            "title": opp_data.get("title", lead.title),
            "contact_id": contact.id,
            "customer_id": customer.id if customer else None,
            "lead_id": lead.id,
        }
        opp_fields.update({k: v for k, v in opp_data.items() if k not in ("title",)})
        for _k in ("id", "tenant_id", "created_by", "updated_by"):
            opp_fields.pop(_k, None)
        opportunity = await opportunity_service.create(
            db, opp_fields, tenant_id=tenant_id, user_id=current_user.id
        )
        await db.flush()

    # --- Mark lead as converted ---
    lead.status = "converted"
    lead.converted_to_contact_id = contact.id
    lead.converted_to_customer_id = customer.id if customer else None
    lead.converted_at = now
    lead.updated_by = current_user.id
    await db.flush()

    await db.commit()
    await db.refresh(lead)
    await db.refresh(contact)

    result: dict = {
        "lead": _row(lead),
        "contact": _row(contact),
        "customer": _row(customer) if customer else None,
        "opportunity": _row(opportunity) if opportunity else None,
    }
    return result


# ===========================================================================
# CONTACTS
# ===========================================================================

@router.get("/contacts")
async def list_contacts(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "view")),
):
    skip, limit = _paginate(page, per_page)
    items, total = await contact_service.get_list(
        db,
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        search=search,
        search_fields=["first_name", "last_name", "email", "company"],
    )
    return _list_response(items, total, page, per_page)


@router.post("/contacts", status_code=status.HTTP_201_CREATED)
async def create_contact(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    data = await request.json()
    contact = await contact_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.commit()
    await db.refresh(contact)
    return _row(contact)


@router.get("/contacts/{contact_id}")
async def get_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "view")),
):
    contact = await contact_service.get_by_id(db, contact_id, tenant_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return _row(contact)


@router.put("/contacts/{contact_id}")
async def update_contact(
    contact_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    data = await request.json()
    contact = await contact_service.update(
        db, contact_id, data, tenant_id=tenant_id, user_id=current_user.id
    )
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    await db.commit()
    await db.refresh(contact)
    return _row(contact)


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    deleted = await contact_service.delete(db, contact_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    await db.commit()


# ===========================================================================
# CUSTOMERS
# ===========================================================================

@router.get("/customers")
async def list_customers(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {}
    if status:
        filters["status"] = status

    items, total = await customer_service.get_list(
        db,
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        search=search,
        search_fields=["name", "company_name", "display_name", "email", "code"],
        filters=filters,
    )
    return _list_response(items, total, page, per_page)


@router.post("/customers", status_code=status.HTTP_201_CREATED)
async def create_customer(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    data = await request.json()
    # Auto-generate customer code unless caller supplies one explicitly
    if not data.get("code"):
        data["code"] = await commit_number(db, tenant_id, "customer")
    customer = await customer_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.commit()
    await db.refresh(customer)
    return _row(customer)


@router.get("/customers/{customer_id}")
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "view")),
):
    customer = await customer_service.get_by_id(db, customer_id, tenant_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return _row(customer)


@router.put("/customers/{customer_id}")
async def update_customer(
    customer_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    data = await request.json()
    # Prevent overwriting the system-generated code inadvertently
    data.pop("code", None)
    customer = await customer_service.update(
        db, customer_id, data, tenant_id=tenant_id, user_id=current_user.id
    )
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    await db.commit()
    await db.refresh(customer)
    return _row(customer)


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    deleted = await customer_service.delete(db, customer_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    await db.commit()


# ---------------------------------------------------------------------------
# POST /customers/{id}/contacts  – link a contact to a customer
# ---------------------------------------------------------------------------

@router.post("/customers/{customer_id}/contacts", status_code=status.HTTP_201_CREATED)
async def link_contact_to_customer(
    customer_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    """
    Link an existing contact to a customer.

    Request body:
    {
        "contact_id": 42,
        "role": "Billing",       // optional
        "is_primary": false      // optional
    }
    """
    customer = await customer_service.get_by_id(db, customer_id, tenant_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    body: dict = await request.json()
    contact_id: Optional[int] = body.get("contact_id")
    if not contact_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="contact_id is required",
        )

    contact = await contact_service.get_by_id(db, contact_id, tenant_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    # Check for existing link
    existing_result = await db.execute(
        select(CustomerContact).where(
            and_(
                CustomerContact.customer_id == customer_id,
                CustomerContact.contact_id == contact_id,
            )
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contact is already linked to this customer",
        )

    link = CustomerContact(
        customer_id=customer_id,
        contact_id=contact_id,
        role=body.get("role"),
        is_primary=bool(body.get("is_primary", False)),
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return _row(link)


# ---------------------------------------------------------------------------
# DELETE /customers/{id}/contacts/{contact_id}  – unlink contact
# ---------------------------------------------------------------------------

@router.delete(
    "/customers/{customer_id}/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_contact_from_customer(
    customer_id: int,
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    customer = await customer_service.get_by_id(db, customer_id, tenant_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    result = await db.execute(
        select(CustomerContact).where(
            and_(
                CustomerContact.customer_id == customer_id,
                CustomerContact.contact_id == contact_id,
            )
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link between customer and contact not found",
        )

    await db.delete(link)
    await db.commit()


# ===========================================================================
# OPPORTUNITIES
# ===========================================================================

@router.get("/opportunities")
async def list_opportunities(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    assigned_to: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {}
    if stage:
        filters["stage"] = stage
    if customer_id is not None:
        filters["customer_id"] = customer_id
    if assigned_to is not None:
        filters["assigned_to"] = assigned_to

    items, total = await opportunity_service.get_list(
        db,
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        search=search,
        search_fields=["title"],
        filters=filters,
    )
    return _list_response(items, total, page, per_page)


@router.post("/opportunities", status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    data = await request.json()
    opportunity = await opportunity_service.create(
        db, data, tenant_id=tenant_id, user_id=current_user.id
    )
    await db.commit()
    await db.refresh(opportunity)
    return _row(opportunity)


@router.get("/opportunities/{opportunity_id}")
async def get_opportunity(
    opportunity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "view")),
):
    opportunity = await opportunity_service.get_by_id(db, opportunity_id, tenant_id)
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    return _row(opportunity)


@router.put("/opportunities/{opportunity_id}")
async def update_opportunity(
    opportunity_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    data = await request.json()
    opportunity = await opportunity_service.update(
        db, opportunity_id, data, tenant_id=tenant_id, user_id=current_user.id
    )
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    await db.commit()
    await db.refresh(opportunity)
    return _row(opportunity)


@router.delete("/opportunities/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(
    opportunity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    deleted = await opportunity_service.delete(db, opportunity_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    await db.commit()


# ===========================================================================
# ACTIVITIES
# ===========================================================================

@router.get("/activities")
async def list_activities(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    assigned_to: Optional[int] = Query(None),
    activitable_type: Optional[str] = Query(None),
    activitable_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {}
    if status:
        filters["status"] = status
    if type:
        filters["type"] = type
    if assigned_to is not None:
        filters["assigned_to"] = assigned_to
    if activitable_type:
        filters["activitable_type"] = activitable_type
    if activitable_id is not None:
        filters["activitable_id"] = activitable_id

    items, total = await activity_service.get_list(
        db,
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        search=search,
        search_fields=["subject", "description"],
        filters=filters,
    )
    return _list_response(items, total, page, per_page)


@router.post("/activities", status_code=status.HTTP_201_CREATED)
async def create_activity(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    data = await request.json()
    activity = await activity_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.commit()
    await db.refresh(activity)
    return _row(activity)


@router.get("/activities/{activity_id}")
async def get_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "view")),
):
    activity = await activity_service.get_by_id(db, activity_id, tenant_id)
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return _row(activity)


@router.put("/activities/{activity_id}")
async def update_activity(
    activity_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    data = await request.json()
    activity = await activity_service.update(
        db, activity_id, data, tenant_id=tenant_id, user_id=current_user.id
    )
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    await db.commit()
    await db.refresh(activity)
    return _row(activity)


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("crm", "edit")),
):
    deleted = await activity_service.delete(db, activity_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    await db.commit()
