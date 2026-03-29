"""Comprehensive CRM test data seeder — creates realistic enterprise CRM data."""
import asyncio
import random
from datetime import datetime, date, timedelta
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings
from app.models.global_models import User, Tenant, TenantUser
from app.models.tenant_models import (
    Industry, CustomerRating, LostReason, Competitor, Territory, Campaign,
    LeadSource, LeadStatus, OpportunityStage, ActivityType,
)
from app.models.crm import (
    Lead, Contact, Customer, Opportunity, Activity,
    Tag, EntityTag, Note, EmailTemplate, LeadScoringRule,
)
from app.services.numbering import commit_number


# ---------------------------------------------------------------------------
# Data pools
# ---------------------------------------------------------------------------
FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "Michael", "Jennifer", "David",
    "Linda", "William", "Elizabeth", "Richard", "Barbara", "Thomas", "Susan",
    "Charles", "Jessica", "Daniel", "Sarah", "Matthew", "Karen", "Anthony",
    "Lisa", "Mark", "Nancy", "Steven", "Betty", "Paul", "Margaret", "Andrew",
    "Sandra", "Joshua", "Ashley", "Kenneth", "Dorothy", "Kevin", "Kimberly",
    "Brian", "Emily", "George", "Donna", "Timothy", "Michelle", "Ronald",
    "Carol", "Edward", "Amanda", "Jason", "Melissa", "Jeffrey", "Deborah",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
    "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts",
]

COMPANIES = [
    "TechVision Inc", "Global Dynamics Corp", "Nexus Solutions", "Apex Industries",
    "Quantum Analytics", "Bright Future LLC", "Pinnacle Consulting", "Summit Digital",
    "Horizon Media", "BlueStar Enterprises", "CloudBridge Systems", "DataFlow Corp",
    "EaglePoint Inc", "FirstWave Tech", "GreenLeaf Solutions", "HyperScale LLC",
    "InnovateTech", "JetStream Data", "KeyStone Partners", "LightSpeed Corp",
    "MetaCore Systems", "NorthStar Capital", "OmniChannel Corp", "PrimeTech Solutions",
    "RedRock Ventures", "SilverLine Inc", "TrueNorth Analytics", "UltraNet Systems",
    "VelocityOne Corp", "WavePoint Digital", "XenithSoft", "YieldMax Corp",
    "ZenithPeak Technologies", "Stratosphere Labs", "IronClad Security",
    "CyberEdge Solutions", "PulsePoint Media", "DigiVault Inc", "BrightPath AI",
    "SwiftConnect LLC",
]

DOMAINS = [
    "techvision.com", "globaldynamics.com", "nexussol.com", "apexind.com",
    "quantumanalytics.io", "brightfuture.co", "pinnaclecon.com", "summitdigital.io",
    "horizonmedia.com", "bluestar.com", "cloudbridge.io", "dataflow.com",
    "eaglepoint.com", "firstwavetech.com", "greenleaf.com", "hyperscale.io",
    "innovatetech.com", "jetstream.io", "keystone.com", "lightspeed.io",
    "metacore.com", "northstar.com", "omnichannel.com", "primetech.com",
    "redrock.vc", "silverline.com", "truenorth.io", "ultranet.com",
    "velocityone.com", "wavepoint.io", "xenithsoft.com", "yieldmax.com",
    "zenithpeak.com", "stratospherelabs.io", "ironclad.com",
    "cyberedge.io", "pulsepoint.com", "digivault.com", "brightpath.ai",
    "swiftconnect.com",
]

LEAD_TITLES = [
    "Need ERP system for our factory", "Looking for CRM solution",
    "Digital transformation project", "Cloud migration inquiry",
    "Warehouse management system", "Sales automation requirements",
    "HR & Payroll software", "Inventory management upgrade",
    "Customer portal development", "Business intelligence solution",
    "E-commerce platform integration", "Supply chain optimization",
    "Marketing automation tool", "Financial reporting system",
    "Mobile app development", "Data analytics platform",
    "Custom software development", "IT infrastructure upgrade",
    "SaaS platform for logistics", "AI-powered customer service",
]

