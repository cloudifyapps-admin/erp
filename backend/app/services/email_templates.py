"""Email template rendering service for CRM notifications."""
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.crm import EmailTemplate


async def get_template(db: AsyncSession, tenant_id: int, slug: str) -> EmailTemplate | None:
    """Fetch an active email template by slug."""
    result = await db.execute(
        select(EmailTemplate).where(
            EmailTemplate.tenant_id == tenant_id,
            EmailTemplate.slug == slug,
            EmailTemplate.is_active == True,
        )
    )
    return result.scalar_one_or_none()


def render_template(template: EmailTemplate, context: dict) -> tuple[str, str, str | None]:
    """Render an email template with context variables.
    Returns (subject, html_body, text_body).
    """
    subject = _replace_vars(template.subject, context)
    html_body = _replace_vars(template.html_body, context)
    text_body = _replace_vars(template.text_body, context) if template.text_body else None
    return subject, html_body, text_body


def _replace_vars(text: str, context: dict) -> str:
    """Replace {{variable}} placeholders with context values."""
    def replacer(match):
        key = match.group(1).strip()
        return str(context.get(key, f"{{{{{key}}}}}"))
    return re.sub(r"\{\{(\s*\w+\s*)\}\}", replacer, text)


# ---------------------------------------------------------------------------
# Default templates — seeded per tenant on creation
# ---------------------------------------------------------------------------

DEFAULT_TEMPLATES = [
    {
        "name": "Lead Assignment",
        "slug": "lead_assignment",
        "category": "lead_assignment",
        "subject": "New lead assigned: {{lead_title}}",
        "html_body": """<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2 style="color:#1a56db">New Lead Assigned to You</h2>
<p>Hi {{assigned_to_name}},</p>
<p>A new lead has been assigned to you:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Lead</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{lead_title}}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Contact</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{lead_name}}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Company</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{lead_company}}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Email</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{lead_email}}</td></tr>
</table>
<p><a href="{{lead_url}}" style="background:#1a56db;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View Lead</a></p>
</div>""",
        "text_body": "New lead assigned: {{lead_title}}\nContact: {{lead_name}}\nCompany: {{lead_company}}\nEmail: {{lead_email}}\nView: {{lead_url}}",
        "variables": ["lead_title", "lead_name", "lead_company", "lead_email", "lead_url", "assigned_to_name"],
    },
    {
        "name": "Follow-up Reminder",
        "slug": "follow_up_reminder",
        "category": "follow_up_reminder",
        "subject": "Follow-up reminder: {{entity_title}}",
        "html_body": """<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2 style="color:#d97706">Follow-up Reminder</h2>
<p>Hi {{assigned_to_name}},</p>
<p>This is a reminder to follow up on:</p>
<p style="font-size:18px;font-weight:600;margin:16px 0">{{entity_title}}</p>
<p>Scheduled follow-up: <strong>{{follow_up_date}}</strong></p>
<p><a href="{{entity_url}}" style="background:#d97706;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View Details</a></p>
</div>""",
        "text_body": "Follow-up reminder for: {{entity_title}}\nScheduled: {{follow_up_date}}\nView: {{entity_url}}",
        "variables": ["entity_title", "follow_up_date", "entity_url", "assigned_to_name"],
    },
    {
        "name": "Opportunity Stage Change",
        "slug": "stage_change",
        "category": "stage_change",
        "subject": "Opportunity moved to {{new_stage}}: {{opportunity_title}}",
        "html_body": """<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2 style="color:#1a56db">Opportunity Stage Updated</h2>
<p>The opportunity <strong>{{opportunity_title}}</strong> has been moved from <strong>{{old_stage}}</strong> to <strong>{{new_stage}}</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Customer</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{customer_name}}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Amount</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{expected_amount}}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Close Date</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{expected_close_date}}</td></tr>
</table>
<p><a href="{{opportunity_url}}" style="background:#1a56db;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View Opportunity</a></p>
</div>""",
        "text_body": "Opportunity {{opportunity_title}} moved from {{old_stage}} to {{new_stage}}\nCustomer: {{customer_name}}\nAmount: {{expected_amount}}",
        "variables": ["opportunity_title", "old_stage", "new_stage", "customer_name", "expected_amount", "expected_close_date", "opportunity_url"],
    },
    {
        "name": "Deal Won",
        "slug": "deal_won",
        "category": "deal_won",
        "subject": "Deal Won: {{opportunity_title}} — {{expected_amount}}",
        "html_body": """<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2 style="color:#16a34a">Deal Won!</h2>
<p>Congratulations! The deal <strong>{{opportunity_title}}</strong> has been marked as <strong>Won</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Customer</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{customer_name}}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Amount</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{expected_amount}}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Closed By</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{assigned_to_name}}</td></tr>
</table>
<p><a href="{{opportunity_url}}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View Opportunity</a></p>
</div>""",
        "text_body": "Deal Won! {{opportunity_title}}\nCustomer: {{customer_name}}\nAmount: {{expected_amount}}\nClosed By: {{assigned_to_name}}",
        "variables": ["opportunity_title", "customer_name", "expected_amount", "assigned_to_name", "opportunity_url"],
    },
    {
        "name": "Deal Lost",
        "slug": "deal_lost",
        "category": "deal_lost",
        "subject": "Deal Lost: {{opportunity_title}}",
        "html_body": """<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2 style="color:#dc2626">Deal Lost</h2>
<p>The deal <strong>{{opportunity_title}}</strong> has been marked as <strong>Lost</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Customer</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{customer_name}}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Amount</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{expected_amount}}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Reason</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">{{lost_reason}}</td></tr>
</table>
<p><a href="{{opportunity_url}}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View Opportunity</a></p>
</div>""",
        "text_body": "Deal Lost: {{opportunity_title}}\nCustomer: {{customer_name}}\nReason: {{lost_reason}}",
        "variables": ["opportunity_title", "customer_name", "expected_amount", "lost_reason", "opportunity_url"],
    },
]
