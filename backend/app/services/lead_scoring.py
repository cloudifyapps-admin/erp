"""Lead scoring engine — evaluates tenant-configurable rules against leads."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.crm import Lead, LeadScoringRule


async def calculate_lead_score(db: AsyncSession, lead: Lead, tenant_id: int) -> tuple[int, dict]:
    """Evaluate all active scoring rules against a lead.
    Returns (total_score, score_details_dict).
    """
    result = await db.execute(
        select(LeadScoringRule).where(
            LeadScoringRule.tenant_id == tenant_id,
            LeadScoringRule.is_active == True,
        ).order_by(LeadScoringRule.sort_order)
    )
    rules = result.scalars().all()

    total = 0
    details = {}
    for rule in rules:
        matched = _evaluate_rule(lead, rule)
        if matched:
            total += rule.score
            details[f"{rule.field}_{rule.operator}"] = {
                "field": rule.field,
                "operator": rule.operator,
                "value": rule.value,
                "score": rule.score,
                "matched": True,
            }
    return total, details


def _evaluate_rule(lead: Lead, rule: LeadScoringRule) -> bool:
    """Check if a single rule matches the lead."""
    field_val = getattr(lead, rule.field, None)

    if rule.operator == "is_set":
        return field_val is not None and field_val != "" and field_val != 0

    if rule.operator == "is_not_set":
        return field_val is None or field_val == "" or field_val == 0

    if field_val is None:
        return False

    compare_val = rule.value

    if rule.operator == "equals":
        return str(field_val) == str(compare_val)

    if rule.operator == "not_equals":
        return str(field_val) != str(compare_val)

    if rule.operator == "contains":
        return str(compare_val).lower() in str(field_val).lower()

    if rule.operator == "greater_than":
        try:
            return float(field_val) > float(compare_val)
        except (ValueError, TypeError):
            return False

    if rule.operator == "less_than":
        try:
            return float(field_val) < float(compare_val)
        except (ValueError, TypeError):
            return False

    return False


async def score_and_update_lead(db: AsyncSession, lead: Lead, tenant_id: int) -> Lead:
    """Calculate score and persist it on the lead."""
    score, details = await calculate_lead_score(db, lead, tenant_id)
    lead.lead_score = score
    lead.score_details = details
    await db.flush()
    return lead


# ---------------------------------------------------------------------------
# Default scoring rules — seeded per tenant
# ---------------------------------------------------------------------------

DEFAULT_SCORING_RULES = [
    {"field": "email", "operator": "is_set", "value": None, "score": 10, "category": "demographic"},
    {"field": "phone", "operator": "is_set", "value": None, "score": 5, "category": "demographic"},
    {"field": "mobile", "operator": "is_set", "value": None, "score": 5, "category": "demographic"},
    {"field": "company", "operator": "is_set", "value": None, "score": 10, "category": "demographic"},
    {"field": "job_title", "operator": "is_set", "value": None, "score": 5, "category": "demographic"},
    {"field": "website", "operator": "is_set", "value": None, "score": 5, "category": "demographic"},
    {"field": "annual_revenue", "operator": "greater_than", "value": "100000", "score": 20, "category": "demographic"},
    {"field": "annual_revenue", "operator": "greater_than", "value": "1000000", "score": 15, "category": "demographic"},
    {"field": "employee_count", "operator": "greater_than", "value": "50", "score": 10, "category": "demographic"},
    {"field": "employee_count", "operator": "greater_than", "value": "500", "score": 10, "category": "demographic"},
]