OPPORTUNITY_NAMES = [
    "Enterprise ERP Implementation", "Cloud Migration Project",
    "Digital Transformation Suite", "Warehouse Automation System",
    "Sales CRM Platform", "HR Management Solution",
    "Financial Analytics Dashboard", "E-commerce Integration",
    "Supply Chain Platform", "Marketing Automation Suite",
    "Customer Portal Development", "Data Lake Implementation",
    "Mobile Enterprise App", "Business Intelligence Platform",
    "IoT Monitoring System", "Cybersecurity Upgrade",
    "DevOps Pipeline Setup", "API Gateway Implementation",
    "Microservices Architecture", "AI/ML Analytics Platform",
]

ACTIVITY_SUBJECTS = [
    "Discovery call with stakeholders", "Product demo session",
    "Follow-up on proposal", "Quarterly business review",
    "Requirements gathering meeting", "Pricing discussion",
    "Technical architecture review", "Contract negotiation",
    "Proof of concept kickoff", "Implementation planning",
    "User acceptance testing", "Go-live preparation meeting",
    "Status update call", "Executive sponsor meeting",
    "RFP response discussion", "Budget approval follow-up",
    "Partnership discussion", "Renewal conversation",
    "Upsell opportunity review", "Customer success check-in",
]

NOTE_CONTENTS = [
    "Client expressed strong interest in our enterprise solution. Budget approved for Q2.",
    "Decision makers identified: CTO and VP of Engineering. Need to schedule exec demo.",
    "Competitor (Acme Corp) is also in the running. We need to emphasize our integration capabilities.",
    "POC went well — client impressed with reporting module. Next step: pricing proposal.",
    "Client has a hard deadline of end of quarter. Need to accelerate the sales cycle.",
    "Legal review of contract terms in progress. Expected completion within 2 weeks.",
    "Customer requested customization for their workflow. Engineering team is evaluating.",
    "Budget concern raised — exploring flexible payment terms to close the deal.",
    "Positive feedback from technical team after architecture review.",
    "Stakeholder alignment meeting scheduled for next week. Key blocker is procurement process.",
]

LOST_REASONS_DATA = [
    "Price too high", "Chose competitor", "Budget cut", "Project postponed",
    "Requirements changed", "No decision made", "Poor timing", "Internal solution",
]


