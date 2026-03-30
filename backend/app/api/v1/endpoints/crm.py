"""
CRM Router — Enterprise-grade endpoints for leads, contacts, customers,
opportunities, activities, campaigns, tags, notes, timeline, audit,
bulk operations, import/export, duplicate detection, and web-to-lead.
"""
import csv
import io
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, or_, select, func, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_tenant_id, get_current_user, require_permission
from app.core.database import get_db
from app.models.crm import (
    Activity, Contact, Customer, CustomerContact, Lead, Opportunity,
    OpportunityCompetitor, OpportunityProduct,
    Tag, EntityTag, Note, AuditLog, EmailTemplate, LeadScoringRule, WebForm,
)
from app.models.tenant_models import Campaign
from app.models.global_models import User
from app.services.crud import CRUDService
from app.services.numbering import commit_number
from app.services.audit import log_audit, get_audit_log, _row_to_dict as audit_row_to_dict
from app.services.lead_scoring import score_and_update_lead

router = APIRouter(prefix="/crm", tags=["crm"])

# ---------------------------------------------------------------------------
# Service instances
# ---------------------------------------------------------------------------

lead_service = CRUDService(Lead)
contact_service = CRUDService(Contact)
customer_service = CRUDService(Customer)
opportunity_service = CRUDService(Opportunity)
activity_service = CRUDService(Activity)
campaign_service = CRUDService(Campaign)
tag_service = CRUDService(Tag)
note_service = CRUDService(Note)
email_template_service = CRUDService(EmailTemplate)
scoring_rule_service = CRUDService(LeadScoringRule)
web_form_service = CRUDService(WebForm)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _paginate(page: int, per_page: int) -> tuple[int, int]:
    page = max(1, page)
    per_page = max(1, min(per_page, 200))
    return (page - 1) * per_page, per_page


def _list_response(items, total: int, page: int, per_page: int) -> dict:
    return {
        "items": [_row(item) for item in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


def _row(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _trigger_crm_email(event_type: str, context: dict, tenant_id: int):
    """Dispatch a CRM email notification via Celery (fire-and-forget)."""
    try:
        from app.worker import app as celery_app
        celery_app.send_task(
            "app.tasks.send_crm_email",
            args=[event_type, context, tenant_id],
        )
    except Exception:
        pass  # Email failures should not block CRM operations


# ===========================================================================
# LEADS
# ===========================================================================

@router.get("/leads")
async def list_leads(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    assigned_to: Optional[int] = Query(None),
    source_id: Optional[int] = Query(None),
    status_id: Optional[int] = Query(None),
    industry_id: Optional[int] = Query(None),
    rating_id: Optional[int] = Query(None),
    campaign_id: Optional[int] = Query(None),
    territory_id: Optional[int] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_direction: Optional[str] = Query("desc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {}
    if status:
        filters["status"] = status
    if source:
        filters["source"] = source
    if assigned_to is not None:
        filters["assigned_to"] = assigned_to
    if source_id is not None:
        filters["source_id"] = source_id
    if status_id is not None:
        filters["status_id"] = status_id
    if industry_id is not None:
        filters["industry_id"] = industry_id
    if rating_id is not None:
        filters["rating_id"] = rating_id
    if campaign_id is not None:
        filters["campaign_id"] = campaign_id
    if territory_id is not None:
        filters["territory_id"] = territory_id

    items, total = await lead_service.get_list(
        db, tenant_id=tenant_id, skip=skip, limit=limit,
        search=search,
        search_fields=["first_name", "last_name", "email", "company", "title"],
        filters=filters, order_by=sort_by, sort_direction=sort_direction or "desc",
    )
    return _list_response(items, total, page, per_page)


@router.post("/leads", status_code=status.HTTP_201_CREATED)
async def create_lead(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "edit")),
):
    data = await request.json()
    data["code"] = await commit_number(db, tenant_id, "lead")
    lead = await lead_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    # Auto-score the new lead
    await score_and_update_lead(db, lead, tenant_id)
    # Refresh before reading attributes for audit
    await db.refresh(lead)
    # Audit
    await log_audit(db, tenant_id, current_user.id, "lead", lead.id, "create",
                    new_data=_row(lead), ip_address=_get_client_ip(request))
    await db.commit()
    await db.refresh(lead)
    # Email notification if assigned
    if lead.assigned_to:
        _trigger_crm_email("lead_assignment", {
            "lead_id": lead.id, "lead_title": lead.title,
            "lead_name": f"{lead.first_name} {lead.last_name}",
            "lead_company": lead.company or "", "lead_email": lead.email or "",
            "assigned_to_id": lead.assigned_to,
        }, tenant_id)
    return _row(lead)


@router.get("/leads/check-duplicates")
async def check_lead_duplicates(
    email: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    first_name: Optional[str] = Query(None),
    last_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "view")),
):
    conditions = [Lead.tenant_id == tenant_id]
    or_conds = []
    if email:
        or_conds.append(Lead.email == email)
    if phone:
        or_conds.append(or_(Lead.phone == phone, Lead.mobile == phone))
    if company:
        or_conds.append(Lead.company.ilike(f"%{company}%"))
    if first_name and last_name:
        or_conds.append(and_(Lead.first_name.ilike(f"%{first_name}%"), Lead.last_name.ilike(f"%{last_name}%")))

    if not or_conds:
        return {"duplicates": []}

    conditions.append(or_(*or_conds))
    result = await db.execute(select(Lead).where(*conditions).limit(10))
    leads = result.scalars().all()
    return {"duplicates": [_row(l) for l in leads]}


@router.get("/leads/export")
async def export_leads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "view")),
):
    items, _ = await lead_service.get_list(db, tenant_id=tenant_id, skip=0, limit=10000)
    if not items:
        return StreamingResponse(io.StringIO(""), media_type="text/csv")

    output = io.StringIO()
    fields = [c.name for c in Lead.__table__.columns if c.name not in ("tenant_id", "created_by", "updated_by")]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for item in items:
        row = _row(item)
        writer.writerow({k: row.get(k, "") for k in fields})

    output.seek(0)
    return StreamingResponse(
        output, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_export.csv"},
    )


