"""Seed comprehensive Fortune 500 project management sample data.

Creates sample users + tenant if none exist, then seeds 18 Fortune 500 projects
with full data across all project management features.

Usage:
    cd backend
    python -m seeds.seed        # base data (countries, currencies, permissions) first
    python -m seeds.seed_projects
"""
import asyncio
import random
from datetime import date, datetime, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, text
from app.core.database import Base
from app.models import *  # noqa
from app.models.global_models import User, Tenant, TenantUser
from app.models.tenant_models import (
    ProjectCategory, TaskLabel, CostCategory, RiskCategory,
    OrganizationSettings, Role, UserRole, Permission, RolePermission,
)
from app.models.projects import (
    Project, Milestone, Task, TimeLog,
    TaskDependency, TaskChecklist, TaskLabelAssignment,
    TaskComment, TaskAttachment, TaskWatcher,
    ProjectMember, ProjectComment, ProjectAttachment,
    ProjectTemplate, ProjectPhase, ResourceAllocation, UserSkill,
    ProjectExpense, ProjectBudgetLine, BillingRate, ProjectInvoice,
    ProjectRisk, ProjectIssue, ChangeRequest, StatusReport, MeetingNote,
)
from app.core.security import get_password_hash
from app.services.numbering import DEFAULT_SERIES
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://erp_user:erp_password@postgres:5432/erp_db",
)

# ---------------------------------------------------------------------------
# Sample Users — Fortune 500 project team
# ---------------------------------------------------------------------------

SAMPLE_USERS = [
    {"name": "Sarah Mitchell", "email": "sarah.mitchell@acmecorp.com", "role": "admin"},
    {"name": "James Rodriguez", "email": "james.rodriguez@acmecorp.com", "role": "manager"},
    {"name": "Emily Chen", "email": "emily.chen@acmecorp.com", "role": "project-manager"},
    {"name": "Michael Thompson", "email": "michael.thompson@acmecorp.com", "role": "manager"},
    {"name": "Priya Sharma", "email": "priya.sharma@acmecorp.com", "role": "employee"},
    {"name": "David Kim", "email": "david.kim@acmecorp.com", "role": "employee"},
    {"name": "Lisa Wang", "email": "lisa.wang@acmecorp.com", "role": "employee"},
    {"name": "Robert Johnson", "email": "robert.johnson@acmecorp.com", "role": "employee"},
    {"name": "Amanda Foster", "email": "amanda.foster@acmecorp.com", "role": "employee"},
    {"name": "Carlos Martinez", "email": "carlos.martinez@acmecorp.com", "role": "employee"},
    {"name": "Jennifer Lee", "email": "jennifer.lee@acmecorp.com", "role": "employee"},
    {"name": "Daniel Brown", "email": "daniel.brown@acmecorp.com", "role": "employee"},
]

DEFAULT_PASSWORD = "Password123!"  # All sample users share this password
TENANT_NAME = "Acme Corporation"

# ---------------------------------------------------------------------------
# Master Data
# ---------------------------------------------------------------------------

PROJECT_CATEGORIES = [
    {"name": "Digital Transformation", "slug": "digital-transformation", "description": "Technology-driven business transformation", "color": "#3B82F6", "sort_order": 1},
    {"name": "Infrastructure", "slug": "infrastructure", "description": "IT and physical infrastructure projects", "color": "#6366F1", "sort_order": 2},
    {"name": "Product Development", "slug": "product-development", "description": "New product creation and launches", "color": "#8B5CF6", "sort_order": 3},
    {"name": "Operations", "slug": "operations", "description": "Operational improvement and optimization", "color": "#EC4899", "sort_order": 4},
    {"name": "Compliance & Audit", "slug": "compliance-audit", "description": "Regulatory compliance and audit", "color": "#F59E0B", "sort_order": 5},
    {"name": "Marketing", "slug": "marketing", "description": "Marketing campaigns and brand initiatives", "color": "#10B981", "sort_order": 6},
    {"name": "M&A Integration", "slug": "ma-integration", "description": "Mergers and acquisitions integration", "color": "#EF4444", "sort_order": 7},
    {"name": "Research", "slug": "research", "description": "Research and development", "color": "#06B6D4", "sort_order": 8},
    {"name": "Customer Experience", "slug": "customer-experience", "description": "Customer-facing improvements", "color": "#84CC16", "sort_order": 9},
    {"name": "Security", "slug": "security", "description": "Cybersecurity and data protection", "color": "#F97316", "sort_order": 10},
]

TASK_LABELS = [
    {"name": "Bug", "slug": "bug", "color": "#EF4444", "sort_order": 1},
    {"name": "Enhancement", "slug": "enhancement", "color": "#3B82F6", "sort_order": 2},
    {"name": "Documentation", "slug": "documentation", "color": "#8B5CF6", "sort_order": 3},
    {"name": "Research", "slug": "research", "color": "#06B6D4", "sort_order": 4},
    {"name": "Design", "slug": "design", "color": "#EC4899", "sort_order": 5},
    {"name": "Development", "slug": "development", "color": "#10B981", "sort_order": 6},
    {"name": "Testing", "slug": "testing", "color": "#F59E0B", "sort_order": 7},
    {"name": "Deployment", "slug": "deployment", "color": "#6366F1", "sort_order": 8},
    {"name": "Urgent", "slug": "urgent", "color": "#DC2626", "sort_order": 9},
    {"name": "Blocked", "slug": "blocked", "color": "#991B1B", "sort_order": 10},
    {"name": "Performance", "slug": "performance", "color": "#F97316", "sort_order": 11},
    {"name": "Security", "slug": "security-label", "color": "#B91C1C", "sort_order": 12},
]

COST_CATEGORIES = [
    {"name": "Labor", "slug": "labor", "sort_order": 1},
    {"name": "Software Licenses", "slug": "software-licenses", "sort_order": 2},
    {"name": "Hardware", "slug": "hardware", "sort_order": 3},
    {"name": "Cloud Infrastructure", "slug": "cloud-infrastructure", "sort_order": 4},
    {"name": "Consulting", "slug": "consulting", "sort_order": 5},
    {"name": "Training", "slug": "training", "sort_order": 6},
    {"name": "Travel", "slug": "travel", "sort_order": 7},
    {"name": "Facilities", "slug": "facilities", "sort_order": 8},
    {"name": "Contingency", "slug": "contingency", "sort_order": 9},
    {"name": "Vendor Services", "slug": "vendor-services", "sort_order": 10},
]

RISK_CATEGORIES = [
    {"name": "Technical", "slug": "technical", "sort_order": 1},
    {"name": "Resource", "slug": "resource", "sort_order": 2},
    {"name": "Schedule", "slug": "schedule", "sort_order": 3},
    {"name": "Budget", "slug": "budget", "sort_order": 4},
    {"name": "Scope", "slug": "scope", "sort_order": 5},
    {"name": "Compliance", "slug": "compliance", "sort_order": 6},
    {"name": "Vendor", "slug": "vendor", "sort_order": 7},
    {"name": "Security", "slug": "security-risk", "sort_order": 8},
    {"name": "Organizational", "slug": "organizational", "sort_order": 9},
    {"name": "External", "slug": "external", "sort_order": 10},
]

# ---------------------------------------------------------------------------
# Fortune 500 Projects
# ---------------------------------------------------------------------------

