"""Seed script to populate initial data (countries, currencies, languages, permissions)."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.database import Base
from app.models import *  # noqa
from app.models.global_models import Country, Currency, Language
from app.models.tenant_models import Permission
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://erp_user:erp_password@postgres:5432/erp_db")

COUNTRIES = [
    {"name": "United States", "code": "US", "phone_code": "+1", "flag_emoji": "🇺🇸"},
    {"name": "United Kingdom", "code": "GB", "phone_code": "+44", "flag_emoji": "🇬🇧"},
    {"name": "India", "code": "IN", "phone_code": "+91", "flag_emoji": "🇮🇳"},
    {"name": "Germany", "code": "DE", "phone_code": "+49", "flag_emoji": "🇩🇪"},
    {"name": "France", "code": "FR", "phone_code": "+33", "flag_emoji": "🇫🇷"},
    {"name": "Japan", "code": "JP", "phone_code": "+81", "flag_emoji": "🇯🇵"},
    {"name": "Australia", "code": "AU", "phone_code": "+61", "flag_emoji": "🇦🇺"},
    {"name": "Canada", "code": "CA", "phone_code": "+1", "flag_emoji": "🇨🇦"},
    {"name": "Singapore", "code": "SG", "phone_code": "+65", "flag_emoji": "🇸🇬"},
    {"name": "UAE", "code": "AE", "phone_code": "+971", "flag_emoji": "🇦🇪"},
    {"name": "Brazil", "code": "BR", "phone_code": "+55", "flag_emoji": "🇧🇷"},
    {"name": "China", "code": "CN", "phone_code": "+86", "flag_emoji": "🇨🇳"},
    {"name": "Netherlands", "code": "NL", "phone_code": "+31", "flag_emoji": "🇳🇱"},
    {"name": "Switzerland", "code": "CH", "phone_code": "+41", "flag_emoji": "🇨🇭"},
    {"name": "South Korea", "code": "KR", "phone_code": "+82", "flag_emoji": "🇰🇷"},
]

CURRENCIES = [
    {"name": "US Dollar", "code": "USD", "symbol": "$", "decimal_places": 2},
    {"name": "Euro", "code": "EUR", "symbol": "€", "decimal_places": 2},
    {"name": "British Pound", "code": "GBP", "symbol": "£", "decimal_places": 2},
    {"name": "Indian Rupee", "code": "INR", "symbol": "₹", "decimal_places": 2},
    {"name": "Japanese Yen", "code": "JPY", "symbol": "¥", "decimal_places": 0},
    {"name": "Australian Dollar", "code": "AUD", "symbol": "A$", "decimal_places": 2},
    {"name": "Canadian Dollar", "code": "CAD", "symbol": "C$", "decimal_places": 2},
    {"name": "Singapore Dollar", "code": "SGD", "symbol": "S$", "decimal_places": 2},
    {"name": "Swiss Franc", "code": "CHF", "symbol": "CHF", "decimal_places": 2},
    {"name": "UAE Dirham", "code": "AED", "symbol": "د.إ", "decimal_places": 2},
]

LANGUAGES = [
    {"name": "English", "code": "en", "direction": "ltr"},
    {"name": "Hindi", "code": "hi", "direction": "ltr"},
    {"name": "Arabic", "code": "ar", "direction": "rtl"},
    {"name": "French", "code": "fr", "direction": "ltr"},
    {"name": "German", "code": "de", "direction": "ltr"},
    {"name": "Japanese", "code": "ja", "direction": "ltr"},
    {"name": "Chinese (Simplified)", "code": "zh", "direction": "ltr"},
    {"name": "Spanish", "code": "es", "direction": "ltr"},
    {"name": "Portuguese", "code": "pt", "direction": "ltr"},
]

RESOURCES = [
    "leads", "contacts", "customers", "opportunities", "activities",
    "campaigns", "territories", "tags", "notes", "email-templates", "web-forms",
    "quotations", "sales-orders", "deliveries", "invoices",
    "vendors", "purchase-orders", "goods-receipts", "purchase-requests",
    "products", "warehouses", "stock-movements", "stock-adjustments", "stock-transfers",
    "projects", "tasks", "milestones", "time-logs",
    "project-members", "project-comments", "project-attachments",
    "task-comments", "task-attachments",
    "project-templates", "project-phases", "resource-allocations",
    "project-expenses", "project-budget", "project-invoices", "billing-rates",
    "project-risks", "project-issues", "change-requests", "status-reports", "meeting-notes",
    "employees", "departments", "attendance", "leave-requests", "payroll",
    "performance-reviews", "expense-claims",
    "documents", "tickets",
]

ACTIONS = ["view", "create", "edit", "delete", "view-own", "edit-own"]


async def seed():
    engine = create_async_engine(DATABASE_URL)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        # Seed countries
        from sqlalchemy import select
        result = await session.execute(select(Country).limit(1))
        if not result.scalar_one_or_none():
            for c in COUNTRIES:
                session.add(Country(**c))
            print(f"Seeded {len(COUNTRIES)} countries")

        # Seed currencies
        result = await session.execute(select(Currency).limit(1))
        if not result.scalar_one_or_none():
            for c in CURRENCIES:
                session.add(Currency(**c))
            print(f"Seeded {len(CURRENCIES)} currencies")

        # Seed languages
        result = await session.execute(select(Language).limit(1))
        if not result.scalar_one_or_none():
            for l in LANGUAGES:
                session.add(Language(**l))
            print(f"Seeded {len(LANGUAGES)} languages")

        # Seed permissions
        result = await session.execute(select(Permission).limit(1))
        if not result.scalar_one_or_none():
            count = 0
            for resource in RESOURCES:
                for action in ACTIONS:
                    slug = f"{resource}:{action}"
                    session.add(Permission(
                        name=f"{action.replace('-', ' ').title()} {resource.replace('-', ' ').title()}",
                        slug=slug,
                        module=resource.split("-")[0],
                    ))
                    count += 1
            # Add settings:manage
            session.add(Permission(name="Manage Settings", slug="settings:manage", module="settings"))
            count += 1
            print(f"Seeded {count} permissions")

        await session.commit()
        print("Seed completed!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