@router.get("/leads/{lead_id}")
async def get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "view")),
):
    lead = await lead_service.get_by_id(db, lead_id, tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return _row(lead)


@router.put("/leads/{lead_id}")
async def update_lead(
    lead_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "edit")),
):
    lead = await lead_service.get_by_id(db, lead_id, tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    old_data = _row(lead)
    old_assigned = lead.assigned_to

    data = await request.json()
    lead = await lead_service.update(db, lead_id, data, tenant_id=tenant_id, user_id=current_user.id)
    # Re-score
    await score_and_update_lead(db, lead, tenant_id)
    # Refresh before reading attributes for audit
    await db.refresh(lead)
    # Audit
    await log_audit(db, tenant_id, current_user.id, "lead", lead_id, "update",
                    old_data=old_data, new_data=_row(lead), ip_address=_get_client_ip(request))
    await db.commit()
    await db.refresh(lead)
    # Email on assignment change
    if lead.assigned_to and lead.assigned_to != old_assigned:
        _trigger_crm_email("lead_assignment", {
            "lead_id": lead.id, "lead_title": lead.title,
            "lead_name": f"{lead.first_name} {lead.last_name}",
            "lead_company": lead.company or "", "lead_email": lead.email or "",
            "assigned_to_id": lead.assigned_to,
        }, tenant_id)
    return _row(lead)


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "edit")),
):
    deleted = await lead_service.delete(db, lead_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Lead not found")
    await log_audit(db, tenant_id, current_user.id, "lead", lead_id, "delete",
                    ip_address=_get_client_ip(request))
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
    _: bool = Depends(require_permission("leads", "edit")),
):
    lead = await lead_service.get_by_id(db, lead_id, tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status == "converted":
        raise HTTPException(status_code=409, detail="Lead is already converted")

    body: dict = await request.json()
    now = datetime.utcnow()

    # --- Create Contact ---
    contact_data = {
        "first_name": lead.first_name, "last_name": lead.last_name,
        "email": lead.email, "phone": lead.phone, "mobile": lead.mobile,
        "company": lead.company, "job_title": lead.job_title,
        "address_line_1": lead.address_line_1, "address_line_2": lead.address_line_2,
        "city": lead.city, "state": lead.state, "postal_code": lead.postal_code,
        "country_id": lead.country_id, "salutation_id": lead.salutation_id,
        "lead_id": lead.id,
    }
    contact_data.update(body.get("contact") or {})
    for k in ("id", "tenant_id", "created_by", "updated_by"):
        contact_data.pop(k, None)
    contact = await contact_service.create(db, contact_data, tenant_id=tenant_id, user_id=current_user.id)
    await db.flush()

    # --- Optionally create Customer ---
    customer = None
    if body.get("customer") is not None:
        customer_code = await commit_number(db, tenant_id, "customer")
        customer_data = {
            "name": lead.company or f"{lead.first_name} {lead.last_name}".strip(),
            "company_name": lead.company,
            "display_name": lead.company or f"{lead.first_name} {lead.last_name}".strip(),
            "code": customer_code,
            "type": "company" if lead.company else "individual",
            "email": lead.email, "phone": lead.phone,
            "primary_contact_id": contact.id, "lead_id": lead.id,
            "industry_id": lead.industry_id, "rating_id": lead.rating_id,
            "territory_id": lead.territory_id,
        }
        customer_data.update(body.get("customer") or {})
        for k in ("id", "tenant_id", "created_by", "updated_by"):
            customer_data.pop(k, None)
        customer = await customer_service.create(db, customer_data, tenant_id=tenant_id, user_id=current_user.id)
        await db.flush()
        link = CustomerContact(customer_id=customer.id, contact_id=contact.id, is_primary=True)
        db.add(link)
        await db.flush()

    # --- Optionally create Opportunity ---
    opportunity = None
    opp_data = body.get("create_opportunity")
    if opp_data:
        opp_code = await commit_number(db, tenant_id, "opportunity")
        opp_fields = {
            "code": opp_code,
            "title": opp_data.get("title", lead.title),
            "contact_id": contact.id,
            "customer_id": customer.id if customer else None,
            "lead_id": lead.id,
            "campaign_id": lead.campaign_id,
            "territory_id": lead.territory_id,
        }
        opp_fields.update({k: v for k, v in opp_data.items() if k != "title"})
        for k in ("id", "tenant_id", "created_by", "updated_by"):
            opp_fields.pop(k, None)
        opportunity = await opportunity_service.create(db, opp_fields, tenant_id=tenant_id, user_id=current_user.id)
        await db.flush()

    # --- Mark lead as converted ---
    lead.status = "converted"
    lead.converted_to_contact_id = contact.id
    lead.converted_to_customer_id = customer.id if customer else None
    lead.converted_to_opportunity_id = opportunity.id if opportunity else None
    lead.converted_at = now
    lead.updated_by = current_user.id
    await db.flush()

    await log_audit(db, tenant_id, current_user.id, "lead", lead_id, "update",
                    new_data={"action": "converted", "contact_id": contact.id,
                              "customer_id": customer.id if customer else None,
                              "opportunity_id": opportunity.id if opportunity else None},
                    ip_address=_get_client_ip(request))
    await db.commit()
    await db.refresh(lead)
    await db.refresh(contact)

    return {
        "lead": _row(lead),
        "contact": _row(contact),
        "customer": _row(customer) if customer else None,
        "opportunity": _row(opportunity) if opportunity else None,
    }


# ---------------------------------------------------------------------------
# Lead bulk operations
# ---------------------------------------------------------------------------

@router.post("/leads/bulk-update")
async def bulk_update_leads(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "edit")),
):
    body = await request.json()
    ids = body.get("ids", [])
    updates = body.get("updates", {})
    if not ids or not updates:
        raise HTTPException(status_code=422, detail="ids and updates are required")

    updates["updated_by"] = current_user.id
    stmt = sa_update(Lead).where(Lead.id.in_(ids), Lead.tenant_id == tenant_id).values(**updates)
    result = await db.execute(stmt)
    await db.commit()
    return {"updated": result.rowcount}