PROJECTS_DATA = [
    {
        "name": "Enterprise ERP Migration",
        "code": "PRJ-0001",
        "description": "Complete migration from legacy SAP R/3 to cloud-native ERP platform. Covers finance, supply chain, HR, and manufacturing modules across 47 global locations.",
        "status": "active",
        "priority": "critical",
        "billing_type": "time_material",
        "budget": 12500000,
        "progress": 42,
        "category_slug": "digital-transformation",
        "days_offset": -120,
        "duration": 365,
    },
    {
        "name": "Cloud Infrastructure Modernization",
        "code": "PRJ-0002",
        "description": "Migrate on-premise data centers to multi-cloud AWS/Azure architecture. Includes containerization of 300+ microservices, CI/CD pipeline modernization, and zero-downtime migration strategy.",
        "status": "active",
        "priority": "high",
        "billing_type": "fixed",
        "budget": 8750000,
        "progress": 65,
        "category_slug": "infrastructure",
        "days_offset": -180,
        "duration": 270,
    },
    {
        "name": "Customer Portal Redesign",
        "code": "PRJ-0003",
        "description": "Complete redesign of B2B customer portal with self-service capabilities, real-time order tracking, AI-powered product recommendations, and integrated support chat.",
        "status": "active",
        "priority": "high",
        "billing_type": "fixed",
        "budget": 3200000,
        "progress": 78,
        "category_slug": "customer-experience",
        "days_offset": -200,
        "duration": 240,
    },
    {
        "name": "AI/ML Analytics Platform",
        "code": "PRJ-0004",
        "description": "Build enterprise AI/ML platform for predictive analytics, demand forecasting, fraud detection, and customer churn prediction. Includes data lake, feature store, and MLOps pipeline.",
        "status": "active",
        "priority": "high",
        "billing_type": "time_material",
        "budget": 6500000,
        "progress": 35,
        "category_slug": "research",
        "days_offset": -90,
        "duration": 300,
    },
    {
        "name": "Global Compliance Audit 2026",
        "code": "PRJ-0005",
        "description": "Annual compliance audit covering SOX, GDPR, HIPAA, PCI-DSS across all business units. Includes gap analysis, remediation tracking, and regulatory filing preparation.",
        "status": "active",
        "priority": "critical",
        "billing_type": "retainer",
        "budget": 2100000,
        "progress": 55,
        "category_slug": "compliance-audit",
        "days_offset": -150,
        "duration": 180,
    },
    {
        "name": "Mobile App v3.0 Launch",
        "code": "PRJ-0006",
        "description": "Major release of flagship mobile app with biometric auth, offline mode, AR product visualization, and redesigned UX based on 50K+ user feedback surveys.",
        "status": "active",
        "priority": "high",
        "billing_type": "fixed",
        "budget": 4800000,
        "progress": 60,
        "category_slug": "product-development",
        "days_offset": -160,
        "duration": 210,
    },
    {
        "name": "Supply Chain Optimization",
        "code": "PRJ-0007",
        "description": "End-to-end supply chain digitization: IoT sensor integration in warehouses, real-time inventory visibility, AI-driven demand planning, and automated procurement workflows.",
        "status": "active",
        "priority": "medium",
        "billing_type": "time_material",
        "budget": 5600000,
        "progress": 28,
        "category_slug": "operations",
        "days_offset": -75,
        "duration": 330,
    },
    {
        "name": "Cybersecurity Enhancement Program",
        "code": "PRJ-0008",
        "description": "Zero-trust security architecture implementation. Covers identity management overhaul, SIEM upgrade, endpoint protection, network segmentation, and security awareness training for 15K employees.",
        "status": "active",
        "priority": "critical",
        "billing_type": "time_material",
        "budget": 7200000,
        "progress": 45,
        "category_slug": "security",
        "days_offset": -100,
        "duration": 280,
    },
    {
        "name": "Data Warehouse Consolidation",
        "code": "PRJ-0009",
        "description": "Consolidate 12 legacy data warehouses into unified Snowflake-based analytics platform. Includes data governance framework, master data management, and self-service BI rollout.",
        "status": "active",
        "priority": "medium",
        "billing_type": "fixed",
        "budget": 4200000,
        "progress": 72,
        "category_slug": "digital-transformation",
        "days_offset": -210,
        "duration": 300,
    },
    {
        "name": "Global Marketing Campaign Q2",
        "code": "PRJ-0010",
        "description": "Multi-channel marketing campaign across 28 countries. Digital advertising, influencer partnerships, trade shows, product launch events, and brand refresh initiative.",
        "status": "active",
        "priority": "medium",
        "billing_type": "fixed",
        "budget": 15000000,
        "progress": 40,
        "category_slug": "marketing",
        "days_offset": -60,
        "duration": 120,
    },
    {
        "name": "Meridian Corp Acquisition Integration",
        "code": "PRJ-0011",
        "description": "Post-merger integration of Meridian Corp ($2.3B acquisition). Covers organizational restructuring, system consolidation, culture alignment, and synergy realization across 8,000 employees.",
        "status": "active",
        "priority": "critical",
        "billing_type": "internal",
        "budget": 18000000,
        "progress": 22,
        "category_slug": "ma-integration",
        "days_offset": -45,
        "duration": 540,
    },
    {
        "name": "Office Relocation - HQ Tower",
        "code": "PRJ-0012",
        "description": "Relocation of corporate headquarters to new 45-floor tower. Includes IT infrastructure buildout, furniture procurement, employee transition planning, and legacy site decommissioning.",
        "status": "planning",
        "priority": "medium",
        "billing_type": "internal",
        "budget": 22000000,
        "progress": 8,
        "category_slug": "operations",
        "days_offset": 30,
        "duration": 420,
    },
    {
        "name": "API Gateway & Developer Portal",
        "code": "PRJ-0013",
        "description": "Build enterprise API gateway with rate limiting, analytics, and monetization. Includes developer portal with SDK generation, sandbox environments, and partner onboarding workflow.",
        "status": "active",
        "priority": "medium",
        "billing_type": "time_material",
        "budget": 2800000,
        "progress": 50,
        "category_slug": "product-development",
        "days_offset": -130,
        "duration": 200,
    },
    {
        "name": "HR Digital Transformation",
        "code": "PRJ-0014",
        "description": "Modernize HR operations: Workday implementation, AI-powered recruitment, learning management system, employee experience platform, and people analytics dashboard.",
        "status": "active",
        "priority": "high",
        "billing_type": "fixed",
        "budget": 5100000,
        "progress": 38,
        "category_slug": "digital-transformation",
        "days_offset": -110,
        "duration": 300,
    },
    {
        "name": "Sustainability & ESG Reporting Platform",
        "code": "PRJ-0015",
        "description": "Build ESG data collection, carbon footprint tracking, sustainability reporting, and GRI/SASB compliance platform. Integrates with supply chain and operations data.",
        "status": "active",
        "priority": "high",
        "billing_type": "fixed",
        "budget": 3400000,
        "progress": 30,
        "category_slug": "compliance-audit",
        "days_offset": -80,
        "duration": 240,
    },
    {
        "name": "IoT Smart Factory Phase 2",
        "code": "PRJ-0016",
        "description": "Expand IoT deployment to 5 additional manufacturing plants. Predictive maintenance, digital twin simulation, automated quality inspection, and real-time production dashboards.",
        "status": "on_hold",
        "priority": "medium",
        "billing_type": "time_material",
        "budget": 9800000,
        "progress": 15,
        "category_slug": "infrastructure",
        "days_offset": -40,
        "duration": 365,
    },
    {
        "name": "Payment Gateway Integration",
        "code": "PRJ-0017",
        "description": "Integrate multi-currency payment processing with Stripe, Adyen, and local payment methods across 35+ countries. PCI-DSS compliance, fraud detection, and settlement reconciliation.",
        "status": "completed",
        "priority": "high",
        "billing_type": "fixed",
        "budget": 1800000,
        "progress": 100,
        "category_slug": "product-development",
        "days_offset": -300,
        "duration": 150,
    },
    {
        "name": "Knowledge Management System",
        "code": "PRJ-0018",
        "description": "Enterprise knowledge base with AI search, document management, wiki system, expert directory, and lessons-learned repository. Integration with Teams, Slack, and Confluence.",
        "status": "active",
        "priority": "low",
        "billing_type": "internal",
        "budget": 1200000,
        "progress": 55,
        "category_slug": "operations",
        "days_offset": -140,
        "duration": 180,
    },
]

# Milestones per project template (varies by project complexity)
MILESTONE_TEMPLATES = {
    "standard": [
        {"title": "Project Kickoff & Planning", "offset_pct": 0.0, "duration_pct": 0.08},
        {"title": "Requirements & Design", "offset_pct": 0.08, "duration_pct": 0.15},
        {"title": "Development Sprint 1", "offset_pct": 0.23, "duration_pct": 0.15},
        {"title": "Development Sprint 2", "offset_pct": 0.38, "duration_pct": 0.15},
        {"title": "Testing & QA", "offset_pct": 0.53, "duration_pct": 0.15},
        {"title": "UAT & Training", "offset_pct": 0.68, "duration_pct": 0.12},
        {"title": "Deployment & Go-Live", "offset_pct": 0.80, "duration_pct": 0.10},
        {"title": "Post-Launch Support", "offset_pct": 0.90, "duration_pct": 0.10},
    ],
    "complex": [
        {"title": "Discovery & Stakeholder Alignment", "offset_pct": 0.0, "duration_pct": 0.06},
        {"title": "Architecture & Technical Design", "offset_pct": 0.06, "duration_pct": 0.08},
        {"title": "Environment Setup & Infrastructure", "offset_pct": 0.14, "duration_pct": 0.06},
        {"title": "Core Development Phase 1", "offset_pct": 0.20, "duration_pct": 0.12},
        {"title": "Core Development Phase 2", "offset_pct": 0.32, "duration_pct": 0.12},
        {"title": "Integration & API Development", "offset_pct": 0.44, "duration_pct": 0.10},
        {"title": "Data Migration & Validation", "offset_pct": 0.54, "duration_pct": 0.10},
        {"title": "System Testing & Performance", "offset_pct": 0.64, "duration_pct": 0.08},
        {"title": "UAT & Change Management", "offset_pct": 0.72, "duration_pct": 0.10},
        {"title": "Pilot Deployment", "offset_pct": 0.82, "duration_pct": 0.08},
        {"title": "Full Rollout", "offset_pct": 0.90, "duration_pct": 0.05},
        {"title": "Hypercare & Optimization", "offset_pct": 0.95, "duration_pct": 0.05},
    ],
}

