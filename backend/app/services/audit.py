"""Audit trail service — logs field-level changes for CRM entities."""
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.crm import AuditLog


def compute_changes(old_data: dict | None, new_data: dict, exclude_fields: set | None = None) -> dict:
    """Compute field-level diff between old and new data.
    Returns {field: {"old": old_val, "new": new_val}} for changed fields only.
    """
    exclude = exclude_fields or {"updated_at", "updated_by", "created_at", "created_by"}
    changes = {}
    if old_data is None:
        # Creation — record all non-null new values
        for k, v in new_data.items():
            if k not in exclude and v is not None:
                changes[k] = {"old": None, "new": _serialize(v)}
        return changes

    all_keys = set(old_data.keys()) | set(new_data.keys())
    for k in all_keys:
        if k in exclude:
            continue
        old_val = old_data.get(k)
        new_val = new_data.get(k)
        if _serialize(old_val) != _serialize(new_val):
            changes[k] = {"old": _serialize(old_val), "new": _serialize(new_val)}
    return changes


def _serialize(val):
    """Ensure JSON-serializable value."""
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    return val


def _row_to_dict(obj) -> dict:
    """Convert SQLAlchemy row to dict using column names."""
    if obj is None:
        return {}
    return {c.name: getattr(obj, c.name, None) for c in obj.__table__.columns}


async def log_audit(
    db: AsyncSession,
    tenant_id: int,
    user_id: int | None,
    entity_type: str,
    entity_id: int,
    action: str,
    old_data: dict | None = None,
    new_data: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLog | None:
    """Create an audit log entry. Returns the AuditLog row."""
    if action == "delete":
        changes = {"deleted": True}
    elif action == "create":
        changes = compute_changes(None, new_data or {})
    else:
        changes = compute_changes(old_data or {}, new_data or {})

    if not changes and action == "update":
        return None  # Nothing actually changed

    entry = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        changes=changes,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(entry)
    await db.flush()
    return entry


async def get_audit_log(
    db: AsyncSession,
    tenant_id: int,
    entity_type: str,
    entity_id: int,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list, int]:
    """Get paginated audit log for an entity."""
    from sqlalchemy import select, func

    base = select(AuditLog).where(
        AuditLog.tenant_id == tenant_id,
        AuditLog.entity_type == entity_type,
        AuditLog.entity_id == entity_id,
    )
    count_q = select(func.count()).select_from(base.subquery())
    result = await db.execute(count_q)
    total = result.scalar() or 0

    items_q = base.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(items_q)
    items = result.scalars().all()
    return items, total