@router.post("/leads/bulk-delete")
async def bulk_delete_leads(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "edit")),
):
    body = await request.json()
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(status_code=422, detail="ids is required")
    from sqlalchemy import delete as sa_delete
    result = await db.execute(sa_delete(Lead).where(Lead.id.in_(ids), Lead.tenant_id == tenant_id))
    await db.commit()
    return {"deleted": result.rowcount}


@router.post("/leads/import", status_code=status.HTTP_201_CREATED)
async def import_leads(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("leads", "edit")),
):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    errors = []
    for i, row in enumerate(reader, start=2):
        try:
            clean = {k: (v if v else None) for k, v in row.items() if k and k not in ("id", "tenant_id", "created_by", "updated_by")}
            if not clean.get("first_name") or not clean.get("last_name") or not clean.get("title"):
                errors.append({"row": i, "error": "first_name, last_name, and title are required"})
                continue
            await lead_service.create(db, clean, tenant_id=tenant_id, user_id=current_user.id)
            created += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})
    await db.commit()
    return {"created": created, "errors": errors}


# ===========================================================================
# CONTACTS
# ===========================================================================

@router.get("/contacts")
async def list_contacts(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("contacts", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {}
    if status:
        filters["status"] = status
    if department:
        filters["department"] = department
    items, total = await contact_service.get_list(
        db, tenant_id=tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["first_name", "last_name", "email", "company"],
        filters=filters,
    )
    return _list_response(items, total, page, per_page)


@router.post("/contacts", status_code=status.HTTP_201_CREATED)
async def create_contact(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("contacts", "edit")),
):
    data = await request.json()
    data["code"] = await commit_number(db, tenant_id, "contact")
    contact = await contact_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.flush()
    await log_audit(db, tenant_id, current_user.id, "contact", contact.id, "create",
                    new_data=_row(contact), ip_address=_get_client_ip(request))
    await db.commit()
    await db.refresh(contact)
    return _row(contact)


@router.get("/contacts/{contact_id}")
async def get_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("contacts", "view")),
):
    contact = await contact_service.get_by_id(db, contact_id, tenant_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return _row(contact)


@router.put("/contacts/{contact_id}")
async def update_contact(
    contact_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("contacts", "edit")),
):
    contact = await contact_service.get_by_id(db, contact_id, tenant_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    old_data = _row(contact)
    data = await request.json()
    contact = await contact_service.update(db, contact_id, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.flush()
    await log_audit(db, tenant_id, current_user.id, "contact", contact_id, "update",
                    old_data=old_data, new_data=_row(contact), ip_address=_get_client_ip(request))
    await db.commit()
    await db.refresh(contact)
    return _row(contact)


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("contacts", "edit")),
):
    deleted = await contact_service.delete(db, contact_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Contact not found")
    await log_audit(db, tenant_id, current_user.id, "contact", contact_id, "delete",
                    ip_address=_get_client_ip(request))
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
    type: Optional[str] = Query(None),
    industry_id: Optional[int] = Query(None),
    rating_id: Optional[int] = Query(None),
    territory_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("customers", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {}
    if status:
        filters["status"] = status
    if type:
        filters["type"] = type
    if industry_id is not None:
        filters["industry_id"] = industry_id
    if rating_id is not None:
        filters["rating_id"] = rating_id
    if territory_id is not None:
        filters["territory_id"] = territory_id
    items, total = await customer_service.get_list(
        db, tenant_id=tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name", "company_name", "display_name", "email", "code"],
        filters=filters,
    )
    return _list_response(items, total, page, per_page)


@router.post("/customers", status_code=status.HTTP_201_CREATED)
async def create_customer(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("customers", "edit")),
):
    data = await request.json()
    if not data.get("code"):
        data["code"] = await commit_number(db, tenant_id, "customer")
    customer = await customer_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.flush()
    await log_audit(db, tenant_id, current_user.id, "customer", customer.id, "create",
                    new_data=_row(customer), ip_address=_get_client_ip(request))
    await db.commit()
    await db.refresh(customer)
    return _row(customer)


@router.get("/customers/{customer_id}")
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("customers", "view")),
):
    customer = await customer_service.get_by_id(db, customer_id, tenant_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _row(customer)


@router.put("/customers/{customer_id}")
async def update_customer(
    customer_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("customers", "edit")),
):
    customer = await customer_service.get_by_id(db, customer_id, tenant_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    old_data = _row(customer)
    data = await request.json()
    data.pop("code", None)
    customer = await customer_service.update(db, customer_id, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.flush()
    await log_audit(db, tenant_id, current_user.id, "customer", customer_id, "update",
                    old_data=old_data, new_data=_row(customer), ip_address=_get_client_ip(request))
    await db.commit()
    await db.refresh(customer)
    return _row(customer)


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("customers", "edit")),
):
    deleted = await customer_service.delete(db, customer_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Customer not found")
    await log_audit(db, tenant_id, current_user.id, "customer", customer_id, "delete",
                    ip_address=_get_client_ip(request))
    await db.commit()


@router.post("/customers/{customer_id}/contacts", status_code=status.HTTP_201_CREATED)
async def link_contact_to_customer(
    customer_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("customers", "edit")),
):
    customer = await customer_service.get_by_id(db, customer_id, tenant_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    body: dict = await request.json()
    contact_id = body.get("contact_id")
    if not contact_id:
        raise HTTPException(status_code=422, detail="contact_id is required")
    contact = await contact_service.get_by_id(db, contact_id, tenant_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    existing = await db.execute(
        select(CustomerContact).where(
            CustomerContact.customer_id == customer_id, CustomerContact.contact_id == contact_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Contact is already linked to this customer")
    link = CustomerContact(
        customer_id=customer_id, contact_id=contact_id,
        role=body.get("role"), is_primary=bool(body.get("is_primary", False)),
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return _row(link)


@router.delete("/customers/{customer_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_contact_from_customer(
    customer_id: int, contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("customers", "edit")),
):
    customer = await customer_service.get_by_id(db, customer_id, tenant_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    result = await db.execute(
        select(CustomerContact).where(
            CustomerContact.customer_id == customer_id, CustomerContact.contact_id == contact_id
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
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
    stage_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    assigned_to: Optional[int] = Query(None),
    campaign_id: Optional[int] = Query(None),
    territory_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {}
    if stage:
        filters["stage"] = stage
    if stage_id is not None:
        filters["stage_id"] = stage_id
    if customer_id is not None:
        filters["customer_id"] = customer_id
    if assigned_to is not None:
        filters["assigned_to"] = assigned_to
    if campaign_id is not None:
        filters["campaign_id"] = campaign_id
    if territory_id is not None:
        filters["territory_id"] = territory_id
    items, total = await opportunity_service.get_list(
        db, tenant_id=tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["title"], filters=filters,
    )
    # Enrich with customer_name and assigned_to_name
    customer_ids = {i.customer_id for i in items if i.customer_id}
    assigned_ids = {i.assigned_to for i in items if i.assigned_to}
    cust_map: dict[int, str] = {}
    user_map: dict[int, str] = {}
    if customer_ids:
        res = await db.execute(select(Customer.id, Customer.name).where(Customer.id.in_(customer_ids)))
        cust_map = {r[0]: r[1] for r in res.all()}
    if assigned_ids:
        res = await db.execute(select(User.id, User.name).where(User.id.in_(assigned_ids)))
        user_map = {r[0]: r[1] for r in res.all()}
    enriched = []
    for item in items:
        row = _row(item)
        row["customer_name"] = cust_map.get(item.customer_id, "")
        row["assigned_to_name"] = user_map.get(item.assigned_to, "")
        enriched.append(row)
    return {
        "items": enriched,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


@router.post("/opportunities", status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "edit")),
):
    data = await request.json()
    if not data.get("code"):
        data["code"] = await commit_number(db, tenant_id, "opportunity")
    # Auto-calculate weighted amount
    if data.get("expected_amount") and data.get("probability"):
        data["weighted_amount"] = round(float(data["expected_amount"]) * float(data["probability"]) / 100, 2)
    opportunity = await opportunity_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.flush()
    await log_audit(db, tenant_id, current_user.id, "opportunity", opportunity.id, "create",
                    new_data=_row(opportunity), ip_address=_get_client_ip(request))
    await db.commit()
    await db.refresh(opportunity)
    return _row(opportunity)


@router.get("/opportunities/{opportunity_id}")
async def get_opportunity(
    opportunity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "view")),
):
    opp = await opportunity_service.get_by_id(db, opportunity_id, tenant_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    result = _row(opp)
    # Include competitors and products
    comps = await db.execute(select(OpportunityCompetitor).where(OpportunityCompetitor.opportunity_id == opportunity_id))
    result["competitors"] = [_row(c) for c in comps.scalars().all()]
    prods = await db.execute(select(OpportunityProduct).where(OpportunityProduct.opportunity_id == opportunity_id))
    result["products"] = [_row(p) for p in prods.scalars().all()]
    return result


@router.put("/opportunities/{opportunity_id}")
async def update_opportunity(
    opportunity_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "edit")),
):
    opp = await opportunity_service.get_by_id(db, opportunity_id, tenant_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    old_data = _row(opp)
    old_stage = opp.stage

    data = await request.json()
    # Auto-calculate weighted amount
    amt = data.get("expected_amount", opp.expected_amount)
    prob = data.get("probability", opp.probability)
    if amt and prob:
        data["weighted_amount"] = round(float(amt) * float(prob) / 100, 2)

    # Win/loss timestamps
    new_stage = data.get("stage", old_stage)
    if new_stage != old_stage:
        now = datetime.utcnow()
        if new_stage in ("closed_won", "won"):
            data["won_at"] = now
        elif new_stage in ("closed_lost", "lost"):
            data["lost_at"] = now

    opp = await opportunity_service.update(db, opportunity_id, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.flush()
    await log_audit(db, tenant_id, current_user.id, "opportunity", opportunity_id, "update",
                    old_data=old_data, new_data=_row(opp), ip_address=_get_client_ip(request))
    await db.commit()
    await db.refresh(opp)

    # Email on stage change
    if new_stage != old_stage:
        event = "deal_won" if new_stage in ("closed_won", "won") else "deal_lost" if new_stage in ("closed_lost", "lost") else "stage_change"
        _trigger_crm_email(event, {
            "opportunity_id": opp.id, "opportunity_title": opp.title,
            "old_stage": old_stage, "new_stage": new_stage,
            "expected_amount": str(opp.expected_amount or 0),
            "assigned_to_id": opp.assigned_to,
        }, tenant_id)
    return _row(opp)


@router.delete("/opportunities/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(
    opportunity_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "edit")),
):
    deleted = await opportunity_service.delete(db, opportunity_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    await log_audit(db, tenant_id, current_user.id, "opportunity", opportunity_id, "delete",
                    ip_address=_get_client_ip(request))
    await db.commit()


# ---------------------------------------------------------------------------
# Opportunity competitors & products
# ---------------------------------------------------------------------------

@router.post("/opportunities/{opportunity_id}/competitors", status_code=201)
async def add_opportunity_competitor(
    opportunity_id: int, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "edit")),
):
    opp = await opportunity_service.get_by_id(db, opportunity_id, tenant_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    data = await request.json()
    comp = OpportunityCompetitor(opportunity_id=opportunity_id, **{k: v for k, v in data.items() if hasattr(OpportunityCompetitor, k) and k != "id"})
    db.add(comp)
    await db.commit()
    await db.refresh(comp)
    return _row(comp)


@router.delete("/opportunities/{opportunity_id}/competitors/{comp_id}", status_code=204)
async def remove_opportunity_competitor(
    opportunity_id: int, comp_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "edit")),
):
    result = await db.execute(select(OpportunityCompetitor).where(
        OpportunityCompetitor.id == comp_id, OpportunityCompetitor.opportunity_id == opportunity_id
    ))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(obj)
    await db.commit()


@router.post("/opportunities/{opportunity_id}/products", status_code=201)
async def add_opportunity_product(
    opportunity_id: int, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "edit")),
):
    opp = await opportunity_service.get_by_id(db, opportunity_id, tenant_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    data = await request.json()
    prod = OpportunityProduct(opportunity_id=opportunity_id, **{k: v for k, v in data.items() if hasattr(OpportunityProduct, k) and k != "id"})
    db.add(prod)
    await db.commit()
    await db.refresh(prod)
    return _row(prod)


@router.delete("/opportunities/{opportunity_id}/products/{prod_id}", status_code=204)
async def remove_opportunity_product(
    opportunity_id: int, prod_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("opportunities", "edit")),
):
    result = await db.execute(select(OpportunityProduct).where(
        OpportunityProduct.id == prod_id, OpportunityProduct.opportunity_id == opportunity_id
    ))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(obj)
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
    _: bool = Depends(require_permission("activities", "view")),
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
        db, tenant_id=tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["subject", "description"], filters=filters,
    )
    return _list_response(items, total, page, per_page)


