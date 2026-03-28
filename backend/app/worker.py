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
            "schedule": crontab(hour=2, minute=0),  # Daily at 2 AM UTC
        },
        "process-recurring-tasks": {
            "task": "app.tasks.process_recurring_tasks",
            "schedule": crontab(hour=2, minute=30),  # Daily at 2:30 AM UTC
        },
    },
)


@app.task(name="app.tasks.process_recurring_invoices")
def process_recurring_invoices():
    """Generate invoices from recurring templates."""
    # Implementation will use sync DB session
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
    """Send a team invitation email via SMTP (runs in Celery worker)."""
    from app.utils.email import send_email, build_invitation_email

    subject, html_body, text_body = build_invitation_email(
        inviter_name=inviter_name,
        tenant_name=tenant_name,
        invite_url=invite_url,
        role_name=role_name,
    )
    return send_email(to_email, subject, html_body, text_body)
