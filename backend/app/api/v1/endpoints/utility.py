"""
Utility endpoints (no prefix — mounted at root of v1):
  GET /numbering/peek/{entity}  — preview next number for an entity without consuming it
  GET /countries                — list all active countries
  GET /currencies               — list all active currencies
  GET /languages                — list all active languages
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id
from app.services.numbering import peek_number, DEFAULT_SERIES
from app.models.global_models import User, Country, Currency, Language

router = APIRouter(tags=["utility"])


def _row_to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ---------------------------------------------------------------------------
# Numbering peek
# ---------------------------------------------------------------------------

@router.get("/numbering/peek/{entity}")
async def peek_next_number(
    entity: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Return the next formatted number for an entity without incrementing the counter.
    Returns 404 if the entity type is not recognised.
    """
    # Allow any entity that exists in DEFAULT_SERIES or let peek_number use a fallback
    known_entities = set(DEFAULT_SERIES.keys())
    if entity not in known_entities:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown entity type '{entity}'. Available: {sorted(known_entities)}",
        )
    number = await peek_number(db, tenant_id, entity)
    return {"entity": entity, "next_number": number}


# ---------------------------------------------------------------------------
# Countries
# ---------------------------------------------------------------------------

@router.get("/countries")
async def list_countries(
    search: Optional[str] = None,
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = select(Country)
    if active_only:
        query = query.where(Country.is_active.is_(True))
    if search:
        query = query.where(
            Country.name.ilike(f"%{search}%") | Country.code.ilike(f"%{search}%")
        )
    query = query.order_by(Country.name)
    result = await db.execute(query)
    countries = result.scalars().all()
    return {"data": [_row_to_dict(c) for c in countries], "total": len(countries)}


# ---------------------------------------------------------------------------
# Currencies
# ---------------------------------------------------------------------------

@router.get("/currencies")
async def list_currencies(
    search: Optional[str] = None,
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = select(Currency)
    if active_only:
        query = query.where(Currency.is_active.is_(True))
    if search:
        query = query.where(
            Currency.name.ilike(f"%{search}%")
            | Currency.code.ilike(f"%{search}%")
            | Currency.symbol.ilike(f"%{search}%")
        )
    query = query.order_by(Currency.code)
    result = await db.execute(query)
    currencies = result.scalars().all()
    return {"data": [_row_to_dict(c) for c in currencies], "total": len(currencies)}


# ---------------------------------------------------------------------------
# Languages
# ---------------------------------------------------------------------------

@router.get("/languages")
async def list_languages(
    search: Optional[str] = None,
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = select(Language)
    if active_only:
        query = query.where(Language.is_active.is_(True))
    if search:
        query = query.where(
            Language.name.ilike(f"%{search}%") | Language.code.ilike(f"%{search}%")
        )
    query = query.order_by(Language.name)
    result = await db.execute(query)
    languages = result.scalars().all()
    return {"data": [_row_to_dict(l) for l in languages], "total": len(languages)}