TASK_TEMPLATES = [
    # Per milestone, we generate tasks from these templates
    {
        "milestone_idx": 0,
        "tasks": [
            {"title": "Stakeholder interviews and requirements gathering", "priority": "high", "hours": 40},
            {"title": "Create project charter document", "priority": "high", "hours": 16},
            {"title": "Define project scope and objectives", "priority": "high", "hours": 24},
            {"title": "Identify project risks and constraints", "priority": "medium", "hours": 16},
            {"title": "Set up project management tools and repositories", "priority": "medium", "hours": 8},
            {"title": "Kickoff meeting with all stakeholders", "priority": "high", "hours": 4},
        ],
    },
    {
        "milestone_idx": 1,
        "tasks": [
            {"title": "Document functional requirements", "priority": "high", "hours": 32},
            {"title": "Technical architecture design", "priority": "critical", "hours": 40},
            {"title": "Create wireframes and UI mockups", "priority": "high", "hours": 48},
            {"title": "API specification and contracts", "priority": "high", "hours": 24},
            {"title": "Database schema design", "priority": "high", "hours": 20},
            {"title": "Security requirements analysis", "priority": "critical", "hours": 16},
            {"title": "Performance requirements specification", "priority": "medium", "hours": 12},
            {"title": "Design review and sign-off", "priority": "high", "hours": 8},
        ],
    },
    {
        "milestone_idx": 2,
        "tasks": [
            {"title": "Set up development environment", "priority": "high", "hours": 16},
            {"title": "Implement user authentication module", "priority": "critical", "hours": 40},
            {"title": "Build core data models and migrations", "priority": "high", "hours": 32},
            {"title": "Develop REST API endpoints", "priority": "high", "hours": 48},
            {"title": "Frontend component library setup", "priority": "medium", "hours": 24},
            {"title": "Implement dashboard views", "priority": "medium", "hours": 36},
            {"title": "Write unit tests for core modules", "priority": "high", "hours": 20},
            {"title": "Code review and refactoring", "priority": "medium", "hours": 12},
        ],
    },
    {
        "milestone_idx": 3,
        "tasks": [
            {"title": "Implement reporting and analytics module", "priority": "high", "hours": 40},
            {"title": "Build notification and alerting system", "priority": "medium", "hours": 24},
            {"title": "Develop data import/export functionality", "priority": "medium", "hours": 32},
            {"title": "Implement workflow automation engine", "priority": "high", "hours": 48},
            {"title": "Third-party API integrations", "priority": "high", "hours": 36},
            {"title": "Mobile responsive optimization", "priority": "medium", "hours": 20},
            {"title": "Accessibility compliance (WCAG 2.1)", "priority": "high", "hours": 16},
        ],
    },
    {
        "milestone_idx": 4,
        "tasks": [
            {"title": "Integration testing", "priority": "high", "hours": 32},
            {"title": "Performance load testing", "priority": "high", "hours": 24},
            {"title": "Security penetration testing", "priority": "critical", "hours": 40},
            {"title": "Cross-browser compatibility testing", "priority": "medium", "hours": 16},
            {"title": "Bug triage and fix cycle 1", "priority": "high", "hours": 40},
            {"title": "Bug triage and fix cycle 2", "priority": "high", "hours": 24},
            {"title": "Regression testing", "priority": "high", "hours": 20},
        ],
    },
    {
        "milestone_idx": 5,
        "tasks": [
            {"title": "User acceptance testing preparation", "priority": "high", "hours": 16},
            {"title": "Conduct UAT sessions with business users", "priority": "critical", "hours": 40},
            {"title": "UAT defect resolution", "priority": "high", "hours": 32},
            {"title": "Create training materials and guides", "priority": "high", "hours": 24},
            {"title": "Conduct training sessions", "priority": "high", "hours": 20},
            {"title": "UAT sign-off", "priority": "critical", "hours": 4},
        ],
    },
    {
        "milestone_idx": 6,
        "tasks": [
            {"title": "Production environment setup", "priority": "critical", "hours": 24},
            {"title": "Data migration execution", "priority": "critical", "hours": 40},
            {"title": "Deployment runbook creation", "priority": "high", "hours": 12},
            {"title": "Go-live deployment", "priority": "critical", "hours": 16},
            {"title": "Post-deployment validation", "priority": "critical", "hours": 8},
            {"title": "Rollback plan testing", "priority": "high", "hours": 8},
        ],
    },
    {
        "milestone_idx": 7,
        "tasks": [
            {"title": "Monitor production metrics", "priority": "high", "hours": 40},
            {"title": "Address critical production issues", "priority": "critical", "hours": 32},
            {"title": "Performance optimization tuning", "priority": "medium", "hours": 24},
            {"title": "Knowledge transfer to ops team", "priority": "high", "hours": 16},
            {"title": "Project retrospective and lessons learned", "priority": "medium", "hours": 8},
            {"title": "Final project documentation", "priority": "medium", "hours": 16},
        ],
    },
]

CHECKLIST_ITEMS = [
    ["Define acceptance criteria", "Identify test scenarios", "Review with product owner", "Get stakeholder approval"],
    ["Write test cases", "Execute test cases", "Log defects", "Retest fixed defects", "Sign off"],
    ["Update documentation", "Code review completed", "Merge to main branch"],
    ["Create deployment plan", "Notify stakeholders", "Verify backup", "Execute deployment", "Smoke test"],
    ["Research best practices", "Prototype solution", "Peer review", "Finalize approach"],
]

COMMENT_BODIES = [
    "Made good progress on this today. The main logic is implemented, need to add error handling.",
    "Blocked on this — waiting for API access credentials from the vendor.",
    "Updated the design based on feedback from the UX review. Much cleaner now.",
    "This is more complex than estimated. Requesting 16 additional hours.",
    "Completed the initial implementation. Ready for code review.",
    "Found a critical edge case during testing. Working on a fix.",
    "Deployed to staging for QA verification. Test credentials shared in Slack.",
    "Meeting notes: stakeholders approved the revised timeline. See attached.",
    "Performance benchmarks look good — 200ms avg response time under load.",
    "Security scan passed with no critical findings. 2 medium issues to address.",
    "Updated the API docs to reflect the latest changes. Please review.",
    "Data migration dry run completed successfully. 2.3M records in 47 minutes.",
    "The integration with Salesforce is working in sandbox. Moving to production testing.",
    "Ran into a compatibility issue with the legacy system. Exploring workarounds.",
    "Sprint demo went well. Product owner signed off on all stories.",
    "Need to refactor the notification service — current approach won't scale beyond 10K concurrent users.",
    "CI/CD pipeline is green. All 847 tests passing.",
    "Client feedback: love the new dashboard but requesting a dark mode option.",
    "Vendor confirmed the API rate limit increase to 10K requests/min.",
    "Risk mitigation plan updated. See the updated risk register for details.",
]

PHASE_TEMPLATES = [
    {"name": "Initiation", "color": "#3B82F6", "sort_order": 1},
    {"name": "Planning", "color": "#8B5CF6", "sort_order": 2},
    {"name": "Execution", "color": "#10B981", "sort_order": 3},
    {"name": "Monitoring & Control", "color": "#F59E0B", "sort_order": 4},
    {"name": "Closure", "color": "#EF4444", "sort_order": 5},
]

RISK_TEMPLATES = [
    {"title": "Key resource departure", "description": "Critical team members may leave during the project, causing knowledge loss and delays.", "probability": "medium", "impact": "high", "category_slug": "resource", "mitigation": "Cross-train team members. Document all tribal knowledge. Maintain a talent pipeline for critical roles."},
    {"title": "Scope creep from stakeholders", "description": "Stakeholders may continuously add requirements beyond the agreed scope.", "probability": "high", "impact": "high", "category_slug": "scope", "mitigation": "Strict change request process. Weekly scope review meetings. Clear acceptance criteria for each deliverable."},
    {"title": "Technology integration failures", "description": "Third-party systems may not integrate as expected, requiring additional development.", "probability": "medium", "impact": "high", "category_slug": "technical", "mitigation": "Early POC for all integrations. Maintain fallback options. Vendor SLA enforcement."},
    {"title": "Budget overrun due to unforeseen complexity", "description": "Hidden complexity in legacy systems may increase effort and cost significantly.", "probability": "medium", "impact": "critical", "category_slug": "budget", "mitigation": "20% contingency budget. Phased delivery to control costs. Weekly burn rate monitoring."},
    {"title": "Schedule delay from vendor dependencies", "description": "External vendor deliverables may be late, blocking project progress.", "probability": "high", "impact": "medium", "category_slug": "vendor", "mitigation": "Buffer time in schedule. Penalty clauses in contracts. Alternative vendor identification."},
    {"title": "Data security breach during migration", "description": "Sensitive data may be exposed during migration between systems.", "probability": "low", "impact": "critical", "category_slug": "security-risk", "mitigation": "Encryption in transit and at rest. Access controls. Audit logging. Penetration testing."},
    {"title": "Regulatory changes affecting requirements", "description": "New regulations may require rework of completed features.", "probability": "low", "impact": "high", "category_slug": "compliance", "mitigation": "Regulatory monitoring. Flexible architecture. Legal team involvement in design reviews."},
    {"title": "Poor user adoption post-launch", "description": "End users may resist the new system, reducing ROI.", "probability": "medium", "impact": "high", "category_slug": "organizational", "mitigation": "Change management program. Training sessions. Champions network. Feedback loops."},
]

