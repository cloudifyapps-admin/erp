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
        # Project automation
        "project-task-due-reminders": {
            "task": "app.tasks.project_task_due_reminders",
            "schedule": crontab(hour=8, minute=0),  # Daily 8 AM
        },
        "project-progress-recalculation": {
            "task": "app.tasks.recalculate_project_progress",
            "schedule": crontab(minute="*/30"),  # Every 30 min
        },
        "project-budget-alerts": {
            "task": "app.tasks.check_project_budget_alerts",
            "schedule": crontab(hour=7, minute=0),  # Daily 7 AM
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
    import asyncio
    from datetime import date, timedelta
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select, and_
    from app.models.projects import Task

    async def _process():
        engine = create_async_engine(settings.DATABASE_URL)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        today = date.today()
        async with Session() as db:
            result = await db.execute(
                select(Task).where(
                    and_(
                        Task.is_recurring == True,
                        Task.next_recurring_date <= today,
                    )
                )
            )
            for task in result.scalars().all():
                # Skip if past end date
                if task.recurring_end_date and task.recurring_end_date < today:
                    continue
                # Clone the task
                new_task = Task(
                    project_id=task.project_id,
                    milestone_id=task.milestone_id,
                    title=task.title,
                    description=task.description,
                    assigned_to=task.assigned_to,
                    priority=task.priority,
                    status="todo",
                    estimated_hours=task.estimated_hours,
                    sort_order=task.sort_order,
                    parent_task_id=task.id,
                    tenant_id=task.tenant_id,
                    created_by=task.created_by,
                    updated_by=task.updated_by,
                    start_date=today,
                )
                # Set due date based on frequency
                freq = task.recurring_frequency
                if freq == "daily":
                    new_task.due_date = today
                    task.next_recurring_date = today + timedelta(days=1)
                elif freq == "weekly":
                    new_task.due_date = today + timedelta(days=7)
                    task.next_recurring_date = today + timedelta(days=7)
                elif freq == "biweekly":
                    new_task.due_date = today + timedelta(days=14)
                    task.next_recurring_date = today + timedelta(days=14)
                elif freq == "monthly":
                    new_task.due_date = today + timedelta(days=30)
                    task.next_recurring_date = today + timedelta(days=30)
                elif freq == "quarterly":
                    new_task.due_date = today + timedelta(days=90)
                    task.next_recurring_date = today + timedelta(days=90)
                else:
                    task.next_recurring_date = today + timedelta(days=7)
                db.add(new_task)
                task.recurring_count += 1
            await db.commit()
        await engine.dispose()

    try:
        asyncio.run(_process())
    except Exception:
        pass


@app.task(name="app.tasks.project_task_due_reminders")
def project_task_due_reminders():
    """Send reminders for tasks due within 24h or overdue."""
    pass


@app.task(name="app.tasks.recalculate_project_progress")
def recalculate_project_progress():
    """Recalculate progress for all active projects."""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select, func, and_
    from app.models.projects import Project, Task, TimeLog

    async def _process():
        engine = create_async_engine(settings.DATABASE_URL)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with Session() as db:
            result = await db.execute(
                select(Project).where(Project.status == "active")
            )
            for proj in result.scalars().all():
                # Task-based progress
                task_result = await db.execute(
                    select(
                        func.count(Task.id).label("total"),
                        func.count(Task.id).filter(Task.status == "done").label("done"),
                    ).where(and_(Task.project_id == proj.id, Task.tenant_id == proj.tenant_id))
                )
                ts = task_result.one()
                proj.progress = round((ts.done / ts.total * 100) if ts.total > 0 else 0)
                # Total hours
                hours_result = await db.execute(
                    select(func.coalesce(func.sum(TimeLog.hours), 0)).where(
                        and_(TimeLog.project_id == proj.id, TimeLog.tenant_id == proj.tenant_id)
                    )
                )
                proj.total_hours = float(hours_result.scalar())
            await db.commit()
        await engine.dispose()

    try:
        asyncio.run(_process())
    except Exception:
        pass


@app.task(name="app.tasks.check_project_budget_alerts")
def check_project_budget_alerts():
    """Alert when project expenses reach 80%/90%/100% of budget."""
    pass


@app.task(name="app.tasks.send_password_reset_email")
def send_password_reset_email(
    to_email: str,
    user_name: str,
    reset_url: str,
) -> bool:
    """Send a password reset email via SMTP."""
    from app.utils.email import send_email, build_password_reset_email

    subject, html_body, text_body = build_password_reset_email(
        reset_url=reset_url,
        user_name=user_name,
    )
    return send_email(to_email, subject, html_body, text_body)


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
