from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token, create_invitation_token
from app.core.deps import get_current_user, get_user_permissions
from app.models.global_models import User, Tenant, TenantUser, TeamInvitation
from app.models.tenant_models import OrganizationSettings, Role, UserRole, Permission, RolePermission
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, RefreshRequest, SwitchTenantRequest, MeResponse, UserResponse
from app.services.numbering import DEFAULT_SERIES


# ---------------------------------------------------------------------------
# Default Roles — created for every new tenant
# ---------------------------------------------------------------------------
DEFAULT_ROLES = [
    {
        "name": "Admin",
        "slug": "admin",
        "description": "Full access to everything",
        "is_system": True,
        "permissions": "*",  # All permissions
    },
    {
        "name": "Manager",
        "slug": "manager",
        "description": "Can view, create, and edit most resources",
        "is_system": False,
        "permissions": ["view", "create", "edit", "view-own", "edit-own"],
    },
    {
        "name": "Employee",
        "slug": "employee",
        "description": "Can view and manage own records",
        "is_system": False,
        "permissions": ["view-own", "edit-own"],
    },
    {
        "name": "Sales Rep",
        "slug": "sales-rep",
        "description": "CRM and sales access",
        "is_system": False,
        "resources": [
            "leads", "contacts", "customers", "opportunities", "activities",
            "quotations", "sales-orders", "deliveries", "invoices",
        ],
        "permissions": ["view", "create", "edit", "view-own", "edit-own"],
    },
    {
        "name": "Accountant",
        "slug": "accountant",
        "description": "Finance and invoice access",
        "is_system": False,
        "resources": [
            "invoices", "quotations", "sales-orders", "purchase-orders",
            "vendors", "customers", "expense-claims", "payroll",
        ],
        "permissions": ["view", "create", "edit", "delete"],
    },
    {
        "name": "HR Manager",
        "slug": "hr-manager",
        "description": "Human resources access",
        "is_system": False,
        "resources": [
            "employees", "departments", "attendance", "leave-requests",
            "payroll", "performance-reviews", "expense-claims",
        ],
        "permissions": ["view", "create", "edit", "delete"],
    },
    {
        "name": "Project Manager",
        "slug": "project-manager",
        "description": "Projects and task management",
        "is_system": False,
        "resources": [
            "projects", "tasks", "milestones", "time-logs",
        ],
        "permissions": ["view", "create", "edit", "delete"],
    },
    {
        "name": "Viewer",
        "slug": "viewer",
        "description": "Read-only access to all resources",
        "is_system": False,
        "permissions": ["view"],
    },
]