@router.post("/activities", status_code=status.HTTP_201_CREATED)
async def create_activity(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("activities", "edit")),
):
    data = await request.json()
    activity = await activity_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.flush()
    # Update last_activity_at on the parent entity
    if activity.activitable_type and activity.activitable_id:
        await _update_last_activity(db, activity.activitable_type, activity.activitable_id, tenant_id)
    await db.commit()
    await db.refresh(activity)
    return _row(activity)


@router.get("/activities/{activity_id}")
async def get_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("activities", "view")),
):
    activity = await activity_service.get_by_id(db, activity_id, tenant_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return _row(activity)


@router.put("/activities/{activity_id}")
async def update_activity(
    activity_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("activities", "edit")),
):
    data = await request.json()
    activity = await activity_service.update(db, activity_id, data, tenant_id=tenant_id, user_id=current_user.id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.commit()
    await db.refresh(activity)
    return _row(activity)


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("activities", "edit")),
):
    deleted = await activity_service.delete(db, activity_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.commit()


async def _update_last_activity(db: AsyncSession, entity_type: str, entity_id: int, tenant_id: int):
    """Denormalize last_activity_at on the parent entity."""
    now = datetime.utcnow()
    model_map = {"Lead": Lead, "Contact": Contact, "Customer": Customer, "Opportunity": Opportunity}
    model = model_map.get(entity_type)
    if model and hasattr(model, "last_activity_at"):
        await db.execute(
            sa_update(model).where(model.id == entity_id, model.tenant_id == tenant_id)
            .values(last_activity_at=now)
        )


# ===========================================================================
# CAMPAIGNS
# ===========================================================================

@router.get("/campaigns")
async def list_campaigns(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("campaigns", "view")),
):
    skip, limit = _paginate(page, per_page)
    filters = {}
    if status:
        filters["status"] = status
    if type:
        filters["type"] = type
    items, total = await campaign_service.get_list(
        db, tenant_id=tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["name", "code"], filters=filters,
    )
    return _list_response(items, total, page, per_page)