async def seed_crm_test_data():
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # Find our test user + tenant
        user_result = await db.execute(
            select(User).where(User.email == "crmtest@cloudifyapps.com")
        )
        user = user_result.scalar_one_or_none()
        if not user:
            print("ERROR: Test user crmtest@cloudifyapps.com not found. Register first.")
            return

        tu_result = await db.execute(
            select(TenantUser).where(TenantUser.user_id == user.id)
        )
        tu = tu_result.scalar_one_or_none()
        if not tu:
            print("ERROR: User has no tenant association.")
            return

        tenant_id = tu.tenant_id
        user_id = user.id
        print(f"Seeding CRM data for tenant_id={tenant_id}, user_id={user_id}")

        # ── 1. Seed master data ──────────────────────────────────────
        print("  → Seeding industries...")
        industry_names = [
            "Technology", "Healthcare", "Finance", "Manufacturing", "Retail",
            "Education", "Real Estate", "Consulting", "Energy", "Logistics",
            "Telecommunications", "Media & Entertainment", "Agriculture", "Automotive", "Aerospace",
        ]
        industries = []
        for i, name in enumerate(industry_names):
            ind = Industry(tenant_id=tenant_id, name=name, slug=name.lower().replace(" & ", "-").replace(" ", "-"),
                          is_active=True, sort_order=i, created_by=user_id, updated_by=user_id)
            db.add(ind)
            industries.append(ind)
        await db.flush()

        print("  → Seeding customer ratings...")
        rating_data = [("Hot", "hot", "#ef4444"), ("Warm", "warm", "#f59e0b"), ("Cold", "cold", "#3b82f6")]
        ratings = []
        for i, (name, slug, color) in enumerate(rating_data):
            r = CustomerRating(tenant_id=tenant_id, name=name, slug=slug, color=color,
                             is_active=True, sort_order=i, created_by=user_id, updated_by=user_id)
            db.add(r)
            ratings.append(r)
        await db.flush()

        print("  → Seeding lost reasons...")
        lost_reasons = []
        for i, name in enumerate(LOST_REASONS_DATA):
            lr = LostReason(tenant_id=tenant_id, name=name, slug=name.lower().replace(" ", "-"),
                           is_active=True, sort_order=i, created_by=user_id, updated_by=user_id)
            db.add(lr)
            lost_reasons.append(lr)
        await db.flush()

        print("  → Seeding competitors...")
        comp_names = ["Acme Corp", "OmniSoft", "TechRival Inc", "SalesForce Pro", "HubCloud"]
        competitors = []
        for name in comp_names:
            c = Competitor(tenant_id=tenant_id, name=name, website=f"https://{name.lower().replace(' ', '')}.com",
                          strengths="Strong brand recognition", weaknesses="Higher pricing",
                          is_active=True, created_by=user_id, updated_by=user_id)
            db.add(c)
            competitors.append(c)
        await db.flush()

        print("  → Seeding territories...")
        territory_names = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East & Africa"]
        territories = []
        for i, name in enumerate(territory_names):
            t = Territory(tenant_id=tenant_id, name=name, slug=name.lower().replace(" & ", "-").replace(" ", "-"),
                         is_active=True, sort_order=i, created_by=user_id, updated_by=user_id)
            db.add(t)
            territories.append(t)
        await db.flush()

        # Get existing lead sources, statuses, opportunity stages, activity types
        sources_q = await db.execute(select(LeadSource).where(LeadSource.tenant_id == tenant_id))
        lead_sources = sources_q.scalars().all()
        if not lead_sources:
            print("  → Seeding lead sources via settings API...")
            for name in ["Website", "Referral", "LinkedIn", "Cold Call", "Trade Show", "Email Campaign", "Social Media", "Partner"]:
                ls = LeadSource(tenant_id=tenant_id, name=name, slug=name.lower().replace(" ", "-"),
                               is_active=True, created_by=user_id, updated_by=user_id)
                db.add(ls)
            await db.flush()
            sources_q = await db.execute(select(LeadSource).where(LeadSource.tenant_id == tenant_id))
            lead_sources = sources_q.scalars().all()

        statuses_q = await db.execute(select(LeadStatus).where(LeadStatus.tenant_id == tenant_id))
        lead_statuses = statuses_q.scalars().all()
        if not lead_statuses:
            for name in ["New", "Contacted", "Qualified", "Nurturing", "Converted", "Lost"]:
                ls = LeadStatus(tenant_id=tenant_id, name=name, slug=name.lower(),
                               is_active=True, created_by=user_id, updated_by=user_id)
                db.add(ls)
            await db.flush()
            statuses_q = await db.execute(select(LeadStatus).where(LeadStatus.tenant_id == tenant_id))
            lead_statuses = statuses_q.scalars().all()

        stages_q = await db.execute(select(OpportunityStage).where(OpportunityStage.tenant_id == tenant_id))
        opp_stages = stages_q.scalars().all()
        if not opp_stages:
            for name in ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]:
                os = OpportunityStage(tenant_id=tenant_id, name=name, slug=name.lower().replace(" ", "_"),
                                     is_active=True, created_by=user_id, updated_by=user_id)
                db.add(os)
            await db.flush()
            stages_q = await db.execute(select(OpportunityStage).where(OpportunityStage.tenant_id == tenant_id))
            opp_stages = stages_q.scalars().all()

        atypes_q = await db.execute(select(ActivityType).where(ActivityType.tenant_id == tenant_id))
        activity_types = atypes_q.scalars().all()
        if not activity_types:
            for name in ["Call", "Email", "Meeting", "Task", "Note"]:
                at = ActivityType(tenant_id=tenant_id, name=name, slug=name.lower(),
                                 is_active=True, created_by=user_id, updated_by=user_id)
                db.add(at)
            await db.flush()
            atypes_q = await db.execute(select(ActivityType).where(ActivityType.tenant_id == tenant_id))
            activity_types = atypes_q.scalars().all()

        # ── 2. Campaigns ────────────────────────────────────────────
        print("  → Creating 8 campaigns...")
        campaign_data = [
            ("Spring Email Blast 2026", "email", "completed", -90, -60),
            ("Tech Conference 2026", "event", "completed", -120, -118),
            ("LinkedIn Ad Campaign", "advertising", "active", -30, 30),
            ("Product Webinar Series", "webinar", "active", -14, 14),
            ("Social Media Push Q2", "social_media", "active", -7, 60),
            ("Partner Referral Program", "other", "active", -60, 90),
            ("Summer Sale Campaign", "email", "draft", 30, 60),
            ("Industry Conference Q3", "event", "draft", 60, 62),
        ]
        campaigns = []
        for name, ctype, cstatus, start_offset, end_offset in campaign_data:
            code = await commit_number(db, tenant_id, "campaign")
            budget = round(random.uniform(5000, 50000), 2)
            c = Campaign(
                tenant_id=tenant_id, name=name, code=code, type=ctype, status=cstatus,
                start_date=date.today() + timedelta(days=start_offset),
                end_date=date.today() + timedelta(days=end_offset),
                budget=Decimal(str(budget)),
                actual_cost=Decimal(str(round(budget * random.uniform(0.6, 1.1), 2))) if cstatus == "completed" else None,
                expected_revenue=Decimal(str(round(budget * random.uniform(3, 8), 2))),
                description=f"Campaign for {name}",
                is_active=cstatus != "cancelled",
                created_by=user_id, updated_by=user_id,
            )
            db.add(c)
            campaigns.append(c)
        await db.flush()

        # ── 3. Tags ─────────────────────────────────────────────────
        print("  → Creating tags...")
        tag_data = [
            ("VIP", "#ef4444"), ("Enterprise", "#8b5cf6"), ("SMB", "#3b82f6"),
            ("Follow Up", "#f59e0b"), ("Decision Maker", "#10b981"), ("Hot Lead", "#f97316"),
            ("Needs Demo", "#6366f1"), ("Referral", "#14b8a6"),
        ]
        tags = []
        for name, color in tag_data:
            t = Tag(tenant_id=tenant_id, name=name, slug=name.lower().replace(" ", "-"), color=color,
                   created_by=user_id, updated_by=user_id)
            db.add(t)
            tags.append(t)
        await db.flush()

        # ── 4. Leads (100) ─────────────────────────────────────────
        print("  → Creating 100 leads...")
        lead_status_weights = {"new": 20, "contacted": 20, "qualified": 25, "nurturing": 10, "converted": 15, "lost": 10}
        status_choices = []
        for s, w in lead_status_weights.items():
            status_choices.extend([s] * w)

        leads = []
        for i in range(100):
            fn = random.choice(FIRST_NAMES)
            ln = random.choice(LAST_NAMES)
            company = random.choice(COMPANIES)
            domain = random.choice(DOMAINS)
            status = random.choice(status_choices)
            source = random.choice(lead_sources)
            created_days_ago = random.randint(1, 180)
            revenue = random.choice([None, 50000, 100000, 250000, 500000, 1000000, 5000000])

            lead = Lead(
                tenant_id=tenant_id,
                title=random.choice(LEAD_TITLES),
                first_name=fn, last_name=ln,
                email=f"{fn.lower()}.{ln.lower()}@{domain}",
                phone=f"+1-{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}",
                company=company,
                source=source.slug if source else "website",
                status=status,
                source_id=source.id if source else None,
                industry_id=random.choice(industries).id,
                rating_id=random.choice(ratings).id,
                campaign_id=random.choice(campaigns).id if random.random() > 0.4 else None,
                territory_id=random.choice(territories).id,
                lead_score=random.randint(0, 100),
                website=f"https://{domain}" if random.random() > 0.5 else None,
                annual_revenue=Decimal(str(revenue)) if revenue else None,
                employee_count=random.choice([None, 10, 50, 100, 500, 1000, 5000]),
                assigned_to=user_id,
                last_activity_at=datetime.utcnow() - timedelta(days=random.randint(0, 30)),
                next_follow_up_at=datetime.utcnow() + timedelta(days=random.randint(1, 14)) if status in ("new", "contacted", "qualified") else None,
                created_at=datetime.utcnow() - timedelta(days=created_days_ago),
                created_by=user_id, updated_by=user_id,
            )
            db.add(lead)
            leads.append(lead)
        await db.flush()

        # ── 5. Contacts (60) ───────────────────────────────────────
        print("  → Creating 60 contacts...")
        contacts = []
        for i in range(60):
            fn = random.choice(FIRST_NAMES)
            ln = random.choice(LAST_NAMES)
            domain = random.choice(DOMAINS)
            contact = Contact(
                tenant_id=tenant_id,
                first_name=fn, last_name=ln,
                email=f"{fn.lower()}.{ln.lower()}@{domain}",
                phone=f"+1-{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}",
                company=random.choice(COMPANIES),
                job_title=random.choice(["CEO", "CTO", "VP Sales", "Director", "Manager", "Engineer", "Analyst"]),
                status="active" if random.random() > 0.15 else "inactive",
                department=random.choice(["Engineering", "Sales", "Marketing", "Finance", "Operations", "HR", None]),
                do_not_email=random.random() < 0.1,
                do_not_call=random.random() < 0.05,
                last_activity_at=datetime.utcnow() - timedelta(days=random.randint(0, 60)),
                created_at=datetime.utcnow() - timedelta(days=random.randint(1, 200)),
                created_by=user_id, updated_by=user_id,
            )
            db.add(contact)
            contacts.append(contact)
        await db.flush()

        # ── 6. Customers (30) ──────────────────────────────────────
        print("  → Creating 30 customers...")
        customers = []
        for i in range(30):
            company = COMPANIES[i] if i < len(COMPANIES) else random.choice(COMPANIES)
            domain = DOMAINS[i] if i < len(DOMAINS) else random.choice(DOMAINS)
            code = f"CUST-{i+1:04d}"
            cust = Customer(
                tenant_id=tenant_id,
                code=code, name=company,
                email=f"info@{domain}",
                phone=f"+1-{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}",
                type=random.choice(["company", "company", "company", "individual"]),
                status="active",
                industry_id=random.choice(industries).id,
                rating_id=random.choice(ratings).id,
                territory_id=random.choice(territories).id,
                annual_revenue=Decimal(str(random.choice([100000, 500000, 1000000, 5000000, 10000000]))),
                employee_count=random.choice([50, 100, 500, 1000, 5000, 10000]),
                account_manager_id=user_id,
                last_activity_at=datetime.utcnow() - timedelta(days=random.randint(0, 30)),
                created_at=datetime.utcnow() - timedelta(days=random.randint(30, 365)),
                created_by=user_id, updated_by=user_id,
            )
            db.add(cust)
            customers.append(cust)
        await db.flush()

        # ── 7. Opportunities (50) ──────────────────────────────────
        print("  → Creating 50 opportunities...")
        stage_weights = {"prospecting": 12, "qualification": 10, "proposal": 10, "negotiation": 8, "closed_won": 6, "closed_lost": 4}
        stage_prob = {"prospecting": 10, "qualification": 25, "proposal": 50, "negotiation": 75, "closed_won": 100, "closed_lost": 0}
        stage_choices = []
        for s, w in stage_weights.items():
            stage_choices.extend([s] * w)

        opportunities = []
        for i in range(50):
            stage = random.choice(stage_choices)
            expected = round(random.uniform(10000, 500000), 2)
            prob = stage_prob[stage]
            weighted = round(expected * prob / 100, 2)
            created_days_ago = random.randint(5, 150)

            code = await commit_number(db, tenant_id, "opportunity")
            opp = Opportunity(
                tenant_id=tenant_id,
                code=code,
                title=f"{random.choice(OPPORTUNITY_NAMES)} - {random.choice(COMPANIES)[:15]}",
                customer_id=random.choice(customers).id,
                contact_id=random.choice(contacts).id if random.random() > 0.3 else None,
                stage=stage,
                probability=prob,
                expected_amount=int(expected),
                weighted_amount=Decimal(str(weighted)),
                expected_close_date=date.today() + timedelta(days=random.randint(-30, 90)),
                assigned_to=user_id,
                campaign_id=random.choice(campaigns).id if random.random() > 0.5 else None,
                territory_id=random.choice(territories).id,
                lost_reason_id=random.choice(lost_reasons).id if stage == "closed_lost" else None,
                lost_reason_detail="Budget constraints and timing issues" if stage == "closed_lost" else None,
                won_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)) if stage == "closed_won" else None,
                lost_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)) if stage == "closed_lost" else None,
                last_activity_at=datetime.utcnow() - timedelta(days=random.randint(0, 20)),
                next_follow_up_at=datetime.utcnow() + timedelta(days=random.randint(1, 14)) if stage not in ("closed_won", "closed_lost") else None,
                created_at=datetime.utcnow() - timedelta(days=created_days_ago),
                created_by=user_id, updated_by=user_id,
            )
            db.add(opp)
            opportunities.append(opp)
        await db.flush()

        # ── 8. Activities (200) ────────────────────────────────────
        print("  → Creating 200 activities...")
        activity_type_slugs = ["call", "email", "meeting", "task", "note"]
        activity_statuses = ["pending", "completed", "completed", "completed"]
        outcomes = ["reached", "left_voicemail", "no_answer", "meeting_scheduled", None]

        for i in range(200):
            atype = random.choice(activity_type_slugs)
            status = random.choice(activity_statuses)
            days_ago = random.randint(0, 120)

            # Randomly attach to lead or opportunity
            if random.random() > 0.5 and leads:
                target_lead = random.choice(leads)
                act_type, act_id = "leads", target_lead.id
            elif opportunities:
                target_opp = random.choice(opportunities)
                act_type, act_id = "opportunities", target_opp.id
            else:
                act_type, act_id = "leads", leads[0].id

            activity = Activity(
                tenant_id=tenant_id,
                type=atype,
                subject=random.choice(ACTIVITY_SUBJECTS),
                description=f"Activity details for {atype} #{i+1}",
                status=status,
                due_at=datetime.utcnow() - timedelta(days=days_ago - 1) if status == "completed" else datetime.utcnow() + timedelta(days=random.randint(1, 14)),
                activitable_type=act_type,
                activitable_id=act_id,
                assigned_to=user_id,
                contact_id=random.choice(contacts).id if random.random() > 0.5 else None,
                outcome=random.choice(outcomes) if atype in ("call", "meeting") else None,
                created_at=datetime.utcnow() - timedelta(days=days_ago),
                created_by=user_id, updated_by=user_id,
            )
            db.add(activity)
        await db.flush()

        # ── 9. Notes (40) ─────────────────────────────────────────
        print("  → Creating 40 notes...")
        for i in range(40):
            entity_type = random.choice(["leads", "opportunities", "contacts", "customers"])
            if entity_type == "leads":
                entity_id = random.choice(leads).id
            elif entity_type == "opportunities":
                entity_id = random.choice(opportunities).id
            elif entity_type == "contacts":
                entity_id = random.choice(contacts).id
            else:
                entity_id = random.choice(customers).id

            note = Note(
                tenant_id=tenant_id,
                content=random.choice(NOTE_CONTENTS),
                entity_type=entity_type,
                entity_id=entity_id,
                is_pinned=random.random() < 0.2,
                created_at=datetime.utcnow() - timedelta(days=random.randint(0, 90)),
                created_by=user_id, updated_by=user_id,
            )
            db.add(note)
        await db.flush()

        # ── 10. Entity Tags (60) ──────────────────────────────────
        print("  → Tagging 60 entities...")
        seen_tags = set()
        tagged = 0
        attempts = 0
        while tagged < 60 and attempts < 200:
            attempts += 1
            tag = random.choice(tags)
            entity_type = random.choice(["leads", "opportunities", "contacts"])
            if entity_type == "leads":
                entity_id = random.choice(leads).id
            elif entity_type == "opportunities":
                entity_id = random.choice(opportunities).id
            else:
                entity_id = random.choice(contacts).id
            key = (tag.id, entity_type, entity_id)
            if key in seen_tags:
                continue
            seen_tags.add(key)
            et = EntityTag(tag_id=tag.id, entity_type=entity_type, entity_id=entity_id)
            db.add(et)
            tagged += 1

        # ── 11. Email Templates ───────────────────────────────────
        print("  → Creating email templates...")
        templates = [
            ("lead_assignment", "Lead Assignment", "New Lead Assigned: {{entity_title}}",
             "<h2>New Lead</h2><p>Hi {{assigned_to_name}},</p><p>A new lead <strong>{{entity_title}}</strong> has been assigned to you.</p>"),
            ("follow_up_reminder", "Follow Up Reminder", "Follow Up Due: {{entity_title}}",
             "<h2>Follow Up Reminder</h2><p>Hi {{assigned_to_name}},</p><p>Your follow-up for <strong>{{entity_title}}</strong> is due on {{follow_up_date}}.</p>"),
            ("stage_change", "Stage Change", "Opportunity Stage Changed: {{entity_title}}",
             "<h2>Stage Changed</h2><p>The opportunity <strong>{{entity_title}}</strong> has moved to <strong>{{new_stage}}</strong>.</p>"),
            ("deal_won", "Deal Won", "Deal Won: {{entity_title}}",
             "<h2>Congratulations!</h2><p>The deal <strong>{{entity_title}}</strong> has been won!</p>"),
            ("deal_lost", "Deal Lost", "Deal Lost: {{entity_title}}",
             "<h2>Deal Lost</h2><p>Unfortunately, <strong>{{entity_title}}</strong> was lost. Reason: {{lost_reason}}</p>"),
        ]
        for slug, name, subject, body in templates:
            tmpl = EmailTemplate(
                tenant_id=tenant_id, name=name, slug=slug,
                subject=subject, html_body=body, text_body=body.replace("<h2>", "").replace("</h2>", "\n").replace("<p>", "").replace("</p>", "\n").replace("<strong>", "").replace("</strong>", ""),
                category=slug, is_active=True,
                created_by=user_id, updated_by=user_id,
            )
            db.add(tmpl)

        # ── 12. Lead Scoring Rules ────────────────────────────────
        print("  → Creating lead scoring rules...")
        scoring_rules = [
            ("email", "is_set", None, 10, "demographic"),
            ("phone", "is_set", None, 5, "demographic"),
            ("company", "is_set", None, 10, "demographic"),
            ("annual_revenue", "greater_than", "100000", 20, "demographic"),
            ("annual_revenue", "greater_than", "1000000", 15, "demographic"),
            ("employee_count", "greater_than", "100", 10, "demographic"),
            ("website", "is_set", None, 5, "demographic"),
            ("rating_id", "is_set", None, 10, "behavioral"),
            ("campaign_id", "is_set", None, 5, "behavioral"),
            ("industry_id", "is_set", None, 5, "behavioral"),
        ]
        for field, op, value, score, category in scoring_rules:
            rule = LeadScoringRule(
                tenant_id=tenant_id, field=field, operator=op, value=value,
                score=score, category=category, is_active=True,
                created_by=user_id, updated_by=user_id,
            )
            db.add(rule)

        await db.commit()
        print("\n✅ CRM test data seeded successfully!")
        print(f"   - 15 industries, 3 ratings, {len(LOST_REASONS_DATA)} lost reasons, 5 competitors, 5 territories")
        print(f"   - 8 campaigns, 8 tags")
        print(f"   - 100 leads, 60 contacts, 30 customers, 50 opportunities")
        print(f"   - 200 activities, 40 notes, 60 entity tags")
        print(f"   - 5 email templates, 10 scoring rules")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_crm_test_data())