ISSUE_TEMPLATES = [
    {"title": "API response times exceeding SLA", "priority": "high", "status": "open", "description": "Several API endpoints are responding in >2s under load, exceeding the 500ms SLA."},
    {"title": "Missing accessibility features in dashboard", "priority": "medium", "status": "in_progress", "description": "Screen reader compatibility issues found during accessibility audit."},
    {"title": "Legacy data format incompatibility", "priority": "high", "status": "resolved", "description": "Date formats from legacy system cause parsing errors in the new system.", "resolution": "Implemented data transformation layer with format detection."},
    {"title": "SSO integration timeout on high traffic", "priority": "critical", "status": "open", "description": "Keycloak SSO times out when concurrent users exceed 500."},
    {"title": "Mobile app crash on Android 12", "priority": "high", "status": "in_progress", "description": "App crashes on certain Android 12 devices during biometric authentication."},
]

CHANGE_REQUEST_TEMPLATES = [
    {"title": "Add multi-language support to customer portal", "description": "Localization for 12 additional languages requested by international business unit.", "reason": "Expansion into new markets requires local language support.", "budget_impact": 180000, "schedule_impact_days": 30, "priority": "high", "status": "approved"},
    {"title": "Integrate with new payment processor", "description": "Replace current payment processor with Adyen for better coverage in APAC region.", "reason": "Current processor doesn't support local payment methods in 5 key markets.", "budget_impact": 95000, "schedule_impact_days": 15, "priority": "medium", "status": "submitted"},
    {"title": "Add real-time collaboration features", "description": "WebSocket-based real-time editing and commenting on documents.", "reason": "Competitive analysis shows this as a must-have feature.", "budget_impact": 250000, "schedule_impact_days": 45, "priority": "medium", "status": "under_review"},
]

MEETING_TEMPLATES = [
    {"title": "Weekly Status Review", "agenda": "1. Progress update\n2. Blockers and risks\n3. Upcoming milestones\n4. Resource allocation\n5. Action items"},
    {"title": "Sprint Planning", "agenda": "1. Sprint goal\n2. Backlog grooming\n3. Capacity planning\n4. Sprint commitment\n5. Q&A"},
    {"title": "Architecture Review Board", "agenda": "1. Design proposals\n2. Technical debt review\n3. Security considerations\n4. Performance benchmarks\n5. Decision log"},
    {"title": "Stakeholder Steering Committee", "agenda": "1. Executive summary\n2. Budget and timeline\n3. Key decisions needed\n4. Risk escalations\n5. Next steps"},
]


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def random_date_between(start: date, end: date) -> date:
    delta = (end - start).days
    if delta <= 0:
        return start
    return start + timedelta(days=random.randint(0, delta))


def pick_status_for_progress(progress: int) -> str:
    if progress >= 100:
        return "done"
    if progress >= 50:
        return random.choice(["in_progress", "in_progress", "review"])
    if progress > 0:
        return random.choice(["in_progress", "todo"])
    return "todo"


PROB_MAP = {"very_low": 1, "low": 2, "medium": 3, "high": 4, "very_high": 5}
IMPACT_MAP = {"very_low": 1, "low": 2, "medium": 3, "high": 4, "critical": 5}


# ---------------------------------------------------------------------------
# Main seed function
# ---------------------------------------------------------------------------