async def create_default_roles(
    db: AsyncSession,
    tenant_id: int,
    user_id: int,
) -> dict[str, Role]:
    """Create default roles and assign permissions. Returns slug→Role map."""
    from sqlalchemy import select

    # Fetch all permissions
    result = await db.execute(select(Permission))
    all_permissions = result.scalars().all()
    perm_map: dict[str, Permission] = {p.slug: p for p in all_permissions}

    created_roles: dict[str, Role] = {}

    for role_def in DEFAULT_ROLES:
        # Check if role already exists for this tenant
        existing = (await db.execute(
            select(Role).where(Role.tenant_id == tenant_id, Role.slug == role_def["slug"])
        )).scalar_one_or_none()
        if existing:
            created_roles[role_def["slug"]] = existing
            continue

        role = Role(
            tenant_id=tenant_id,
            name=role_def["name"],
            slug=role_def["slug"],
            description=role_def["description"],
            is_system=role_def.get("is_system", False),
            created_by=user_id,
            updated_by=user_id,
        )
        db.add(role)
        await db.flush()

        # Determine which permissions to assign
        role_perms = role_def["permissions"]
        role_resources = role_def.get("resources")

        matched_perms: list[Permission] = []
        if role_perms == "*":
            matched_perms = list(all_permissions)
        else:
            for perm in all_permissions:
                # perm.slug is like "leads:view", "customers:edit-own"
                parts = perm.slug.rsplit(":", 1)
                if len(parts) != 2:
                    continue
                resource, action = parts
                if action not in role_perms:
                    continue
                if role_resources and resource not in role_resources:
                    continue
                matched_perms.append(perm)

        for perm in matched_perms:
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))

        created_roles[role_def["slug"]] = role

    return created_roles

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    user = User(
        name=data.name,
        email=data.email,
        password_hash=get_password_hash(data.password),
    )
    db.add(user)
    await db.flush()

    # Create tenant
    tenant = Tenant(
        owner_id=user.id,
        name=data.company_name or f"{data.name}'s Organization",
        personal_tenant=not bool(data.company_name),
    )
    db.add(tenant)
    await db.flush()

    # Link user to tenant
    tenant_user = TenantUser(tenant_id=tenant.id, user_id=user.id, role="admin")
    db.add(tenant_user)

    # Set current tenant
    user.current_tenant_id = tenant.id

    # Create org settings with default number series
    org_settings = OrganizationSettings(
        tenant_id=tenant.id,
        name=data.company_name or data.name,
        number_series=DEFAULT_SERIES,
        created_by=user.id,
        updated_by=user.id,
    )
    db.add(org_settings)

    # Create default roles (Admin, Manager, Employee, Sales Rep, etc.)
    roles_map = await create_default_roles(db, tenant.id, user.id)

    # Assign admin role to the registering user
    admin_role = roles_map.get("admin")
    if admin_role:
        user_role = UserRole(user_id=user.id, role_id=admin_role.id, tenant_id=tenant.id)
        db.add(user_role)

    await db.flush()

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=MeResponse)
async def get_me(
    user: User = Depends(get_current_user),
    permissions: list[str] = Depends(get_user_permissions),
    db: AsyncSession = Depends(get_db),
):
    tenant_data = None
    role = None
    if user.current_tenant_id:
        result = await db.execute(select(Tenant).where(Tenant.id == user.current_tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant:
            tenant_data = {"id": tenant.id, "name": tenant.name, "is_owner": tenant.owner_id == user.id}

        # Get user's role
        result = await db.execute(
            select(TenantUser).where(
                TenantUser.user_id == user.id,
                TenantUser.tenant_id == user.current_tenant_id,
            )
        )
        tu = result.scalar_one_or_none()
        if tu:
            role = tu.role

    return MeResponse(
        user=UserResponse.model_validate(user),
        tenant=tenant_data,
        permissions=permissions,
        role=role,
    )


@router.post("/switch-tenant")
async def switch_tenant(
    data: SwitchTenantRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify user belongs to tenant
    result = await db.execute(
        select(TenantUser).where(
            TenantUser.user_id == user.id,
            TenantUser.tenant_id == data.tenant_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this tenant")

    user.current_tenant_id = data.tenant_id
    await db.flush()
    return {"message": "Tenant switched", "tenant_id": data.tenant_id}


@router.get("/invitation-info")
async def get_invitation_info(token: str, db: AsyncSession = Depends(get_db)):
    """Get invitation details for the accept-invitation page (no auth required)."""
    from datetime import datetime

    payload = decode_token(token)
    if not payload or payload.get("type") != "invitation":
        raise HTTPException(status_code=400, detail="Invalid or expired invitation link")

    invitation = (await db.execute(
        select(TeamInvitation).where(TeamInvitation.token == token)
    )).scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.status != "pending":
        raise HTTPException(status_code=410, detail=f"Invitation has been {invitation.status}")

    if invitation.expires_at < datetime.utcnow():
        invitation.status = "expired"
        await db.commit()
        raise HTTPException(status_code=410, detail="Invitation has expired")

    # Get tenant and inviter info
    tenant = (await db.execute(
        select(Tenant).where(Tenant.id == invitation.tenant_id)
    )).scalar_one()
    inviter = (await db.execute(
        select(User).where(User.id == invitation.invited_by)
    )).scalar_one()

    role_name = None
    if invitation.role_id:
        role = (await db.execute(
            select(Role).where(Role.id == invitation.role_id)
        )).scalar_one_or_none()
        role_name = role.name if role else None

    # Check if user already has an account
    existing_user = (await db.execute(
        select(User).where(User.email == invitation.email)
    )).scalar_one_or_none()

    return {
        "email": invitation.email,
        "tenant_name": tenant.name,
        "inviter_name": inviter.name,
        "role_name": role_name,
        "has_account": existing_user is not None,
    }


@router.post("/accept-invitation", response_model=TokenResponse)
async def accept_invitation(data: dict, db: AsyncSession = Depends(get_db)):
    """Accept a team invitation. Creates account if needed, links user to tenant."""
    from datetime import datetime

    token = data.get("token", "")
    name = data.get("name", "").strip()
    password = data.get("password", "")

    payload = decode_token(token)
    if not payload or payload.get("type") != "invitation":
        raise HTTPException(status_code=400, detail="Invalid or expired invitation link")

    invitation = (await db.execute(
        select(TeamInvitation).where(TeamInvitation.token == token)
    )).scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.status != "pending":
        raise HTTPException(status_code=410, detail=f"Invitation has been {invitation.status}")

    if invitation.expires_at < datetime.utcnow():
        invitation.status = "expired"
        await db.commit()
        raise HTTPException(status_code=410, detail="Invitation has expired")

    # Find or create user
    user = (await db.execute(
        select(User).where(User.email == invitation.email)
    )).scalar_one_or_none()

    if not user:
        # New user — require name and password
        if not name:
            raise HTTPException(status_code=422, detail="Name is required for new accounts")
        if not password or len(password) < 6:
            raise HTTPException(status_code=422, detail="Password must be at least 6 characters")

        user = User(
            name=name,
            email=invitation.email,
            password_hash=get_password_hash(password),
        )
        db.add(user)
        await db.flush()

    # Check if already a member (edge case)
    already_member = (await db.execute(
        select(TenantUser).where(
            TenantUser.user_id == user.id,
            TenantUser.tenant_id == invitation.tenant_id,
        )
    )).scalar_one_or_none()

    if already_member:
        invitation.status = "accepted"
        invitation.accepted_at = datetime.utcnow()
        await db.commit()
        raise HTTPException(status_code=409, detail="You are already a member of this organization")

    # Link user to tenant
    tenant_user = TenantUser(
        tenant_id=invitation.tenant_id,
        user_id=user.id,
        role="employee",
    )
    db.add(tenant_user)

    # Assign role if specified
    if invitation.role_id:
        user_role = UserRole(
            user_id=user.id,
            role_id=invitation.role_id,
            tenant_id=invitation.tenant_id,
        )
        db.add(user_role)

    # Set current tenant
    user.current_tenant_id = invitation.tenant_id

    # Mark invitation as accepted
    invitation.status = "accepted"
    invitation.accepted_at = datetime.utcnow()

    await db.commit()

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)