@router.post("/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("campaigns", "edit")),
):
    data = await request.json()
    if not data.get("code"):
        data["code"] = await commit_number(db, tenant_id, "campaign")
    campaign = await campaign_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.commit()
    await db.refresh(campaign)
    return _row(campaign)


@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("campaigns", "view")),
):
    campaign = await campaign_service.get_by_id(db, campaign_id, tenant_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    result = _row(campaign)
    # Get stats
    leads_count = (await db.execute(
        select(func.count()).select_from(Lead).where(Lead.campaign_id == campaign_id, Lead.tenant_id == tenant_id)
    )).scalar() or 0
    opps_count = (await db.execute(
        select(func.count()).select_from(Opportunity).where(Opportunity.campaign_id == campaign_id, Opportunity.tenant_id == tenant_id)
    )).scalar() or 0
    opp_value = (await db.execute(
        select(func.sum(Opportunity.expected_amount)).where(Opportunity.campaign_id == campaign_id, Opportunity.tenant_id == tenant_id)
    )).scalar() or 0
    result["stats"] = {"leads_count": leads_count, "opportunities_count": opps_count, "pipeline_value": opp_value}
    return result


@router.put("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: int, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("campaigns", "edit")),
):
    data = await request.json()
    data.pop("code", None)
    campaign = await campaign_service.update(db, campaign_id, data, tenant_id=tenant_id, user_id=current_user.id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.commit()
    await db.refresh(campaign)
    return _row(campaign)


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("campaigns", "edit")),
):
    deleted = await campaign_service.delete(db, campaign_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.commit()


@router.get("/campaigns/{campaign_id}/leads")
async def get_campaign_leads(
    campaign_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("campaigns", "view")),
):
    skip, limit = _paginate(page, per_page)
    items, total = await lead_service.get_list(
        db, tenant_id=tenant_id, skip=skip, limit=limit, filters={"campaign_id": campaign_id},
    )
    return _list_response(items, total, page, per_page)


