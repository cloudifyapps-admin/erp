from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id
from app.services.crud import CRUDService
from app.services.numbering import commit_number, peek_number
from app.models.global_models import User
from app.models.tickets import Ticket, TicketComment

router = APIRouter(prefix="/tickets", tags=["tickets"])


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
# Tickets CRUD
# ---------------------------------------------------------------------------

ticket_service = CRUDService(Ticket)
comment_service = CRUDService(TicketComment)


@router.get("")
async def list_tickets(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    status_id: Optional[int] = None,
    priority_id: Optional[int] = None,
    assigned_to: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {}
    if status_id:
        filters["status_id"] = status_id
    if priority_id:
        filters["priority_id"] = priority_id
    if assigned_to:
        filters["assigned_to"] = assigned_to
    items, total = await ticket_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["number", "title", "description"],
        filters=filters or None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/{id}")
async def get_ticket(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await ticket_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Ticket not found")
    result = await db.execute(
        select(TicketComment)
        .where(and_(TicketComment.ticket_id == id, TicketComment.tenant_id == tenant_id))
        .order_by(TicketComment.id)
    )
    comments = result.scalars().all()
    data = _row_to_dict(obj)
    data["comments"] = [_row_to_dict(c) for c in comments]
    return data


@router.post("", status_code=201)
async def create_ticket(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    data["number"] = await commit_number(db, tenant_id, "ticket")
    data.setdefault("requester_id", user.id)
    obj = await ticket_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{id}")
async def update_ticket(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await ticket_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{id}", status_code=204)
async def delete_ticket(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    deleted = await ticket_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Ticket Comments
# ---------------------------------------------------------------------------

@router.post("/{id}/comments", status_code=201)
async def add_comment(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Add a comment to a ticket."""
    ticket = await ticket_service.get_by_id(db, id, tenant_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    body = data.get("body", "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment body cannot be empty")

    comment_data = {
        "ticket_id": id,
        "user_id": user.id,
        "body": body,
        "is_internal": data.get("is_internal", False),
    }
    comment = await comment_service.create(db, comment_data, tenant_id, user.id)
    await db.commit()
    await db.refresh(comment)
    return _row_to_dict(comment)


@router.get("/{id}/comments")
async def list_comments(
    id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    ticket = await ticket_service.get_by_id(db, id, tenant_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    skip, limit = _paginate(page, per_page)
    items, total = await comment_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        filters={"ticket_id": id},
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.delete("/{id}/comments/{cid}", status_code=204)
async def delete_comment(
    id: int,
    cid: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Delete a specific comment from a ticket."""
    ticket = await ticket_service.get_by_id(db, id, tenant_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    result = await db.execute(
        select(TicketComment).where(
            and_(
                TicketComment.id == cid,
                TicketComment.ticket_id == id,
                TicketComment.tenant_id == tenant_id,
            )
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Only allow deletion by the comment author or any user (adjust as needed)
    await db.delete(comment)
    await db.commit()
