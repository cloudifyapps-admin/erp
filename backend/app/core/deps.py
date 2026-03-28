from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_token
from app.models.global_models import User, TenantUser

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    token_type = payload.get("type")
    if token_type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


async def get_current_tenant_id(
    user: User = Depends(get_current_user),
) -> int:
    if user.current_tenant_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No tenant selected")
    return user.current_tenant_id


async def get_user_permissions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    from app.models.tenant_models import UserRole, Role, RolePermission, Permission

    # Get user roles for current tenant
    result = await db.execute(
        select(Permission.slug)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user.id)
        .where(UserRole.tenant_id == user.current_tenant_id)
    )
    permissions = [row[0] for row in result.fetchall()]
    return permissions


def require_permission(resource: str, action: str):
    async def checker(
        user: User = Depends(get_current_user),
        permissions: list[str] = Depends(get_user_permissions),
        db: AsyncSession = Depends(get_db),
    ):
        from app.models.global_models import Tenant

        # Check if user is tenant owner (bypass all permissions)
        result = await db.execute(
            select(Tenant).where(Tenant.id == user.current_tenant_id)
        )
        tenant = result.scalar_one_or_none()
        if tenant and tenant.owner_id == user.id:
            return True

        # Check exact permission
        perm_slug = f"{resource}:{action}"
        if perm_slug in permissions:
            return True

        # Fallback: view -> view-own, edit -> edit-own
        if action == "view" and f"{resource}:view-own" in permissions:
            return True
        if action == "edit" and f"{resource}:edit-own" in permissions:
            return True

        # Settings maps to settings:manage
        if resource == "settings":
            if "settings:manage" in permissions:
                return True

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    return checker