@router.get("/campaigns/{campaign_id}/opportunities")
async def get_campaign_opportunities(
    campaign_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("campaigns", "view")),
):
    skip, limit = _paginate(page, per_page)
    items, total = await opportunity_service.get_list(
        db, tenant_id=tenant_id, skip=skip, limit=limit, filters={"campaign_id": campaign_id},
    )
    return _list_response(items, total, page, per_page)


# ===========================================================================
# TAGS (polymorphic)
# ===========================================================================

@router.get("/tags")
async def list_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tags", "view")),
):
    items, total = await tag_service.get_list(db, tenant_id=tenant_id, skip=0, limit=500)
    return {"items": [_row(t) for t in items], "total": total}


@router.post("/tags", status_code=201)
async def create_tag(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    _: bool = Depends(require_permission("tags", "edit")),
):
    data = await request.json()
    if not data.get("slug") and data.get("name"):
        data["slug"] = data["name"].lower().replace(" ", "-")
    tag = await tag_service.create(db, data, tenant_id=tenant_id, user_id=current_user.id)
    await db.commit()
    await db.refresh(tag)
    return _row(tag)


@router.get("/{entity_type}/{entity_id}/tags")
async def get_entity_tags(
    entity_type: str, entity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(Tag).join(EntityTag, EntityTag.tag_id == Tag.id).where(
            EntityTag.entity_type == entity_type, EntityTag.entity_id == entity_id,
            Tag.tenant_id == tenant_id,
        )
    )
    return {"items": [_row(t) for t in result.scalars().all()]}