async def seed_project_data():
    engine = create_async_engine(DATABASE_URL)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # Check if project data already exists
        existing = await db.execute(select(Project).limit(1))
        if existing.scalar_one_or_none():
            print("Project data already exists. Skipping project seed.")
            await engine.dispose()
            return

        # --- Create or find users + tenant ---
        user_result = await db.execute(select(User).limit(1))
        existing_user = user_result.scalar_one_or_none()

        if existing_user:
            # Use existing tenant
            tenant_id = existing_user.current_tenant_id
            # Fetch all users for this tenant
            tu_result = await db.execute(
                select(TenantUser.user_id).where(TenantUser.tenant_id == tenant_id)
            )
            user_ids = [r[0] for r in tu_result.all()]
            creator_id = existing_user.id
            print(f"Using existing tenant {tenant_id} with {len(user_ids)} users")
        else:
            # Create tenant + sample users from scratch
            print(f"Creating sample users and tenant '{TENANT_NAME}'...")
            password_hash = get_password_hash(DEFAULT_PASSWORD)

            # Create first user (owner)
            owner_data = SAMPLE_USERS[0]
            owner = User(
                name=owner_data["name"],
                email=owner_data["email"],
                password_hash=password_hash,
            )
            db.add(owner)
            await db.flush()

            # Create tenant
            tenant = Tenant(
                owner_id=owner.id,
                name=TENANT_NAME,
                personal_tenant=False,
            )
            db.add(tenant)
            await db.flush()

            tenant_id = tenant.id
            owner.current_tenant_id = tenant_id

            # Link owner to tenant
            db.add(TenantUser(tenant_id=tenant_id, user_id=owner.id, role="admin"))

            # Create org settings with numbering series
            db.add(OrganizationSettings(
                tenant_id=tenant_id,
                name=TENANT_NAME,
                number_series=DEFAULT_SERIES,
                created_by=owner.id,
                updated_by=owner.id,
            ))
            await db.flush()

            # Create default roles and assign permissions
            perm_result = await db.execute(select(Permission))
            all_permissions = perm_result.scalars().all()

            from app.api.v1.endpoints.auth import DEFAULT_ROLES
            roles_map = {}
            for role_def in DEFAULT_ROLES:
                role = Role(
                    tenant_id=tenant_id,
                    name=role_def["name"],
                    slug=role_def["slug"],
                    description=role_def["description"],
                    is_system=role_def.get("is_system", False),
                    created_by=owner.id,
                    updated_by=owner.id,
                )
                db.add(role)
                await db.flush()

                role_perms = role_def["permissions"]
                role_resources = role_def.get("resources")
                matched = []
                if role_perms == "*":
                    matched = list(all_permissions)
                else:
                    for p in all_permissions:
                        parts = p.slug.rsplit(":", 1)
                        if len(parts) != 2:
                            continue
                        resource, action = parts
                        if action not in role_perms:
                            continue
                        if role_resources and resource not in role_resources:
                            continue
                        matched.append(p)

                for p in matched:
                    db.add(RolePermission(role_id=role.id, permission_id=p.id))
                roles_map[role_def["slug"]] = role

            # Assign admin role to owner
            if "admin" in roles_map:
                db.add(UserRole(user_id=owner.id, role_id=roles_map["admin"].id, tenant_id=tenant_id))

            await db.flush()

            # Create remaining sample users
            user_ids = [owner.id]
            for u_data in SAMPLE_USERS[1:]:
                user = User(
                    name=u_data["name"],
                    email=u_data["email"],
                    password_hash=password_hash,
                    current_tenant_id=tenant_id,
                )
                db.add(user)
                await db.flush()
                user_ids.append(user.id)

                db.add(TenantUser(tenant_id=tenant_id, user_id=user.id, role=u_data["role"]))
                # Assign role
                role_slug = u_data["role"]
                if role_slug in roles_map:
                    db.add(UserRole(user_id=user.id, role_id=roles_map[role_slug].id, tenant_id=tenant_id))

            creator_id = owner.id
            await db.flush()
            print(f"  Created {len(user_ids)} users, tenant '{TENANT_NAME}' (id={tenant_id})")
            print(f"  Login: {SAMPLE_USERS[0]['email']} / {DEFAULT_PASSWORD}")

        print(f"Seeding project data for tenant {tenant_id} with {len(user_ids)} users...")

        # ----- Master data -----
        cat_map = {}
        for cat in PROJECT_CATEGORIES:
            obj = ProjectCategory(tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                                  name=cat["name"], slug=cat["slug"], description=cat["description"],
                                  is_active=True, sort_order=cat["sort_order"])
            db.add(obj)
            await db.flush()
            cat_map[cat["slug"]] = obj.id

        label_map = {}
        for lbl in TASK_LABELS:
            obj = TaskLabel(tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                            name=lbl["name"], slug=lbl["slug"], color=lbl["color"],
                            is_active=True, sort_order=lbl["sort_order"])
            db.add(obj)
            await db.flush()
            label_map[lbl["slug"]] = obj.id

        cost_cat_map = {}
        for cc in COST_CATEGORIES:
            obj = CostCategory(tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                               name=cc["name"], slug=cc["slug"], is_active=True, sort_order=cc["sort_order"])
            db.add(obj)
            await db.flush()
            cost_cat_map[cc["slug"]] = obj.id

        risk_cat_map = {}
        for rc in RISK_CATEGORIES:
            obj = RiskCategory(tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                               name=rc["name"], slug=rc["slug"], is_active=True, sort_order=rc["sort_order"])
            db.add(obj)
            await db.flush()
            risk_cat_map[rc["slug"]] = obj.id

        print(f"  Created master data: {len(cat_map)} categories, {len(label_map)} labels, {len(cost_cat_map)} cost categories, {len(risk_cat_map)} risk categories")

        await db.flush()

        # ----- Projects -----
        today = date.today()
        project_ids = []
        project_objs = []
        label_ids = list(label_map.values())

        for pd in PROJECTS_DATA:
            start = today + timedelta(days=pd["days_offset"])
            end = start + timedelta(days=pd["duration"])
            actual_cost = Decimal(str(pd["budget"])) * Decimal(str(pd["progress"])) / Decimal("100") * Decimal(str(random.uniform(0.85, 1.15)))

            proj = Project(
                tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                name=pd["name"], code=pd["code"], description=pd["description"],
                start_date=start, end_date=end,
                budget=Decimal(str(pd["budget"])),
                status=pd["status"], progress=pd["progress"],
                manager_id=random.choice(user_ids),
                priority=pd["priority"],
                billing_type=pd["billing_type"],
                category_id=cat_map.get(pd["category_slug"]),
                actual_cost=round(actual_cost, 2),
                total_hours=Decimal(str(random.randint(200, 8000))),
            )
            db.add(proj)
            await db.flush()
            project_ids.append(proj.id)
            project_objs.append((proj, pd))

        print(f"  Created {len(project_ids)} projects")

        # ----- Phases for each project -----
        phase_id_map = {}  # project_id -> [phase_ids]
        for proj, pd in project_objs:
            proj_start = proj.start_date
            proj_dur = pd["duration"]
            phase_ids = []
            for pt in PHASE_TEMPLATES:
                idx = pt["sort_order"] - 1
                pct_start = idx * 0.2
                pct_dur = 0.25
                p_start = proj_start + timedelta(days=int(proj_dur * pct_start))
                p_end = proj_start + timedelta(days=int(proj_dur * min(pct_start + pct_dur, 1.0)))
                status = "completed" if pd["progress"] > (idx + 1) * 20 else ("active" if pd["progress"] > idx * 20 else "pending")
                phase = ProjectPhase(
                    tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                    project_id=proj.id, name=pt["name"], color=pt["color"],
                    start_date=p_start, end_date=p_end,
                    status=status, sort_order=pt["sort_order"],
                )
                db.add(phase)
                await db.flush()
                phase_ids.append(phase.id)
            phase_id_map[proj.id] = phase_ids

        print(f"  Created {len(project_ids) * len(PHASE_TEMPLATES)} project phases")

        # ----- Milestones -----
        milestone_map = {}  # project_id -> [(milestone_id, start, end)]
        for proj, pd in project_objs:
            proj_start = proj.start_date
            proj_dur = pd["duration"]
            template = MILESTONE_TEMPLATES["complex"] if pd["budget"] > 5000000 else MILESTONE_TEMPLATES["standard"]
            ms_list = []
            for i, mt in enumerate(template):
                ms_start = proj_start + timedelta(days=int(proj_dur * mt["offset_pct"]))
                ms_end = ms_start + timedelta(days=int(proj_dur * mt["duration_pct"]))
                ms_progress = min(100, max(0, int((pd["progress"] - mt["offset_pct"] * 100) / (mt["duration_pct"] * 100) * 100)))
                ms_progress = max(0, min(100, ms_progress))
                ms_status = "completed" if ms_progress >= 100 else ("in_progress" if ms_progress > 0 else "pending")
                is_billing = i in [2, 4, 6] and pd["billing_type"] != "internal"
                billing_amt = Decimal(str(pd["budget"])) / Decimal(str(len(template))) if is_billing else None

                ms = Milestone(
                    tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                    project_id=proj.id, title=mt["title"],
                    description=f"Milestone for {proj.name}: {mt['title']}",
                    due_date=ms_end, status=ms_status, sort_order=i,
                    progress=ms_progress,
                    completed_at=datetime.now() - timedelta(days=random.randint(1, 30)) if ms_status == "completed" else None,
                    is_billing_milestone=is_billing,
                    billing_amount=billing_amt,
                    billing_status="paid" if ms_status == "completed" and is_billing else ("billed" if ms_progress > 80 and is_billing else "unbilled"),
                )
                db.add(ms)
                await db.flush()
                ms_list.append((ms.id, ms_start, ms_end))
            milestone_map[proj.id] = ms_list

        total_milestones = sum(len(v) for v in milestone_map.values())
        print(f"  Created {total_milestones} milestones")

        # ----- Tasks -----
        all_task_ids = {}  # project_id -> [task_id]
        task_objects = []  # (task, proj, pd)
        statuses = ["todo", "in_progress", "review", "done"]

        for proj, pd in project_objs:
            ms_list = milestone_map[proj.id]
            phase_ids = phase_id_map.get(proj.id, [])
            proj_task_ids = []
            wbs_counter = {}

            for tmpl in TASK_TEMPLATES:
                ms_idx = tmpl["milestone_idx"]
                if ms_idx >= len(ms_list):
                    continue
                ms_id, ms_start, ms_end = ms_list[ms_idx]
                wbs_counter.setdefault(ms_idx, 0)

                for t in tmpl["tasks"]:
                    wbs_counter[ms_idx] += 1
                    wbs_code = f"{ms_idx + 1}.{wbs_counter[ms_idx]}"

                    # Determine task status based on project progress and milestone position
                    ms_progress_threshold = (ms_idx / max(len(ms_list) - 1, 1)) * 100
                    if pd["progress"] > ms_progress_threshold + 15:
                        status = "done"
                        task_progress = 100
                    elif pd["progress"] > ms_progress_threshold:
                        status = random.choice(["in_progress", "review", "done"])
                        task_progress = random.randint(40, 100)
                    elif pd["progress"] > ms_progress_threshold - 10:
                        status = random.choice(["todo", "in_progress"])
                        task_progress = random.randint(0, 40)
                    else:
                        status = "todo"
                        task_progress = 0

                    if status == "done":
                        task_progress = 100

                    task_start = random_date_between(ms_start, ms_start + timedelta(days=max(1, (ms_end - ms_start).days // 3)))
                    task_due = random_date_between(task_start + timedelta(days=3), ms_end)

                    phase_id = phase_ids[min(ms_idx // 2, len(phase_ids) - 1)] if phase_ids else None

                    task = Task(
                        tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                        project_id=proj.id, milestone_id=ms_id,
                        title=t["title"], description=f"Task for {proj.name}: {t['title']}",
                        assigned_to=random.choice(user_ids),
                        priority=t["priority"], status=status,
                        start_date=task_start, due_date=task_due,
                        estimated_hours=Decimal(str(t["hours"])),
                        actual_hours=Decimal(str(round(t["hours"] * random.uniform(0.6, 1.4), 1))) if status == "done" else None,
                        sort_order=wbs_counter[ms_idx],
                        wbs_code=wbs_code,
                        progress=task_progress,
                        phase_id=phase_id,
                        completed_at=datetime.now() - timedelta(days=random.randint(1, 60)) if status == "done" else None,
                    )
                    db.add(task)
                    await db.flush()
                    proj_task_ids.append(task.id)
                    task_objects.append((task, proj, pd))

            all_task_ids[proj.id] = proj_task_ids

        total_tasks = sum(len(v) for v in all_task_ids.values())
        print(f"  Created {total_tasks} tasks")

        # ----- Task Dependencies (create chains within milestones) -----
        dep_count = 0
        for proj, pd in project_objs:
            task_ids = all_task_ids.get(proj.id, [])
            # Create sequential dependencies within milestone groups
            for i in range(1, len(task_ids)):
                if random.random() < 0.4:  # 40% chance of dependency
                    dep = TaskDependency(
                        tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                        task_id=task_ids[i],
                        depends_on_task_id=task_ids[i - 1],
                        dependency_type=random.choice(["finish_to_start", "finish_to_start", "start_to_start"]),
                        lag_days=random.choice([0, 0, 0, 1, 2]),
                    )
                    db.add(dep)
                    dep_count += 1

        await db.flush()
        print(f"  Created {dep_count} task dependencies")

        # ----- Task Checklists -----
        checklist_count = 0
        for task, proj, pd in task_objects:
            if random.random() < 0.35:  # 35% of tasks get checklists
                items = random.choice(CHECKLIST_ITEMS)
                for j, item in enumerate(items):
                    is_done = task.status == "done" or (task.progress > 50 and random.random() < 0.6)
                    cl = TaskChecklist(
                        tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                        task_id=task.id, title=item,
                        is_completed=is_done,
                        completed_at=datetime.now() - timedelta(days=random.randint(1, 30)) if is_done else None,
                        completed_by=random.choice(user_ids) if is_done else None,
                        sort_order=j,
                    )
                    db.add(cl)
                    checklist_count += 1

        await db.flush()
        print(f"  Created {checklist_count} checklist items")

        # ----- Task Label Assignments -----
        label_assignment_count = 0
        for task, proj, pd in task_objects:
            if random.random() < 0.5:
                num_labels = random.randint(1, 3)
                chosen = random.sample(label_ids, min(num_labels, len(label_ids)))
                for lid in chosen:
                    db.add(TaskLabelAssignment(task_id=task.id, label_id=lid))
                    label_assignment_count += 1

        await db.flush()
        print(f"  Created {label_assignment_count} label assignments")

        # ----- Task Comments -----
        comment_count = 0
        for task, proj, pd in task_objects:
            if random.random() < 0.4:
                num_comments = random.randint(1, 4)
                for _ in range(num_comments):
                    tc = TaskComment(
                        tenant_id=tenant_id, created_by=random.choice(user_ids), updated_by=creator_id,
                        task_id=task.id,
                        body=random.choice(COMMENT_BODIES),
                        is_internal=random.random() < 0.2,
                    )
                    db.add(tc)
                    comment_count += 1

        await db.flush()
        print(f"  Created {comment_count} task comments")

        # ----- Task Watchers -----
        watcher_count = 0
        for task, proj, pd in task_objects:
            if random.random() < 0.3:
                watchers = random.sample(user_ids, min(random.randint(1, 3), len(user_ids)))
                for uid in watchers:
                    db.add(TaskWatcher(task_id=task.id, user_id=uid))
                    watcher_count += 1

        await db.flush()
        print(f"  Created {watcher_count} task watchers")

        # ----- Time Logs -----
        timelog_count = 0
        for task, proj, pd in task_objects:
            if task.status in ("in_progress", "review", "done"):
                num_logs = random.randint(1, 5)
                for _ in range(num_logs):
                    log_date = random_date_between(
                        task.start_date or proj.start_date,
                        min(today, task.due_date or today),
                    )
                    hours = Decimal(str(round(random.uniform(0.5, 8.0), 1)))
                    tl = TimeLog(
                        tenant_id=tenant_id, created_by=random.choice(user_ids), updated_by=creator_id,
                        task_id=task.id, project_id=proj.id,
                        user_id=task.assigned_to or random.choice(user_ids),
                        hours=hours, log_date=log_date,
                        description=f"Worked on: {task.title}",
                        is_billable=pd["billing_type"] != "internal" and random.random() < 0.8,
                    )
                    db.add(tl)
                    timelog_count += 1

        await db.flush()
        print(f"  Created {timelog_count} time logs")

        # ----- Project Members -----
        member_count = 0
        roles = ["manager", "lead", "member", "member", "member", "viewer"]
        for proj, pd in project_objs:
            num_members = random.randint(3, min(8, len(user_ids)))
            chosen_users = random.sample(user_ids, num_members)
            for i, uid in enumerate(chosen_users):
                pm = ProjectMember(
                    tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                    project_id=proj.id, user_id=uid,
                    role=roles[min(i, len(roles) - 1)],
                    billing_rate=Decimal(str(random.choice([75, 100, 125, 150, 175, 200, 250]))),
                )
                db.add(pm)
                member_count += 1

        await db.flush()
        print(f"  Created {member_count} project members")

        # ----- Project Comments (Activity Feed) -----
        proj_comment_count = 0
        activity_messages = [
            "Project status updated to active",
            "Budget revised based on Q2 forecast",
            "New team member added to the project",
            "Milestone completed ahead of schedule",
            "Risk assessment review completed",
            "Stakeholder feedback incorporated into scope",
            "Sprint velocity improved by 20%",
            "Integration testing completed successfully",
            "Change request CR-0001 approved by steering committee",
            "Weekly status report published",
        ]
        for proj, pd in project_objs:
            num_comments = random.randint(5, 15)
            for _ in range(num_comments):
                ctype = random.choice(["comment", "comment", "status_change", "system"])
                body = random.choice(COMMENT_BODIES) if ctype == "comment" else random.choice(activity_messages)
                pc = ProjectComment(
                    tenant_id=tenant_id, created_by=random.choice(user_ids), updated_by=creator_id,
                    project_id=proj.id, body=body, comment_type=ctype,
                )
                db.add(pc)
                proj_comment_count += 1

        await db.flush()
        print(f"  Created {proj_comment_count} project comments")

        # ----- Resource Allocations -----
        alloc_count = 0
        for proj, pd in project_objs:
            if pd["status"] == "active":
                num_allocs = random.randint(2, 5)
                for _ in range(num_allocs):
                    a_start = random_date_between(proj.start_date, today)
                    a_end = random_date_between(a_start + timedelta(days=30), proj.end_date or today + timedelta(days=180))
                    ra = ResourceAllocation(
                        tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                        project_id=proj.id, user_id=random.choice(user_ids),
                        start_date=a_start, end_date=a_end,
                        hours_per_day=Decimal(str(random.choice([4, 6, 8]))),
                        allocation_percent=random.choice([25, 50, 75, 100]),
                        role=random.choice(["Developer", "Architect", "QA Engineer", "Designer", "BA", "PM"]),
                    )
                    db.add(ra)
                    alloc_count += 1

        await db.flush()
        print(f"  Created {alloc_count} resource allocations")

        # ----- User Skills -----
        skill_count = 0
        skills_list = [
            "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js",
            "FastAPI", "Django", "PostgreSQL", "Redis", "Docker", "Kubernetes",
            "AWS", "Azure", "GCP", "CI/CD", "Agile/Scrum", "Project Management",
            "Data Analysis", "Machine Learning", "UI/UX Design", "SQL",
            "DevOps", "Security", "REST APIs", "GraphQL", "Microservices",
        ]
        for uid in user_ids:
            num_skills = random.randint(4, 10)
            chosen_skills = random.sample(skills_list, num_skills)
            for s in chosen_skills:
                us = UserSkill(
                    tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                    user_id=uid, skill_name=s,
                    proficiency=random.choice(["beginner", "intermediate", "advanced", "expert"]),
                )
                db.add(us)
                skill_count += 1

        await db.flush()
        print(f"  Created {skill_count} user skills")

        # ----- Project Expenses -----
        expense_count = 0
        expense_descs = [
            "AWS infrastructure charges", "Software license renewal", "Consulting fees - technical advisor",
            "Team offsite workshop", "Hardware procurement - dev servers", "Training course enrollment",
            "Travel - client site visit", "Cloud database hosting", "Security audit - external vendor",
            "UX research participant incentives", "Code signing certificates", "Load testing tool subscription",
        ]
        cost_cat_ids = list(cost_cat_map.values())
        for proj, pd in project_objs:
            if pd["billing_type"] != "internal":
                num_expenses = random.randint(5, 15)
                for _ in range(num_expenses):
                    exp_date = random_date_between(proj.start_date, min(today, proj.end_date or today))
                    amount = Decimal(str(round(random.uniform(500, 150000), 2)))
                    approval = random.choice(["approved", "approved", "approved", "pending", "rejected"])
                    pe = ProjectExpense(
                        tenant_id=tenant_id, created_by=random.choice(user_ids), updated_by=creator_id,
                        project_id=proj.id,
                        cost_category_id=random.choice(cost_cat_ids),
                        description=random.choice(expense_descs),
                        amount=amount, expense_date=exp_date,
                        vendor_name=random.choice(["AWS", "Microsoft", "Accenture", "Deloitte", "Google", "Dell", "Salesforce", None]),
                        is_billable=random.random() < 0.6,
                        approval_status=approval,
                        approved_by=random.choice(user_ids) if approval == "approved" else None,
                        approved_at=datetime.now() - timedelta(days=random.randint(1, 30)) if approval == "approved" else None,
                    )
                    db.add(pe)
                    expense_count += 1

        await db.flush()
        print(f"  Created {expense_count} project expenses")

        # ----- Budget Lines -----
        budget_line_count = 0
        for proj, pd in project_objs:
            total_budget = pd["budget"]
            for cc_slug, cc_id in cost_cat_map.items():
                pct = random.uniform(0.05, 0.25)
                planned = Decimal(str(round(total_budget * pct, 2)))
                actual = planned * Decimal(str(random.uniform(0.5, 1.3))) if pd["progress"] > 20 else Decimal("0")
                bl = ProjectBudgetLine(
                    tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                    project_id=proj.id, cost_category_id=cc_id,
                    planned_amount=planned, actual_amount=round(actual, 2),
                    description=f"Budget for {cc_slug.replace('-', ' ').title()}",
                )
                db.add(bl)
                budget_line_count += 1

        await db.flush()
        print(f"  Created {budget_line_count} budget lines")

        # ----- Billing Rates -----
        rate_count = 0
        for uid in user_ids:
            br = BillingRate(
                tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                user_id=uid,
                hourly_rate=Decimal(str(random.choice([75, 100, 125, 150, 175, 200, 250, 300]))),
                effective_from=today - timedelta(days=365),
            )
            db.add(br)
            rate_count += 1

        await db.flush()
        print(f"  Created {rate_count} billing rates")

        # ----- Project Invoices -----
        invoice_count = 0
        for proj, pd in project_objs:
            if pd["billing_type"] not in ("internal", None):
                num_inv = random.randint(1, 4)
                for i in range(num_inv):
                    inv_date = random_date_between(proj.start_date + timedelta(days=30), min(today, proj.end_date or today))
                    amount = Decimal(str(round(pd["budget"] * random.uniform(0.05, 0.25), 2)))
                    status = random.choice(["draft", "sent", "paid", "paid", "overdue"])
                    pi = ProjectInvoice(
                        tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                        project_id=proj.id,
                        amount=amount, description=f"Invoice #{i + 1} for {proj.name}",
                        status=status, invoice_date=inv_date,
                        due_date=inv_date + timedelta(days=30),
                        paid_date=inv_date + timedelta(days=random.randint(15, 45)) if status == "paid" else None,
                    )
                    db.add(pi)
                    invoice_count += 1

        await db.flush()
        print(f"  Created {invoice_count} project invoices")

        # ----- Risks -----
        risk_count = 0
        for proj, pd in project_objs:
            num_risks = random.randint(3, 8)
            chosen_risks = random.sample(RISK_TEMPLATES, min(num_risks, len(RISK_TEMPLATES)))
            for rt in chosen_risks:
                prob = rt["probability"]
                impact = rt["impact"]
                score = PROB_MAP.get(prob, 3) * IMPACT_MAP.get(impact, 3)
                status = random.choice(["identified", "mitigating", "monitoring", "resolved", "accepted"])
                pr = ProjectRisk(
                    tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                    project_id=proj.id, title=rt["title"],
                    description=rt["description"],
                    category_id=risk_cat_map.get(rt["category_slug"]),
                    probability=prob, impact=impact, risk_score=score,
                    status=status,
                    owner_id=random.choice(user_ids),
                    mitigation_plan=rt["mitigation"],
                    contingency_plan="Activate contingency plan if mitigation fails. Escalate to steering committee.",
                    due_date=random_date_between(today, today + timedelta(days=90)),
                    resolved_at=datetime.now() - timedelta(days=random.randint(1, 30)) if status == "resolved" else None,
                )
                db.add(pr)
                risk_count += 1

        await db.flush()
        print(f"  Created {risk_count} project risks")

        # ----- Issues -----
        issue_count = 0
        for proj, pd in project_objs:
            if pd["progress"] > 20:
                num_issues = random.randint(2, 5)
                chosen_issues = random.sample(ISSUE_TEMPLATES, min(num_issues, len(ISSUE_TEMPLATES)))
                for it in chosen_issues:
                    pi = ProjectIssue(
                        tenant_id=tenant_id, created_by=random.choice(user_ids), updated_by=creator_id,
                        project_id=proj.id, title=it["title"],
                        description=it["description"],
                        priority=it["priority"], status=it["status"],
                        assigned_to=random.choice(user_ids),
                        reported_by=random.choice(user_ids),
                        resolution=it.get("resolution"),
                        due_date=random_date_between(today, today + timedelta(days=30)),
                        resolved_at=datetime.now() - timedelta(days=random.randint(1, 15)) if it["status"] == "resolved" else None,
                    )
                    db.add(pi)
                    issue_count += 1

        await db.flush()
        print(f"  Created {issue_count} project issues")

        # ----- Change Requests -----
        cr_count = 0
        cr_number = 1
        for proj, pd in project_objs:
            if pd["progress"] > 30:
                num_crs = random.randint(1, 3)
                chosen_crs = random.sample(CHANGE_REQUEST_TEMPLATES, min(num_crs, len(CHANGE_REQUEST_TEMPLATES)))
                for crt in chosen_crs:
                    cr = ChangeRequest(
                        tenant_id=tenant_id, created_by=random.choice(user_ids), updated_by=creator_id,
                        project_id=proj.id,
                        number=f"CR-{cr_number:04d}",
                        title=crt["title"], description=crt["description"],
                        reason=crt["reason"],
                        impact_analysis=f"Analysis shows this will require {crt['schedule_impact_days']} additional days and ${crt['budget_impact']:,.0f} in budget.",
                        requested_by=random.choice(user_ids),
                        status=crt["status"], priority=crt["priority"],
                        budget_impact=Decimal(str(crt["budget_impact"])),
                        schedule_impact_days=crt["schedule_impact_days"],
                        approved_by=random.choice(user_ids) if crt["status"] == "approved" else None,
                        approved_at=datetime.now() - timedelta(days=random.randint(1, 20)) if crt["status"] == "approved" else None,
                    )
                    db.add(cr)
                    cr_count += 1
                    cr_number += 1

        await db.flush()
        print(f"  Created {cr_count} change requests")

        # ----- Status Reports -----
        sr_count = 0
        sr_number = 1
        for proj, pd in project_objs:
            if pd["status"] == "active":
                # Generate 4-8 weekly reports
                num_reports = random.randint(4, 8)
                for i in range(num_reports):
                    report_date = today - timedelta(weeks=num_reports - i)
                    period_start = report_date - timedelta(days=6)
                    sr = StatusReport(
                        tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                        project_id=proj.id,
                        number=f"SR-{sr_number:04d}",
                        report_date=report_date,
                        period_type="weekly",
                        period_start=period_start,
                        period_end=report_date,
                        summary=f"Week {i + 1} status for {proj.name}. Project is {'on track' if pd['progress'] > 40 else 'slightly behind schedule'}.",
                        accomplishments=[
                            f"Completed {random.randint(5, 15)} tasks",
                            f"Closed {random.randint(1, 5)} defects",
                            "Milestone review meeting conducted",
                        ],
                        planned_next=[
                            f"Begin next sprint with {random.randint(8, 20)} story points",
                            "Conduct integration testing",
                            "Update project documentation",
                        ],
                        risks_issues=[
                            f"{random.randint(0, 3)} open risks being monitored",
                            f"{random.randint(0, 2)} issues pending resolution",
                        ],
                        kpi_snapshot={
                            "schedule_variance": round(random.uniform(-10, 5), 1),
                            "budget_variance": round(random.uniform(-8, 3), 1),
                            "quality_score": round(random.uniform(85, 99), 1),
                            "team_velocity": random.randint(20, 50),
                        },
                        status="published" if i < num_reports - 1 else "draft",
                    )
                    db.add(sr)
                    sr_count += 1
                    sr_number += 1

        await db.flush()
        print(f"  Created {sr_count} status reports")

        # ----- Meeting Notes -----
        meeting_count = 0
        for proj, pd in project_objs:
            if pd["status"] == "active":
                num_meetings = random.randint(4, 10)
                for i in range(num_meetings):
                    mt = random.choice(MEETING_TEMPLATES)
                    meeting_date = datetime.now() - timedelta(days=random.randint(1, 60))
                    attendee_ids = random.sample(user_ids, min(random.randint(3, 7), len(user_ids)))
                    mn = MeetingNote(
                        tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                        project_id=proj.id,
                        title=f"{mt['title']} - {proj.name}",
                        meeting_date=meeting_date,
                        attendees=[{"user_id": uid, "role": "attendee"} for uid in attendee_ids],
                        agenda=mt["agenda"],
                        notes=f"Meeting held on {meeting_date.strftime('%Y-%m-%d')}. Key discussion points covered. All agenda items addressed.",
                        action_items=[
                            {"title": "Follow up on open items", "assigned_to": random.choice(user_ids), "due_date": (today + timedelta(days=7)).isoformat(), "status": "pending"},
                            {"title": "Update project plan", "assigned_to": random.choice(user_ids), "due_date": (today + timedelta(days=3)).isoformat(), "status": "completed"},
                            {"title": "Share meeting notes with team", "assigned_to": creator_id, "due_date": today.isoformat(), "status": "completed"},
                        ],
                    )
                    db.add(mn)
                    meeting_count += 1

        await db.flush()
        print(f"  Created {meeting_count} meeting notes")

        # ----- Project Templates -----
        templates_data = [
            {"name": "Software Development Lifecycle", "description": "Standard SDLC project template with all phases from requirements to deployment.",
             "billing_type": "time_material", "category_slug": "digital-transformation"},
            {"name": "Infrastructure Migration", "description": "Template for data center and cloud migration projects.",
             "billing_type": "fixed", "category_slug": "infrastructure"},
            {"name": "Compliance Audit", "description": "Regulatory compliance audit project with pre-built risk assessment and reporting milestones.",
             "billing_type": "retainer", "category_slug": "compliance-audit"},
            {"name": "Product Launch", "description": "End-to-end product launch template including market research, development, marketing, and go-to-market.",
             "billing_type": "fixed", "category_slug": "product-development"},
            {"name": "Agile Sprint Framework", "description": "2-week sprint template with backlog grooming, sprint planning, daily standups, and retrospective.",
             "billing_type": "time_material", "category_slug": "digital-transformation"},
        ]
        # Build per-template task and milestone data
        _sdlc_milestones = [
            {"title": m["title"], "description": f"Milestone: {m['title']}", "due_date_offset_days": int(m["offset_pct"] * 180)}
            for m in MILESTONE_TEMPLATES["standard"]
        ]
        _sdlc_tasks = []
        for tg in TASK_TEMPLATES:
            for t in tg["tasks"]:
                _sdlc_tasks.append({
                    "title": t["title"], "priority": t["priority"],
                    "status": "todo", "estimated_hours": t["hours"],
                })

        _infra_milestones = [
            {"title": "Assessment & Discovery", "description": "Audit existing infrastructure and identify migration targets.", "due_date_offset_days": 14},
            {"title": "Architecture Design", "description": "Design target cloud/on-prem architecture.", "due_date_offset_days": 35},
            {"title": "Environment Provisioning", "description": "Set up target environments and networking.", "due_date_offset_days": 56},
            {"title": "Migration Execution", "description": "Migrate workloads, databases, and services.", "due_date_offset_days": 98},
            {"title": "Validation & Cutover", "description": "Validate migrated systems and perform DNS/traffic cutover.", "due_date_offset_days": 112},
            {"title": "Decommission & Closure", "description": "Decommission legacy systems and close project.", "due_date_offset_days": 126},
        ]
        _infra_tasks = [
            {"title": "Inventory all servers and services", "priority": "high", "status": "todo", "estimated_hours": 24},
            {"title": "Assess application dependencies", "priority": "high", "status": "todo", "estimated_hours": 32},
            {"title": "Define migration strategy per workload", "priority": "critical", "status": "todo", "estimated_hours": 20},
            {"title": "Design target network topology", "priority": "high", "status": "todo", "estimated_hours": 16},
            {"title": "Provision cloud accounts and IAM", "priority": "critical", "status": "todo", "estimated_hours": 12},
            {"title": "Set up VPN and connectivity", "priority": "high", "status": "todo", "estimated_hours": 16},
            {"title": "Migrate database tier", "priority": "critical", "status": "todo", "estimated_hours": 40},
            {"title": "Migrate application tier", "priority": "high", "status": "todo", "estimated_hours": 48},
            {"title": "Migrate storage and file systems", "priority": "medium", "status": "todo", "estimated_hours": 24},
            {"title": "Configure monitoring and alerting", "priority": "high", "status": "todo", "estimated_hours": 16},
            {"title": "Performance and failover testing", "priority": "high", "status": "todo", "estimated_hours": 24},
            {"title": "DNS cutover and traffic switching", "priority": "critical", "status": "todo", "estimated_hours": 8},
            {"title": "Decommission legacy servers", "priority": "medium", "status": "todo", "estimated_hours": 16},
            {"title": "Final documentation and handover", "priority": "medium", "status": "todo", "estimated_hours": 12},
        ]

        _compliance_milestones = [
            {"title": "Scope Definition", "description": "Define audit scope, regulations, and control objectives.", "due_date_offset_days": 7},
            {"title": "Evidence Collection", "description": "Gather documentation, policies, and system evidence.", "due_date_offset_days": 28},
            {"title": "Risk Assessment", "description": "Identify and evaluate compliance risks and gaps.", "due_date_offset_days": 42},
            {"title": "Remediation", "description": "Address identified gaps and implement corrective actions.", "due_date_offset_days": 63},
            {"title": "Final Audit & Reporting", "description": "Conduct final audit review and produce compliance report.", "due_date_offset_days": 77},
        ]
        _compliance_tasks = [
            {"title": "Identify applicable regulations and standards", "priority": "critical", "status": "todo", "estimated_hours": 16},
            {"title": "Map controls to regulatory requirements", "priority": "high", "status": "todo", "estimated_hours": 24},
            {"title": "Collect policy and procedure documentation", "priority": "high", "status": "todo", "estimated_hours": 20},
            {"title": "Interview process owners", "priority": "medium", "status": "todo", "estimated_hours": 32},
            {"title": "Perform automated compliance scans", "priority": "high", "status": "todo", "estimated_hours": 12},
            {"title": "Conduct risk scoring and gap analysis", "priority": "critical", "status": "todo", "estimated_hours": 24},
            {"title": "Develop remediation action plan", "priority": "high", "status": "todo", "estimated_hours": 16},
            {"title": "Implement control improvements", "priority": "high", "status": "todo", "estimated_hours": 40},
            {"title": "Re-test remediated controls", "priority": "high", "status": "todo", "estimated_hours": 16},
            {"title": "Prepare final audit report", "priority": "critical", "status": "todo", "estimated_hours": 20},
            {"title": "Present findings to stakeholders", "priority": "high", "status": "todo", "estimated_hours": 8},
        ]

        _launch_milestones = [
            {"title": "Market Research & Strategy", "description": "Analyze market, competitors, and define go-to-market strategy.", "due_date_offset_days": 21},
            {"title": "Product Development", "description": "Build MVP and iterate based on beta feedback.", "due_date_offset_days": 63},
            {"title": "Marketing & Collateral", "description": "Create marketing materials, landing pages, and campaigns.", "due_date_offset_days": 84},
            {"title": "Beta & Soft Launch", "description": "Release to beta users and gather feedback.", "due_date_offset_days": 98},
            {"title": "General Availability", "description": "Public launch with full marketing push.", "due_date_offset_days": 112},
            {"title": "Post-Launch Review", "description": "Analyze launch metrics and plan next iteration.", "due_date_offset_days": 126},
        ]
        _launch_tasks = [
            {"title": "Conduct competitive analysis", "priority": "high", "status": "todo", "estimated_hours": 24},
            {"title": "Define target personas and segments", "priority": "high", "status": "todo", "estimated_hours": 16},
            {"title": "Create product positioning document", "priority": "high", "status": "todo", "estimated_hours": 12},
            {"title": "Develop MVP feature set", "priority": "critical", "status": "todo", "estimated_hours": 80},
            {"title": "Design branding and visual identity", "priority": "medium", "status": "todo", "estimated_hours": 32},
            {"title": "Build landing page and website", "priority": "high", "status": "todo", "estimated_hours": 40},
            {"title": "Create press kit and media outreach plan", "priority": "medium", "status": "todo", "estimated_hours": 20},
            {"title": "Set up analytics and tracking", "priority": "high", "status": "todo", "estimated_hours": 12},
            {"title": "Recruit and onboard beta users", "priority": "high", "status": "todo", "estimated_hours": 16},
            {"title": "Collect and triage beta feedback", "priority": "high", "status": "todo", "estimated_hours": 24},
            {"title": "Execute launch-day marketing campaign", "priority": "critical", "status": "todo", "estimated_hours": 16},
            {"title": "Monitor launch metrics and incident response", "priority": "critical", "status": "todo", "estimated_hours": 20},
            {"title": "Post-launch retrospective and roadmap update", "priority": "medium", "status": "todo", "estimated_hours": 8},
        ]

        _agile_milestones = [
            {"title": "Sprint Planning", "description": "Define sprint goal and select backlog items.", "due_date_offset_days": 1},
            {"title": "Mid-Sprint Checkpoint", "description": "Review progress and address blockers.", "due_date_offset_days": 7},
            {"title": "Sprint Review & Demo", "description": "Demonstrate completed work to stakeholders.", "due_date_offset_days": 13},
            {"title": "Sprint Retrospective", "description": "Reflect on process and identify improvements.", "due_date_offset_days": 14},
        ]
        _agile_tasks = [
            {"title": "Backlog grooming and prioritization", "priority": "high", "status": "todo", "estimated_hours": 4},
            {"title": "Sprint planning meeting", "priority": "high", "status": "todo", "estimated_hours": 2},
            {"title": "Write acceptance criteria for user stories", "priority": "high", "status": "todo", "estimated_hours": 8},
            {"title": "Implement user story 1", "priority": "high", "status": "todo", "estimated_hours": 16},
            {"title": "Implement user story 2", "priority": "high", "status": "todo", "estimated_hours": 16},
            {"title": "Implement user story 3", "priority": "medium", "status": "todo", "estimated_hours": 12},
            {"title": "Code review and pair programming", "priority": "medium", "status": "todo", "estimated_hours": 8},
            {"title": "Write and run unit tests", "priority": "high", "status": "todo", "estimated_hours": 10},
            {"title": "Integration testing", "priority": "high", "status": "todo", "estimated_hours": 6},
            {"title": "Update documentation", "priority": "medium", "status": "todo", "estimated_hours": 4},
            {"title": "Sprint demo preparation", "priority": "medium", "status": "todo", "estimated_hours": 2},
            {"title": "Conduct sprint retrospective", "priority": "high", "status": "todo", "estimated_hours": 2},
        ]

        _template_content = {
            "Software Development Lifecycle": {"milestones": _sdlc_milestones, "tasks": _sdlc_tasks, "default_labels": ["development", "testing", "documentation"]},
            "Infrastructure Migration": {"milestones": _infra_milestones, "tasks": _infra_tasks, "default_labels": ["infrastructure", "migration", "networking"]},
            "Compliance Audit": {"milestones": _compliance_milestones, "tasks": _compliance_tasks, "default_labels": ["compliance", "audit", "risk"]},
            "Product Launch": {"milestones": _launch_milestones, "tasks": _launch_tasks, "default_labels": ["marketing", "product", "launch"]},
            "Agile Sprint Framework": {"milestones": _agile_milestones, "tasks": _agile_tasks, "default_labels": ["agile", "sprint", "development"]},
        }

        for td in templates_data:
            content = _template_content[td["name"]]
            pt = ProjectTemplate(
                tenant_id=tenant_id, created_by=creator_id, updated_by=creator_id,
                name=td["name"], description=td["description"],
                category_id=cat_map.get(td["category_slug"]),
                default_billing_type=td["billing_type"],
                template_data={
                    "milestones": content["milestones"],
                    "tasks": content["tasks"],
                    "phases": [{"name": p["name"], "color": p["color"]} for p in PHASE_TEMPLATES],
                    "default_labels": content["default_labels"],
                },
                is_active=True,
            )
            db.add(pt)

        await db.flush()
        print(f"  Created {len(templates_data)} project templates")

        # ----- Commit everything -----
        await db.commit()
        print("\nProject seed completed successfully!")
        print(f"  Total: {len(project_ids)} projects, {total_milestones} milestones, {total_tasks} tasks")
        print(f"  {dep_count} dependencies, {checklist_count} checklist items, {label_assignment_count} labels")
        print(f"  {comment_count} task comments, {watcher_count} watchers, {timelog_count} time logs")
        print(f"  {member_count} members, {alloc_count} allocations, {skill_count} skills")
        print(f"  {expense_count} expenses, {budget_line_count} budget lines, {invoice_count} invoices")
        print(f"  {risk_count} risks, {issue_count} issues, {cr_count} CRs, {sr_count} reports, {meeting_count} meetings")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_project_data())
