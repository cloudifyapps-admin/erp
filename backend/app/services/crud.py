from datetime import date, datetime
from typing import Any, Optional, Type, TypeVar
from sqlalchemy import select, func, and_, or_, Date, DateTime
from sqlalchemy.ext.asyncio import AsyncSession

ModelType = TypeVar("ModelType")


def _coerce_dates(model, data: dict) -> dict:
    """Convert ISO date strings to Python date/datetime objects."""
    table = getattr(model, "__table__", None)
    if table is None:
        return data
    for key, value in list(data.items()):
        if not isinstance(value, str) or key not in table.columns:
            continue
        col_type = table.columns[key].type
        if isinstance(col_type, Date):
            try:
                data[key] = date.fromisoformat(value) if value else None
            except ValueError:
                pass
        elif isinstance(col_type, DateTime):
            try:
                data[key] = datetime.fromisoformat(value) if value else None
            except ValueError:
                pass
    return data


class CRUDService:
    """Generic CRUD service with tenant isolation."""

    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get_by_id(self, db: AsyncSession, id: int, tenant_id: int) -> Optional[ModelType]:
        query = select(self.model).where(
            and_(self.model.id == id, self.model.tenant_id == tenant_id)
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_list(
        self,
        db: AsyncSession,
        tenant_id: int,
        skip: int = 0,
        limit: int = 25,
        search: Optional[str] = None,
        search_fields: Optional[list[str]] = None,
        filters: Optional[dict] = None,
        order_by: Optional[str] = None,
        sort_direction: str = "desc",
    ) -> tuple[list[ModelType], int]:
        query = select(self.model).where(self.model.tenant_id == tenant_id)
        count_query = select(func.count()).select_from(self.model).where(self.model.tenant_id == tenant_id)

        # Search
        if search and search_fields:
            conditions = []
            for field in search_fields:
                if hasattr(self.model, field):
                    conditions.append(getattr(self.model, field).ilike(f"%{search}%"))
            if conditions:
                query = query.where(or_(*conditions))
                count_query = count_query.where(or_(*conditions))

        # Filters
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    query = query.where(getattr(self.model, key) == value)
                    count_query = count_query.where(getattr(self.model, key) == value)

        # Order
        if order_by and hasattr(self.model, order_by):
            col = getattr(self.model, order_by)
            query = query.order_by(col.asc() if sort_direction == "asc" else col.desc())
        elif hasattr(self.model, "created_at"):
            query = query.order_by(self.model.created_at.desc())

        # Count
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Paginate
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        items = list(result.scalars().all())

        return items, total

    async def create(self, db: AsyncSession, data: dict, tenant_id: int, user_id: int) -> ModelType:
        data["tenant_id"] = tenant_id
        data["created_by"] = user_id
        data["updated_by"] = user_id
        _coerce_dates(self.model, data)
        # Filter out keys that don't exist as columns on the model
        valid_keys = {c.key for c in self.model.__table__.columns}
        filtered = {k: v for k, v in data.items() if k in valid_keys}
        obj = self.model(**filtered)
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return obj

    async def update(self, db: AsyncSession, id: int, data: dict, tenant_id: int, user_id: int) -> Optional[ModelType]:
        obj = await self.get_by_id(db, id, tenant_id)
        if not obj:
            return None
        data["updated_by"] = user_id
        _coerce_dates(self.model, data)
        for key, value in data.items():
            if hasattr(obj, key):
                setattr(obj, key, value)
        await db.flush()
        await db.refresh(obj)
        return obj

    async def delete(self, db: AsyncSession, id: int, tenant_id: int) -> bool:
        obj = await self.get_by_id(db, id, tenant_id)
        if not obj:
            return False
        await db.delete(obj)
        await db.flush()
        return True
