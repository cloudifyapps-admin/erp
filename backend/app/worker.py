from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

app = Celery("erp", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "process-recurring-invoices": {
            "task": "app.tasks.process_recurring_invoices",
            "schedule": crontab(hour=2, minute=0),
        },
        "process-recurring-tasks": {
            "task": "app.tasks.process_recurring_tasks",
            "schedule": crontab(hour=2, minute=30),
        },
        # CRM automation
        "crm-follow-up-reminders": {
            "task": "app.tasks.process_follow_up_reminders",
            "schedule": crontab(minute=0, hour="*/1"),  # Every hour
        },
        "crm-lead-aging-alerts": {
            "task": "app.tasks.process_lead_aging_alerts",
            "schedule": crontab(hour=8, minute=0),  # Daily 8 AM
        },
        "crm-stale-opportunities": {
            "task": "app.tasks.process_stale_opportunities",
            "schedule": crontab(hour=9, minute=0),  # Daily 9 AM
        },
        "crm-recalculate-scores": {
            "task": "app.tasks.recalculate_lead_scores",
            "schedule": crontab(hour=3, minute=0),  # Daily 3 AM
        },
    },
)


@app.task(name="app.tasks.process_recurring_invoices")
def process_recurring_invoices():
    """Generate invoices from recurring templates."""
    pass


@app.task(name="app.tasks.process_recurring_tasks")
def process_recurring_tasks():
    """Generate tasks from recurring templates."""
    pass


@app.task(name="app.tasks.send_invitation_email")
def send_invitation_email(
    to_email: str,
    inviter_name: str,
    tenant_name: str,
    invite_url: str,
    role_name: str | None = None,
) -> bool:
    """Send a team invitation email via SMTP."""
    from app.utils.email import send_email, build_invitation_email

    subject, html_body, text_body = build_invitation_email(
        inviter_name=inviter_name,
        tenant_name=tenant_name,
        invite_url=invite_url,
        role_name=role_name,
    )
    return send_email(to_email, subject, html_body, text_body)


# ---------------------------------------------------------------------------
# CRM Automation Tasks
# ---------------------------------------------------------------------------


@app.task(name="app.tasks.send_crm_email")
def send_crm_email(event_type: str, context: dict, tenant_id: int) -> bool:
    """Send a CRM notification email using a template."""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from app.services.email_templates import get_template, render_template
    from app.utils.email import send_email
    from app.models.global_models import User
    from sqlalchemy import select

    async def _send():
        engine = create_async_engine(settings.DATABASE_URL)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with Session() as db:
            template = await get_template(db, tenant_id, event_type)
            if not template:
                return False

            # Resolve assigned user email
            assigned_to_id = context.get("assigned_to_id")
            if assigned_to_id:
                user_result = await db.execute(select(User).where(User.id == assigned_to_id))
                user = user_result.scalar_one_or_none()
                if user:
                    context["assigned_to_name"] = user.name or user.email
                    context["assigned_to_email"] = user.email
                    from app.core.config import settings as app_settings
                    context.setdefault("lead_url", f"{app_settings.FRONTEND_URL}/crm/leads/{context.get('lead_id', '')}")
                    context.setdefault("opportunity_url", f"{app_settings.FRONTEND_URL}/crm/opportunities/{context.get('opportunity_id', '')}")
                    context.setdefault("entity_url", context.get("lead_url", ""))

                    subject, html_body, text_body = render_template(template, context)
                    return send_email(user.email, subject, html_body, text_body)
            return False
        await engine.dispose()

    try:
        return asyncio.run(_send())
    except Exception:
        return False


