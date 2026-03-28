from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.tenant_models import OrganizationSettings

DEFAULT_SERIES = {
    "customer": {"prefix": "CUST", "padding": 5, "next_number": 1},
    "vendor": {"prefix": "VND", "padding": 5, "next_number": 1},
    "employee": {"prefix": "EMP", "padding": 5, "next_number": 1},
    "product": {"prefix": "SKU", "padding": 6, "next_number": 1},
    "quotation": {"prefix": "QUO", "padding": 5, "next_number": 1},
    "sales_order": {"prefix": "SO", "padding": 5, "next_number": 1},
    "delivery": {"prefix": "DEL", "padding": 5, "next_number": 1},
    "invoice": {"prefix": "INV", "padding": 5, "next_number": 1},
    "proforma_invoice": {"prefix": "PI", "padding": 5, "next_number": 1},
    "purchase_order": {"prefix": "PO", "padding": 5, "next_number": 1},
    "goods_receipt": {"prefix": "GR", "padding": 5, "next_number": 1},
    "ticket": {"prefix": "TKT", "padding": 5, "next_number": 1},
    "expense_claim": {"prefix": "EXP", "padding": 5, "next_number": 1},
    "project": {"prefix": "PRJ", "padding": 4, "next_number": 1},
    "department": {"prefix": "DEPT", "padding": 4, "next_number": 1},
    "stock_adjustment": {"prefix": "ADJ", "padding": 5, "next_number": 1},
    "stock_transfer": {"prefix": "TRF", "padding": 5, "next_number": 1},
    "warehouse": {"prefix": "WH", "padding": 3, "next_number": 1},
    "purchase_request": {"prefix": "PR", "padding": 5, "next_number": 1},
}


async def get_org_settings(db: AsyncSession, tenant_id: int) -> OrganizationSettings:
    result = await db.execute(
        select(OrganizationSettings).where(OrganizationSettings.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


def format_number(prefix: str, number: int, padding: int) -> str:
    return f"{prefix}-{str(number).zfill(padding)}"


async def peek_number(db: AsyncSession, tenant_id: int, entity: str) -> str:
    settings = await get_org_settings(db, tenant_id)
    series = (settings.number_series if settings and settings.number_series else {}).get(
        entity, DEFAULT_SERIES.get(entity, {"prefix": entity.upper(), "padding": 5, "next_number": 1})
    )
    return format_number(series["prefix"], series["next_number"], series["padding"])


async def commit_number(db: AsyncSession, tenant_id: int, entity: str) -> str:
    settings = await get_org_settings(db, tenant_id)
    if not settings:
        return format_number(entity.upper(), 1, 5)

    number_series = dict(settings.number_series) if settings.number_series else {}
    series = number_series.get(
        entity, DEFAULT_SERIES.get(entity, {"prefix": entity.upper(), "padding": 5, "next_number": 1})
    )
    series = dict(series)  # Make mutable copy
    number = format_number(series["prefix"], series["next_number"], series["padding"])
    series["next_number"] = series["next_number"] + 1
    number_series[entity] = series
    settings.number_series = number_series
    await db.flush()
    return number
