from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.tenant_models import OrganizationSettings

DEFAULT_SERIES = {
    # CRM
    "lead": {"prefix": "LD", "padding": 5, "next_number": 1},
    "contact": {"prefix": "CON", "padding": 5, "next_number": 1},
    "customer": {"prefix": "CUST", "padding": 5, "next_number": 1},
    "opportunity": {"prefix": "OPP", "padding": 5, "next_number": 1},
    "campaign": {"prefix": "CAMP", "padding": 4, "next_number": 1},
    # Sales
    "quotation": {"prefix": "QUO", "padding": 5, "next_number": 1},
    "sales_order": {"prefix": "SO", "padding": 5, "next_number": 1},
    "delivery": {"prefix": "DEL", "padding": 5, "next_number": 1},
    "invoice": {"prefix": "INV", "padding": 5, "next_number": 1},
    "proforma_invoice": {"prefix": "PI", "padding": 5, "next_number": 1},
    # Purchase
    "vendor": {"prefix": "VND", "padding": 5, "next_number": 1},
    "purchase_request": {"prefix": "PR", "padding": 5, "next_number": 1},
    "purchase_order": {"prefix": "PO", "padding": 5, "next_number": 1},
    "goods_receipt": {"prefix": "GR", "padding": 5, "next_number": 1},
    # Inventory
    "product": {"prefix": "SKU", "padding": 6, "next_number": 1},
    "warehouse": {"prefix": "WH", "padding": 3, "next_number": 1},
    "stock_adjustment": {"prefix": "ADJ", "padding": 5, "next_number": 1},
    "stock_transfer": {"prefix": "TRF", "padding": 5, "next_number": 1},
    # Projects
    "project": {"prefix": "PRJ", "padding": 4, "next_number": 1},
    "project_risk": {"prefix": "RSK", "padding": 4, "next_number": 1},
    "project_issue": {"prefix": "ISS", "padding": 4, "next_number": 1},
    "change_request": {"prefix": "CR", "padding": 4, "next_number": 1},
    "status_report": {"prefix": "SR", "padding": 4, "next_number": 1},
    # HR & Admin
    "employee": {"prefix": "EMP", "padding": 5, "next_number": 1},
    "department": {"prefix": "DEPT", "padding": 4, "next_number": 1},
    "leave_request": {"prefix": "LR", "padding": 5, "next_number": 1},
    "payroll_run": {"prefix": "PAY", "padding": 5, "next_number": 1},
    "performance_review": {"prefix": "REV", "padding": 5, "next_number": 1},
    "expense_claim": {"prefix": "EXP", "padding": 5, "next_number": 1},
    # Support
    "ticket": {"prefix": "TKT", "padding": 5, "next_number": 1},
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
    """Generate the next document number with row-level locking to prevent duplicates."""
    # SELECT ... FOR UPDATE locks the row until the transaction commits,
    # so concurrent requests queue up instead of reading stale data.
    result = await db.execute(
        select(OrganizationSettings)
        .where(OrganizationSettings.tenant_id == tenant_id)
        .with_for_update()
    )
    settings = result.scalar_one_or_none()
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