@app.task(name="app.tasks.process_follow_up_reminders")
def process_follow_up_reminders():
    """Check leads/opportunities with next_follow_up_at <= now, send reminder."""
    import asyncio
    from datetime import datetime
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select
    from app.models.crm import Lead, Opportunity

    async def _process():
        engine = create_async_engine(settings.DATABASE_URL)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        now = datetime.utcnow()
        async with Session() as db:
            # Leads due for follow-up
            result = await db.execute(
                select(Lead).where(
                    Lead.next_follow_up_at <= now,
                    Lead.next_follow_up_at != None,
                    Lead.status != "converted",
                    Lead.assigned_to != None,
                )
            )
            for lead in result.scalars().all():
                send_crm_email.delay("follow_up_reminder", {
                    "entity_title": lead.title,
                    "follow_up_date": lead.next_follow_up_at.isoformat() if lead.next_follow_up_at else "",
                    "assigned_to_id": lead.assigned_to,
                    "lead_id": lead.id,
                }, lead.tenant_id)
                lead.next_follow_up_at = None  # Clear to avoid re-sending
            # Opportunities due for follow-up
            result = await db.execute(
                select(Opportunity).where(
                    Opportunity.next_follow_up_at <= now,
                    Opportunity.next_follow_up_at != None,
                    Opportunity.assigned_to != None,
                )
            )
            for opp in result.scalars().all():
                send_crm_email.delay("follow_up_reminder", {
                    "entity_title": opp.title,
                    "follow_up_date": opp.next_follow_up_at.isoformat() if opp.next_follow_up_at else "",
                    "assigned_to_id": opp.assigned_to,
                    "opportunity_id": opp.id,
                }, opp.tenant_id)
                opp.next_follow_up_at = None
            await db.commit()
        await engine.dispose()

    try:
        asyncio.run(_process())
    except Exception:
        pass


@app.task(name="app.tasks.process_lead_aging_alerts")
def process_lead_aging_alerts():
    """Find leads with status=new that haven't been touched in 7 days."""
    import asyncio
    from datetime import datetime, timedelta
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select
    from app.models.crm import Lead

    async def _process():
        engine = create_async_engine(settings.DATABASE_URL)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        threshold = datetime.utcnow() - timedelta(days=7)
        async with Session() as db:
            result = await db.execute(
                select(Lead).where(
                    Lead.status == "new",
                    Lead.created_at <= threshold,
                    Lead.assigned_to != None,
                )
            )
            for lead in result.scalars().all():
                send_crm_email.delay("follow_up_reminder", {
                    "entity_title": f"[Aging] {lead.title}",
                    "follow_up_date": "Overdue - lead is 7+ days old",
                    "assigned_to_id": lead.assigned_to,
                    "lead_id": lead.id,
                }, lead.tenant_id)
        await engine.dispose()

    try:
        asyncio.run(_process())
    except Exception:
        pass


@app.task(name="app.tasks.process_stale_opportunities")
def process_stale_opportunities():
    """Find opportunities with no activity in 14 days."""
    import asyncio
    from datetime import datetime, timedelta
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select, or_
    from app.models.crm import Opportunity

    async def _process():
        engine = create_async_engine(settings.DATABASE_URL)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        threshold = datetime.utcnow() - timedelta(days=14)
        async with Session() as db:
            result = await db.execute(
                select(Opportunity).where(
                    or_(
                        Opportunity.last_activity_at <= threshold,
                        Opportunity.last_activity_at == None,
                    ),
                    Opportunity.stage.notin_(["closed_won", "closed_lost", "won", "lost"]),
                    Opportunity.assigned_to != None,
                )
            )
            for opp in result.scalars().all():
                send_crm_email.delay("follow_up_reminder", {
                    "entity_title": f"[Stale] {opp.title}",
                    "follow_up_date": "No activity in 14+ days",
                    "assigned_to_id": opp.assigned_to,
                    "opportunity_id": opp.id,
                }, opp.tenant_id)
        await engine.dispose()

    try:
        asyncio.run(_process())
    except Exception:
        pass


@app.task(name="app.tasks.recalculate_lead_scores")
def recalculate_lead_scores():
    """Batch recalculate lead scores for all active leads."""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select
    from app.models.crm import Lead
    from app.services.lead_scoring import score_and_update_lead

    async def _process():
        engine = create_async_engine(settings.DATABASE_URL)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with Session() as db:
            result = await db.execute(
                select(Lead).where(Lead.status.notin_(["converted", "lost"]))
            )
            for lead in result.scalars().all():
                await score_and_update_lead(db, lead, lead.tenant_id)
            await db.commit()
        await engine.dispose()

    try:
        asyncio.run(_process())
    except Exception:
        pass