@router.post("/{entity_type}/{entity_id}/tags", status_code=201)
async def attach_tag(
    entity_type: str, entity_id: int, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    body = await request.json()
    tag_id = body.get("tag_id")
    if not tag_id:
        raise HTTPException(status_code=422, detail="tag_id is required")
    existing = await db.execute(select(EntityTag).where(
        EntityTag.tag_id == tag_id, EntityTag.entity_type == entity_type, EntityTag.entity_id == entity_id
    ))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tag already attached")
    link = EntityTag(tag_id=tag_id, entity_type=entity_type, entity_id=entity_id)
    db.add(link)
    await db.commit()
    return {"message": "Tag attached"}


@router.delete("/{entity_type}/{entity_id}/tags/{tag_id}", status_code=204)
async def detach_tag(
    entity_type: str, entity_id: int, tag_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(select(EntityTag).where(
        EntityTag.tag_id == tag_id, EntityTag.entity_type == entity_type, EntityTag.entity_id == entity_id
    ))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Tag link not found")
    await db.delete(link)
    await db.commit()


# ===========================================================================
# NOTES (polymorphic timeline)
# ===========================================================================

@router.get("/{entity_type}/{entity_id}/notes")
async def list_notes(
    entity_type: str, entity_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    base = select(Note).where(
        Note.entity_type == entity_type, Note.entity_id == entity_id, Note.tenant_id == tenant_id
    )
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    result = await db.execute(base.order_by(Note.created_at.desc()).offset(skip).limit(limit))
    items = result.scalars().all()
    return _list_response(items, total, page, per_page)


@router.post("/{entity_type}/{entity_id}/notes", status_code=201)
async def create_note(
    entity_type: str, entity_id: int, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data = await request.json()
    note = Note(
        tenant_id=tenant_id, created_by=current_user.id, updated_by=current_user.id,
        entity_type=entity_type, entity_id=entity_id,
        content=data.get("content", ""), is_pinned=bool(data.get("is_pinned", False)),
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return _row(note)


@router.put("/notes/{note_id}")
async def update_note(
    note_id: int, request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(select(Note).where(Note.id == note_id, Note.tenant_id == tenant_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    data = await request.json()
    if "content" in data:
        note.content = data["content"]
    if "is_pinned" in data:
        note.is_pinned = bool(data["is_pinned"])
    note.updated_by = current_user.id
    await db.commit()
    await db.refresh(note)
    return _row(note)


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = await db.execute(select(Note).where(Note.id == note_id, Note.tenant_id == tenant_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.commit()


# ===========================================================================
# AUDIT LOG & TIMELINE
# ===========================================================================

@router.get("/{entity_type}/{entity_id}/audit")
async def get_entity_audit(
    entity_type: str, entity_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    # Normalize: URL uses plural (leads), audit stores singular (lead)
    audit_type = entity_type.rstrip("s") if entity_type.endswith("s") else entity_type
    items, total = await get_audit_log(db, tenant_id, audit_type, entity_id, skip, limit)
    return {
        "items": [_row(i) for i in items],
        "total": total, "page": page, "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


@router.get("/{entity_type}/{entity_id}/timeline")
async def get_entity_timeline(
    entity_type: str, entity_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Combined timeline: audit + activities + notes for an entity."""
    skip, limit = _paginate(page, per_page)
    timeline = []

    # Audit entries (normalize plural URL to singular stored type)
    audit_type = entity_type.rstrip("s") if entity_type.endswith("s") else entity_type
    audits, _ = await get_audit_log(db, tenant_id, audit_type, entity_id, 0, 100)
    for a in audits:
        timeline.append({
            "type": "audit", "action": a.action, "changes": a.changes,
            "user_id": a.user_id, "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    # Activities
    result = await db.execute(
        select(Activity).where(
            Activity.activitable_type == entity_type.capitalize(),
            Activity.activitable_id == entity_id, Activity.tenant_id == tenant_id,
        ).order_by(Activity.created_at.desc()).limit(100)
    )
    for act in result.scalars().all():
        timeline.append({
            "type": "activity", "activity_type": act.type, "subject": act.subject,
            "description": act.description, "status": act.status, "outcome": act.outcome,
            "user_id": act.assigned_to, "created_at": act.created_at.isoformat() if act.created_at else None,
        })

    # Notes
    result = await db.execute(
        select(Note).where(
            Note.entity_type == entity_type, Note.entity_id == entity_id, Note.tenant_id == tenant_id,
        ).order_by(Note.created_at.desc()).limit(100)
    )
    for note in result.scalars().all():
        timeline.append({
            "type": "note", "content": note.content, "is_pinned": note.is_pinned,
            "user_id": note.created_by, "created_at": note.created_at.isoformat() if note.created_at else None,
        })

    # Sort by created_at descending
    timeline.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    total = len(timeline)
    return {
        "items": timeline[skip:skip + limit],
        "total": total, "page": page, "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


# ===========================================================================
# WEB-TO-LEAD (public endpoint — no auth)
# ===========================================================================

@router.post("/public/web-to-lead", status_code=201)
async def web_to_lead(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint for web form submissions. Requires api_key in body."""
    data = await request.json()
    api_key = data.pop("api_key", None)
    if not api_key:
        raise HTTPException(status_code=401, detail="api_key is required")

    result = await db.execute(select(WebForm).where(WebForm.api_key == api_key, WebForm.is_active == True))
    web_form = result.scalar_one_or_none()
    if not web_form:
        raise HTTPException(status_code=401, detail="Invalid or inactive api_key")

    # Create lead
    lead_data = {k: v for k, v in data.items() if hasattr(Lead, k) and k not in ("id", "tenant_id", "created_by", "updated_by")}
    lead_data["source"] = "web_form"
    if web_form.default_source_id:
        lead_data["source_id"] = web_form.default_source_id
    if web_form.default_assigned_to:
        lead_data["assigned_to"] = web_form.default_assigned_to

    lead = await lead_service.create(db, lead_data, tenant_id=web_form.tenant_id, user_id=web_form.default_assigned_to)
    await db.flush()
    await score_and_update_lead(db, lead, web_form.tenant_id)
    await db.commit()
    await db.refresh(lead)

    if lead.assigned_to:
        _trigger_crm_email("lead_assignment", {
            "lead_id": lead.id, "lead_title": lead.title,
            "lead_name": f"{lead.first_name} {lead.last_name}",
            "lead_company": lead.company or "", "lead_email": lead.email or "",
            "assigned_to_id": lead.assigned_to,
        }, web_form.tenant_id)

    return {
        "message": web_form.thank_you_message or "Thank you for your submission!",
        "redirect_url": web_form.redirect_url,
    }
