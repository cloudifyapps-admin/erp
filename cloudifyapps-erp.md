# Cloudifyapps ERP — Complete Feature Specification

> **Purpose:** This document is the complete specification for rebuilding Cloudifyapps ERP.
> Use it as a prompt/reference for vibe coding the new stack.

---

## Technology Stack

| Layer | New Stack | Notes |
|-------|-----------|-------|
| **Backend API** | Python FastAPI | Domain-driven, async, Pydantic models |
| **Auth & IAM** | Keycloak | Multi-tenant via Organizations, RBAC, SSO |
| **Database** | PostgreSQL | JSONB for custom fields, full FK constraints |
| **Cache / Queue** | Redis | Session cache, background job queue (Celery/ARQ) |
| **File Storage** | MinIO (S3-compatible) | Logos, attachments, signatures, receipts |
| **Frontend** | Next.js 14+ (App Router) | React Server Components where possible |
| **UI Kit** | Tailwind CSS + shadcn/ui | Radix primitives, fully customizable |
| **State Mgmt** | Zustand or React Query | Server state via TanStack Query |
| **Scheduled Jobs** | Celery Beat / APScheduler | Recurring invoices, recurring tasks |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Frontend                   │
│    (Tailwind + shadcn/ui, App Router, RSC)          │
└──────────────────────┬──────────────────────────────┘
                       │ REST / JSON
┌──────────────────────▼──────────────────────────────┐
│                  FastAPI Backend                      │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐            │
│  │ Routers │ │ Services  │ │ Models    │            │
│  │ (per    │ │ (business │ │ (SQLAlchemy│            │
│  │ domain) │ │  logic)   │ │  + Alembic)│           │
│  └─────────┘ └──────────┘ └───────────┘            │
│         │           │            │                   │
│  ┌──────▼───────────▼────────────▼──────┐           │
│  │        Middleware Layer               │           │
│  │  (tenant_id injection, auth, RBAC)   │           │
│  └──────────────────────────────────────┘           │
└──────┬──────────┬──────────┬────────────────────────┘
       │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌──────────┐
  │Postgres│ │ Redis  │ │ MinIO  │ │ Keycloak │
  │        │ │        │ │ (S3)   │ │  (IAM)   │
  └────────┘ └────────┘ └────────┘ └──────────┘
```

---

## Multi-Tenant Architecture

### Concept

Every business entity belongs to a **tenant** (company/organization). Tenants are represented as Keycloak Organizations. Each user belongs to one or more tenants and has a `current_tenant_id` in their session.

### Enforcement Rules

1. **Every business table** MUST have: `tenant_id`, `created_by`, `updated_by`, `created_at`, `updated_at`
2. **Every query** MUST filter by `tenant_id` — enforce via SQLAlchemy global filter or middleware
3. **Never allow cross-tenant data access**
4. `tenant_id` and `created_by` are auto-set on INSERT from the authenticated user's context
5. `updated_by` is auto-set on UPDATE

### Implementation Pattern (FastAPI)

```python
# Dependency injection for tenant context
async def get_current_tenant(request: Request, user = Depends(get_current_user)) -> int:
    return user.current_tenant_id

# SQLAlchemy mixin for all business models
class TenantMixin:
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
```

---

## Permission & Authorization System

### Roles (6 built-in)

| Role | Description |
|------|-------------|
| **admin** | Full access to everything + settings |
| **manager** | CRUD on all modules (no delete, no settings) |
| **employee** | Self-service HR + assigned work only |
| **viewer** | Read-only on all modules |
| **vendor** | Purchase workflows (own POs, goods receipts) |
| **customer** | Sales workflows (own quotes, orders, invoices) + tickets |

### Permission Format

`{resource}:{action}`

**Actions:** `view`, `create`, `edit`, `delete`, `view-own`, `edit-own`

### Resources (29 total)

```
leads, contacts, customers, opportunities, activities,
quotations, sales-orders, deliveries, invoices,
vendors, purchase-orders, goods-receipts,
products, warehouses, stock-movements, stock-adjustments, stock-transfers,
projects, tasks, milestones, time-logs,
employees, departments, attendance, leave-requests, payroll,
performance-reviews, expense-claims,
documents, tickets,
settings (settings:manage)
```

### Role Permission Matrix

**Admin:** All resources × all actions + `settings:manage`

**Manager:** All resources × `view`, `create`, `edit` (NO `delete`, NO `settings:manage`)

**Employee:**
- `attendance:view-own`
- `leave-requests:view-own`, `leave-requests:create`, `leave-requests:edit-own`
- `holiday-lists:view`
- `expense-claims:view-own`, `expense-claims:create`, `expense-claims:edit-own`
- `performance-reviews:view-own`
- `projects:view-own`, `tasks:view-own`, `tasks:create`, `tasks:edit-own`
- `milestones:view-own`, `time-logs:view-own`, `time-logs:create`, `time-logs:edit-own`
- `tickets:view-own`, `tickets:create`, `tickets:edit-own`
- `documents:view-own`, `documents:create`, `documents:edit-own`

**Viewer:** All resources × `view` only

**Vendor:** `purchase-orders:view-own`, `goods-receipts:view-own`, `products:view`, `warehouses:view`, `documents:view-own`, `documents:create`

**Customer:** `quotations:view-own`, `sales-orders:view-own`, `deliveries:view-own`, `invoices:view-own`, `tickets:view-own`, `tickets:create`, `tickets:edit-own`, `projects:view-own`, `documents:view-own`, `documents:create`

### Authorization Logic

1. Tenant owners bypass ALL permission checks
2. Check `resource:action` permission
3. If `view` denied, fallback to `view-own` (scoped to `created_by = current_user_id`)
4. If `edit` denied, fallback to `edit-own`
5. Any `settings:*` check maps to `settings:manage`

### Keycloak Integration

- Define roles in Keycloak realm
- Store permission mappings in PostgreSQL (roles, permissions, role_permissions tables)
- FastAPI middleware extracts Keycloak token → resolves tenant + permissions
- Expose permission flags to frontend via `/api/me` endpoint

---

## Database Schema

### Naming Conventions

- Table names: `snake_case`, plural (e.g., `customers`, `sales_orders`)
- Foreign keys: `{entity}_id` (e.g., `customer_id`)
- Timestamps: `created_at`, `updated_at` on every table
- Tenant columns: `tenant_id`, `created_by`, `updated_by` on every business table
- JSONB: Use for `custom_fields`, `earnings`, `deductions`, `attributes`, `components`, `number_series`

---

### Global Tables (Not Tenant-Scoped)

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| name | varchar(255) | NOT NULL |
| email | varchar(255) | UNIQUE, NOT NULL |
| password_hash | varchar(255) | NOT NULL |
| email_verified_at | timestamp | nullable |
| current_tenant_id | int FK(tenants.id) | nullable |
| profile_photo_path | varchar(255) | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `tenants`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| owner_id | int FK(users.id) | NOT NULL |
| name | varchar(255) | NOT NULL |
| personal_tenant | boolean | default false |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `tenant_users` (pivot)
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK(tenants.id) | NOT NULL |
| user_id | int FK(users.id) | NOT NULL |
| role | varchar(50) | NOT NULL |
| created_at | timestamp | |
| updated_at | timestamp | |
| | | UNIQUE(tenant_id, user_id) |

#### `countries`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| name | varchar(255) | NOT NULL |
| code | varchar(3) | UNIQUE, NOT NULL |
| phone_code | varchar(10) | nullable |
| flag_emoji | varchar(10) | nullable |
| is_active | boolean | default true |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `currencies`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| name | varchar(255) | NOT NULL |
| code | varchar(3) | UNIQUE, NOT NULL |
| symbol | varchar(10) | NOT NULL |
| decimal_places | int | default 2 |
| is_active | boolean | default true |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `languages`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| name | varchar(255) | NOT NULL |
| code | varchar(10) | UNIQUE, NOT NULL |
| direction | varchar(3) | default 'ltr' (ltr/rtl) |
| is_active | boolean | default true |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `translations`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| language_id | int FK(languages.id) CASCADE | NOT NULL |
| group | varchar(100) | NOT NULL |
| key | varchar(255) | NOT NULL |
| value | text | NOT NULL |
| created_at | timestamp | |
| updated_at | timestamp | |
| | | UNIQUE(language_id, group, key) |

#### `exchange_rates`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| base_currency_id | int FK(currencies.id) | NOT NULL |
| target_currency_id | int FK(currencies.id) | NOT NULL |
| rate | decimal(18,8) | NOT NULL |
| effective_date | date | NOT NULL |
| created_at | timestamp | |
| updated_at | timestamp | |
| | | INDEX(base_currency_id, target_currency_id, effective_date) |

#### `gst_states` (India-specific)
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| state_name | varchar(255) | NOT NULL |
| state_code | varchar(2) | UNIQUE, NOT NULL |
| alpha_code | varchar(5) | nullable |
| is_union_territory | boolean | default false |
| sort_order | int | default 0 |
| is_active | boolean | default true |
| created_at | timestamp | |
| updated_at | timestamp | |

---

### Tenant-Scoped Master Data Tables

All share this base structure:

| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK(tenants.id) CASCADE | NOT NULL |
| name | varchar(255) | NOT NULL |
| slug | varchar(255) | nullable |
| description | text | nullable |
| is_active | boolean | default true |
| sort_order | int | default 0 |
| created_by | int FK(users.id) | NOT NULL |
| updated_by | int FK(users.id) | NOT NULL |
| created_at | timestamp | |
| updated_at | timestamp | |
| | | UNIQUE(tenant_id, slug) where applicable |

**Master Data Entities:**

| Table | Extra Columns |
|-------|--------------|
| `units_of_measure` | `abbreviation`, `type` (unit/weight/volume/length/area/time) |
| `tax_regions` | `code` (UNIQUE), `country_id` FK |
| `tax_types` | `code`, `rate` decimal(8,4), `tax_region_id` FK, `is_compound` boolean |
| `product_categories` | `parent_id` FK(self) for hierarchy |
| `product_brands` | `logo_url` |
| `states` | `country_id` FK |
| `cities` | `state_id` FK, `country_id` FK |
| `lead_sources` | _(base only)_ |
| `lead_statuses` | `color`, `is_default`, `is_won`, `is_lost` |
| `opportunity_stages` | `color`, `probability`, `is_won`, `is_lost` |
| `activity_types` | `icon`, `color` |
| `task_statuses` | `color`, `is_default`, `is_closed` |
| `ticket_statuses` | `color`, `is_default`, `is_closed` |
| `ticket_priorities` | `color` |
| `ticket_categories` | _(base only)_ |
| `document_categories` | _(base only)_ |
| `salutations` | _(minimal: id, tenant_id, name, timestamps)_ |
| `leave_types` | _(minimal: id, tenant_id, name, timestamps)_ |

**Ordering Rule:** All master data dropdowns must use `ORDER BY sort_order, name`.

---

### Roles & Permissions Tables

#### `roles`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK(tenants.id) CASCADE | NOT NULL |
| name | varchar(100) | NOT NULL |
| slug | varchar(100) | NOT NULL |
| description | text | nullable |
| is_system | boolean | default false |
| created_by | int FK(users.id) | |
| updated_by | int FK(users.id) | |
| created_at | timestamp | |
| updated_at | timestamp | |
| | | UNIQUE(tenant_id, slug) |

#### `permissions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| name | varchar(255) | NOT NULL |
| slug | varchar(255) | UNIQUE, NOT NULL |
| module | varchar(100) | nullable |
| description | text | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `role_permissions` (pivot)
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| role_id | int FK(roles.id) CASCADE | NOT NULL |
| permission_id | int FK(permissions.id) CASCADE | NOT NULL |
| created_at | timestamp | |
| updated_at | timestamp | |
| | | UNIQUE(role_id, permission_id) |

#### `user_roles` (pivot)
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| user_id | int FK(users.id) CASCADE | NOT NULL |
| role_id | int FK(roles.id) CASCADE | NOT NULL |
| tenant_id | int FK(tenants.id) CASCADE | NOT NULL |
| created_at | timestamp | |
| updated_at | timestamp | |
| | | UNIQUE(user_id, role_id, tenant_id) |

---

### Organization Settings

#### `organization_settings`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK(tenants.id) CASCADE | UNIQUE, NOT NULL |
| **Company** | | |
| name | varchar(255) | nullable |
| legal_name | varchar(255) | nullable |
| logo_path | varchar(500) | nullable (MinIO key) |
| icon_path | varchar(500) | nullable (MinIO key) |
| letterhead_path | varchar(500) | nullable (MinIO key) |
| **Address** | | |
| address_line_1 | varchar(255) | nullable |
| address_line_2 | varchar(255) | nullable |
| city | varchar(100) | nullable |
| state | varchar(100) | nullable |
| postal_code | varchar(20) | nullable |
| country_id | int FK(countries.id) | nullable |
| **Contact** | | |
| email | varchar(255) | nullable |
| phone | varchar(50) | nullable |
| website | varchar(255) | nullable |
| fax | varchar(50) | nullable |
| **Signatory** | | |
| signatory_name | varchar(255) | nullable |
| signatory_designation | varchar(255) | nullable |
| signatory_signature_path | varchar(500) | nullable (MinIO key) |
| **Tax & Legal** | | |
| tax_id | varchar(100) | nullable |
| gst_state_id | int FK(gst_states.id) | nullable |
| lut_arn | varchar(100) | nullable |
| lut_date | date | nullable |
| cin | varchar(50) | nullable |
| msme_udyam | varchar(50) | nullable |
| pan | varchar(20) | nullable |
| tan | varchar(20) | nullable |
| **Document Numbering** | | |
| number_series | jsonb | NOT NULL, default '{}' |
| **Defaults** | | |
| default_currency_id | int FK(currencies.id) | nullable |
| default_timezone | varchar(100) | nullable |
| default_country_id | int FK(countries.id) | nullable |
| default_language_id | int FK(languages.id) | nullable |
| default_date_format | varchar(20) | default 'Y-m-d' |
| default_number_format | varchar(20) | default '1,000.00' |
| fiscal_year_start | int | default 1 (month 1-12) |
| **Custom** | | |
| custom_fields | jsonb | default '{}' |
| created_by | int FK(users.id) | |
| updated_by | int FK(users.id) | |
| created_at | timestamp | |
| updated_at | timestamp | |

### Document Numbering System

Stored in `organization_settings.number_series` as JSONB:

```json
{
  "customer":          { "prefix": "CUST", "padding": 5, "next_number": 1 },
  "vendor":            { "prefix": "VND",  "padding": 5, "next_number": 1 },
  "employee":          { "prefix": "EMP",  "padding": 5, "next_number": 1 },
  "product":           { "prefix": "SKU",  "padding": 6, "next_number": 1 },
  "quotation":         { "prefix": "QUO",  "padding": 5, "next_number": 1 },
  "sales_order":       { "prefix": "SO",   "padding": 5, "next_number": 1 },
  "delivery":          { "prefix": "DEL",  "padding": 5, "next_number": 1 },
  "invoice":           { "prefix": "INV",  "padding": 5, "next_number": 1 },
  "proforma_invoice":  { "prefix": "PI",   "padding": 5, "next_number": 1 },
  "purchase_order":    { "prefix": "PO",   "padding": 5, "next_number": 1 },
  "goods_receipt":     { "prefix": "GR",   "padding": 5, "next_number": 1 },
  "ticket":            { "prefix": "TKT",  "padding": 5, "next_number": 1 },
  "expense_claim":     { "prefix": "EXP",  "padding": 5, "next_number": 1 },
  "project":           { "prefix": "PRJ",  "padding": 4, "next_number": 1 },
  "department":        { "prefix": "DEPT", "padding": 4, "next_number": 1 },
  "stock_adjustment":  { "prefix": "ADJ",  "padding": 5, "next_number": 1 },
  "stock_transfer":    { "prefix": "TRF",  "padding": 5, "next_number": 1 },
  "warehouse":         { "prefix": "WH",   "padding": 3, "next_number": 1 }
}
```

**Generated format:** `{prefix}-{zero_padded_number}` → e.g., `QUO-00001`

**Two-step pattern:**
1. `peek_number(entity)` — preview the next number without incrementing (used when form loads)
2. `commit_number(entity)` — increment after successful save

Numbers ONLY increment on record creation, never on edit.

---

## Module 1: CRM

### Tables

#### `leads`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| title | varchar(255) | NOT NULL |
| salutation_id | int FK(salutations.id) | nullable |
| first_name | varchar(100) | NOT NULL |
| last_name | varchar(100) | NOT NULL |
| email | varchar(255) | nullable |
| phone | varchar(50) | nullable |
| mobile | varchar(50) | nullable |
| company | varchar(255) | nullable |
| job_title | varchar(255) | nullable |
| address_line_1 | varchar(255) | nullable |
| address_line_2 | varchar(255) | nullable |
| city | varchar(100) | nullable |
| state | varchar(100) | nullable |
| postal_code | varchar(20) | nullable |
| country_id | int FK(countries.id) | nullable |
| source | varchar(50) | nullable (website/referral/cold_call/advertisement/social_media/other) |
| status | varchar(50) | default 'new' (new/contacted/qualified/unqualified/converted) |
| assigned_to | int FK(users.id) | nullable |
| notes | text | nullable |
| custom_fields | jsonb | default '{}' |
| converted_to_contact_id | int FK(contacts.id) | nullable |
| converted_to_customer_id | int FK(customers.id) | nullable |
| converted_at | timestamp | nullable |
| created_by | int FK | NOT NULL |
| updated_by | int FK | NOT NULL |
| created_at | timestamp | |
| updated_at | timestamp | |
| | | INDEX(tenant_id, status) |
| | | INDEX(tenant_id, assigned_to) |

**Computed:** `full_name` = `first_name + ' ' + last_name`

#### `contacts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| salutation_id | int FK(salutations.id) | nullable |
| first_name | varchar(100) | NOT NULL |
| last_name | varchar(100) | NOT NULL |
| email | varchar(255) | nullable |
| phone | varchar(50) | nullable |
| mobile | varchar(50) | nullable |
| company | varchar(255) | nullable |
| job_title | varchar(255) | nullable |
| address_line_1 | varchar(255) | nullable |
| address_line_2 | varchar(255) | nullable |
| city | varchar(100) | nullable |
| state | varchar(100) | nullable |
| postal_code | varchar(20) | nullable |
| country_id | int FK(countries.id) | nullable |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |

#### `customers`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| user_id | int FK(users.id) | nullable (for portal access) |
| name | varchar(255) | NOT NULL |
| company_name | varchar(255) | nullable |
| display_name | varchar(255) | nullable |
| code | varchar(50) | NOT NULL |
| type | varchar(20) | NOT NULL (company/individual) |
| email | varchar(255) | nullable |
| phone | varchar(50) | nullable |
| website | varchar(255) | nullable |
| tax_id | varchar(100) | nullable |
| **Billing Address** | | |
| billing_attention | varchar(255) | nullable |
| address_line_1 | varchar(255) | nullable |
| address_line_2 | varchar(255) | nullable |
| city | varchar(100) | nullable |
| state | varchar(100) | nullable |
| postal_code | varchar(20) | nullable |
| country_id | int FK(countries.id) | nullable |
| billing_phone | varchar(50) | nullable |
| **Shipping Address** | | |
| shipping_attention | varchar(255) | nullable |
| shipping_address_line_1 | varchar(255) | nullable |
| shipping_address_line_2 | varchar(255) | nullable |
| shipping_city | varchar(100) | nullable |
| shipping_state | varchar(100) | nullable |
| shipping_postal_code | varchar(20) | nullable |
| shipping_country_id | int FK(countries.id) | nullable |
| shipping_phone | varchar(50) | nullable |
| **Settings** | | |
| currency_id | int FK(currencies.id) | nullable |
| language_id | int FK(languages.id) | nullable |
| primary_contact_id | int FK(contacts.id) | nullable |
| lead_id | int FK(leads.id) | nullable |
| status | varchar(20) | default 'active' (active/inactive) |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, code) |
| | | INDEX(tenant_id, email) |
| | | INDEX(tenant_id, status) |

#### `customer_contacts` (M:M pivot)
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| customer_id | int FK(customers.id) CASCADE | NOT NULL |
| contact_id | int FK(contacts.id) CASCADE | NOT NULL |
| role | varchar(100) | nullable |
| is_primary | boolean | default false |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `opportunities`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| title | varchar(255) | NOT NULL |
| customer_id | int FK(customers.id) | nullable |
| contact_id | int FK(contacts.id) | nullable |
| lead_id | int FK(leads.id) | nullable |
| expected_amount | decimal(18,4) | nullable |
| currency_id | int FK(currencies.id) | nullable |
| stage | varchar(50) | default 'qualification' |
| probability | int | default 0 (0-100) |
| expected_close_date | date | nullable |
| assigned_to | int FK(users.id) | nullable |
| notes | text | nullable |
| custom_fields | jsonb | default '{}' |
| sort_order | int | default 0 |
| created_by / updated_by / timestamps | | standard |
| | | INDEX(tenant_id, stage) |

#### `activities` (polymorphic)
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| type | varchar(50) | NOT NULL (call/email/meeting/task/note) |
| subject | varchar(255) | NOT NULL |
| description | text | nullable |
| activitable_type | varchar(255) | nullable (polymorphic) |
| activitable_id | int | nullable (polymorphic) |
| assigned_to | int FK(users.id) | nullable |
| due_at | timestamp | nullable |
| completed_at | timestamp | nullable |
| status | varchar(20) | default 'pending' (pending/completed/cancelled) |
| created_by / updated_by / timestamps | | standard |
| | | INDEX(activitable_type, activitable_id) |
| | | INDEX(tenant_id, status) |

### CRM Workflows & Features

**Lead Conversion Service:**
1. Check if lead is already converted (throw error if yes)
2. Find duplicates by email (contacts + customers within tenant)
3. Create or link Contact (from lead data)
4. Create or link Customer (type = 'company' if lead has company, else 'individual')
5. Link Contact to Customer via pivot (set `is_primary = true`)
6. Optionally create Opportunity (default probability 20%)
7. Mark lead as `status = 'converted'`, set `converted_to_contact_id`, `converted_to_customer_id`, `converted_at`
8. All within a DB transaction

**UI Features:**
- Lead index: search, filter by status/source, grid/list view toggle
- Lead convert: multi-step wizard with duplicate detection
- Customer form: tabbed (Details | Billing | Shipping | Settings | Contacts)
- Contact linking: M:M with role and primary flag
- Activity tracking: polymorphic, attachable to leads/contacts/customers/opportunities

---

## Module 2: Sales

### Tables

#### `quotations`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| number | varchar(50) | NOT NULL |
| customer_id | int FK(customers.id) CASCADE | NOT NULL |
| contact_id | int FK(contacts.id) | nullable |
| opportunity_id | int FK(opportunities.id) | nullable |
| issue_date | date | NOT NULL |
| expiry_date | date | nullable |
| currency_id | int FK(currencies.id) | NOT NULL |
| exchange_rate | decimal(18,8) | default 1.0 |
| subtotal | decimal(18,4) | default 0 |
| tax_amount | decimal(18,4) | default 0 |
| discount_amount | decimal(18,4) | default 0 |
| total | decimal(18,4) | default 0 |
| status | varchar(20) | default 'draft' (draft/sent/accepted/rejected/expired) |
| notes | text | nullable |
| terms | text | nullable |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, number) |
| | | INDEX(tenant_id, status) |

#### `quotation_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| quotation_id | int FK(quotations.id) CASCADE | NOT NULL |
| product_id | int FK(products.id) | nullable |
| description | varchar(500) | NOT NULL |
| quantity | decimal(18,4) | NOT NULL |
| unit_id | int FK(units_of_measure.id) | nullable |
| unit_price | decimal(18,4) | NOT NULL |
| discount_percent | decimal(8,4) | default 0 |
| tax_percent | decimal(8,4) | default 0 |
| line_total | decimal(18,4) | NOT NULL |
| sort_order | int | default 0 |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `sales_orders`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| number | varchar(50) | NOT NULL |
| customer_id | int FK(customers.id) CASCADE | NOT NULL |
| contact_id | int FK(contacts.id) | nullable |
| quotation_id | int FK(quotations.id) | nullable |
| order_date | date | NOT NULL |
| expected_date | date | nullable |
| currency_id | int FK(currencies.id) | NOT NULL |
| exchange_rate | decimal(18,8) | default 1.0 |
| subtotal | decimal(18,4) | default 0 |
| tax_amount | decimal(18,4) | default 0 |
| discount_amount | decimal(18,4) | default 0 |
| total | decimal(18,4) | default 0 |
| status | varchar(20) | default 'draft' (draft/confirmed/processing/completed/cancelled) |
| notes | text | nullable |
| terms | text | nullable |
| shipping_address | text | nullable |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, number) |
| | | INDEX(tenant_id, status) |

#### `sales_order_items`
Same as `quotation_items` plus:
| Column | Type | Constraints |
|--------|------|-------------|
| sales_order_id | int FK(sales_orders.id) CASCADE | NOT NULL |
| delivered_quantity | decimal(18,4) | default 0 |

#### `deliveries`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| number | varchar(50) | NOT NULL |
| sales_order_id | int FK(sales_orders.id) CASCADE | NOT NULL |
| customer_id | int FK(customers.id) | NOT NULL |
| warehouse_id | int FK(warehouses.id) | NOT NULL |
| delivery_date | date | NOT NULL |
| status | varchar(20) | default 'pending' (pending/shipped/delivered/returned) |
| shipping_address | text | nullable |
| tracking_number | varchar(255) | nullable |
| notes | text | nullable |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, number) |

#### `delivery_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| delivery_id | int FK(deliveries.id) CASCADE | NOT NULL |
| sales_order_item_id | int FK(sales_order_items.id) | nullable |
| product_id | int FK(products.id) CASCADE | NOT NULL |
| quantity | decimal(18,4) | NOT NULL |
| notes | text | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `invoices`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| number | varchar(50) | NOT NULL |
| type | varchar(20) | NOT NULL (proforma/tax) |
| customer_id | int FK(customers.id) CASCADE | NOT NULL |
| contact_id | int FK(contacts.id) | nullable |
| sales_order_id | int FK(sales_orders.id) | nullable |
| invoice_date | date | NOT NULL |
| due_date | date | nullable |
| currency_id | int FK(currencies.id) CASCADE | NOT NULL |
| exchange_rate | decimal(18,8) | default 1.0 |
| subtotal | decimal(18,4) | default 0 |
| tax_amount | decimal(18,4) | default 0 |
| discount_amount | decimal(18,4) | default 0 |
| total | decimal(18,4) | default 0 |
| paid_amount | decimal(18,4) | default 0 |
| status | varchar(20) | default 'draft' (draft/sent/paid/partially_paid/overdue/accepted/cancelled) |
| **Recurring Fields** | | |
| is_recurring | boolean | default false |
| recurring_frequency | varchar(20) | nullable (weekly/monthly/quarterly/semi_annual/yearly) |
| recurring_start_date | date | nullable |
| recurring_end_date | date | nullable |
| next_recurring_date | date | nullable |
| parent_invoice_id | int FK(invoices.id) | nullable |
| recurring_count | int | default 0 |
| notes | text | nullable |
| terms | text | nullable |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, number) |
| | | INDEX(tenant_id, type, status) |

**Computed:** `balance_due` = `total - paid_amount`

#### `invoice_items`
Same structure as `quotation_items` with `invoice_id` FK.

### Sales Workflow

```
Quotation (draft → sent → accepted)
    ↓ (create from quotation)
Sales Order (draft → confirmed → processing → completed)
    ↓ (create from sales order)
Delivery (pending → shipped → delivered)
    ↓ (triggers stock decrease)
Invoice (draft → sent → paid)
    └── Type: proforma (PI) or tax (INV)
    └── Supports recurring with auto-generation
```

### Recurring Invoice Service

**Trigger:** Scheduled job (daily via Celery Beat)

**Query:** `is_recurring = true AND parent_invoice_id IS NULL AND next_recurring_date <= today AND (recurring_end_date IS NULL OR recurring_end_date >= today)`

**Process:**
1. Clone invoice header (currency, exchange_rate, all totals)
2. Clone all line items with sort_order
3. Set `status = 'draft'`, `paid_amount = 0`
4. Set `parent_invoice_id` = template ID
5. Calculate `due_date` preserving original offset (e.g., 30-day terms)
6. Increment template's `recurring_count`
7. Calculate and set `next_recurring_date` based on frequency

### Sales UI Features

- **Quotation form:** Tabbed (Details | Items | Notes), auto-calc totals, product auto-fill, duplicate existing
- **Invoice form:** Tabbed (Details | Items | Notes | Recurring), proforma/tax toggle, recurring config
- **All indexes:** Search, status filter, customer filter, pagination, grid/list toggle
- **Line items:** Dynamic add/remove rows, per-item tax & discount, auto-calculated line_total

---

## Module 3: Purchase

### Tables

#### `vendors`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| user_id | int FK(users.id) | nullable (for portal access) |
| name | varchar(255) | NOT NULL |
| code | varchar(50) | NOT NULL |
| email | varchar(255) | nullable |
| phone | varchar(50) | nullable |
| website | varchar(255) | nullable |
| tax_id | varchar(100) | nullable |
| address_line_1 | varchar(255) | nullable |
| address_line_2 | varchar(255) | nullable |
| city | varchar(100) | nullable |
| state | varchar(100) | nullable |
| postal_code | varchar(20) | nullable |
| country_id | int FK(countries.id) | nullable |
| currency_id | int FK(currencies.id) | nullable |
| status | varchar(20) | default 'active' (active/inactive) |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, code) |

#### `purchase_requests`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| number | varchar(50) | NOT NULL |
| title | varchar(255) | NOT NULL |
| description | text | nullable |
| required_date | date | nullable |
| priority | varchar(20) | default 'medium' (low/medium/high/urgent) |
| status | varchar(20) | default 'draft' (draft/submitted/approved/rejected/ordered) |
| requested_by | int FK(users.id) | NOT NULL |
| approved_by | int FK(users.id) | nullable |
| approved_at | timestamp | nullable |
| notes | text | nullable |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, number) |

#### `purchase_orders`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| number | varchar(50) | NOT NULL |
| vendor_id | int FK(vendors.id) CASCADE | NOT NULL |
| purchase_request_id | int FK(purchase_requests.id) | nullable |
| order_date | date | NOT NULL |
| expected_date | date | nullable |
| currency_id | int FK(currencies.id) | NOT NULL |
| exchange_rate | decimal(18,8) | default 1.0 |
| subtotal | decimal(18,4) | default 0 |
| tax_amount | decimal(18,4) | default 0 |
| discount_amount | decimal(18,4) | default 0 |
| total | decimal(18,4) | default 0 |
| status | varchar(20) | default 'draft' (draft/sent/confirmed/received/cancelled) |
| warehouse_id | int FK(warehouses.id) | nullable |
| notes | text | nullable |
| terms | text | nullable |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, number) |
| | | INDEX(tenant_id, status) |

#### `purchase_order_items`
Same as `quotation_items` with `purchase_order_id` FK + `received_quantity` decimal(18,4) default 0.

#### `goods_receipts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| number | varchar(50) | NOT NULL |
| purchase_order_id | int FK(purchase_orders.id) CASCADE | NOT NULL |
| vendor_id | int FK(vendors.id) | NOT NULL |
| warehouse_id | int FK(warehouses.id) | NOT NULL |
| receipt_date | date | NOT NULL |
| status | varchar(20) | default 'pending' (pending/inspecting/accepted/rejected) |
| notes | text | nullable |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, number) |

#### `goods_receipt_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| goods_receipt_id | int FK(goods_receipts.id) CASCADE | NOT NULL |
| purchase_order_item_id | int FK(purchase_order_items.id) | nullable |
| product_id | int FK(products.id) CASCADE | NOT NULL |
| quantity | decimal(18,4) | NOT NULL |
| notes | text | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

### Purchase Workflow

```
Purchase Request (draft → submitted → approved)
    ↓
Purchase Order (draft → sent → confirmed → received)
    ↓
Goods Receipt (pending → inspecting → accepted)
    ↓ (triggers stock increase)
```

---

## Module 4: Inventory

### Tables

#### `products`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| name | varchar(255) | NOT NULL |
| sku | varchar(100) | nullable |
| barcode | varchar(100) | nullable |
| description | text | nullable |
| type | varchar(20) | NOT NULL (product/service) |
| category_id | int FK(product_categories.id) | nullable |
| unit_id | int FK(units_of_measure.id) | nullable |
| purchase_price | decimal(18,4) | default 0 |
| selling_price | decimal(18,4) | default 0 |
| currency_id | int FK(currencies.id) | nullable |
| tax_type_id | int FK(tax_types.id) | nullable |
| track_inventory | boolean | default true |
| reorder_level | decimal(18,4) | default 0 |
| status | varchar(20) | default 'active' (active/inactive/archived) |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, sku) |
| | | INDEX(tenant_id, status) |

#### `product_variants`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| product_id | int FK(products.id) CASCADE | NOT NULL |
| name | varchar(255) | NOT NULL |
| sku | varchar(100) | nullable |
| price_adjustment | decimal(18,4) | default 0 |
| attributes | jsonb | default '{}' |
| is_active | boolean | default true |
| created_by / updated_by / timestamps | | standard |

#### `warehouses`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| name | varchar(255) | NOT NULL |
| code | varchar(50) | NOT NULL |
| address | text | nullable |
| city | varchar(100) | nullable |
| state | varchar(100) | nullable |
| postal_code | varchar(20) | nullable |
| country_id | int FK(countries.id) | nullable |
| is_default | boolean | default false |
| is_active | boolean | default true |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, code) |

#### `stock_movements`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| product_id | int FK(products.id) CASCADE | NOT NULL |
| warehouse_id | int FK(warehouses.id) CASCADE | NOT NULL |
| type | varchar(20) | NOT NULL (in/out/adjustment/transfer) |
| quantity | decimal(18,4) | NOT NULL |
| unit_cost | decimal(18,4) | nullable |
| reference_type | varchar(255) | nullable (polymorphic) |
| reference_id | int | nullable (polymorphic) |
| notes | text | nullable |
| created_by / updated_by / timestamps | | standard |
| | | INDEX(product_id, warehouse_id) |
| | | INDEX(reference_type, reference_id) |

#### `stock_levels` (denormalized cache)
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| product_id | int FK(products.id) CASCADE | NOT NULL |
| warehouse_id | int FK(warehouses.id) CASCADE | NOT NULL |
| quantity | decimal(18,4) | default 0 |
| reserved_quantity | decimal(18,4) | default 0 |
| available_quantity | decimal(18,4) | default 0 |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, product_id, warehouse_id) |

#### `stock_adjustments`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| reference_number | varchar(50) | NOT NULL |
| warehouse_id | int FK(warehouses.id) CASCADE | NOT NULL |
| reason | text | nullable |
| notes | text | nullable |
| status | varchar(20) | default 'draft' (draft/approved/rejected) |
| approved_by | int FK(users.id) | nullable |
| approved_at | timestamp | nullable |
| created_by / updated_by / timestamps | | standard |

#### `stock_adjustment_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| stock_adjustment_id | int FK CASCADE | NOT NULL |
| product_id | int FK(products.id) CASCADE | NOT NULL |
| expected_quantity | decimal(18,4) | default 0 |
| actual_quantity | decimal(18,4) | default 0 |
| difference | decimal(18,4) | default 0 |
| notes | text | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `stock_transfers`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| reference_number | varchar(50) | NOT NULL |
| from_warehouse_id | int FK(warehouses.id) CASCADE | NOT NULL |
| to_warehouse_id | int FK(warehouses.id) CASCADE | NOT NULL |
| status | varchar(20) | default 'draft' (draft/in_transit/completed/cancelled) |
| notes | text | nullable |
| transferred_at | timestamp | nullable |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, reference_number) |

#### `stock_transfer_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| stock_transfer_id | int FK CASCADE | NOT NULL |
| product_id | int FK(products.id) CASCADE | NOT NULL |
| quantity | decimal(18,4) | NOT NULL |
| notes | text | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

### Inventory Service

**Methods:**
- `record_stock_in(product_id, warehouse_id, quantity, unit_cost, reference_type, reference_id)` — creates 'in' movement, updates stock_level
- `record_stock_out(product_id, warehouse_id, quantity, reference_type, reference_id)` — creates 'out' movement, updates stock_level
- `transfer_stock(product_id, from_warehouse, to_warehouse, quantity)` — stock out from source, stock in to destination
- `process_adjustment(stock_adjustment)` — creates movements for each adjustment item
- `update_stock_level(product_id, warehouse_id)` — recalculates: `available = SUM(in) - SUM(out)`
- `get_stock_level(product_id, warehouse_id)` → available_quantity
- `check_availability(product_id, warehouse_id, quantity)` → boolean

**Stock update triggers:**
- Delivery save → stock decrease (record_stock_out)
- Goods Receipt save → stock increase (record_stock_in)
- Stock Adjustment approval → process_adjustment
- Stock Transfer completion → transfer_stock

---

## Module 5: Projects

### Tables

#### `projects`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| name | varchar(255) | NOT NULL |
| code | varchar(50) | nullable |
| description | text | nullable |
| customer_id | int FK(customers.id) | nullable |
| start_date | date | nullable |
| end_date | date | nullable |
| budget | decimal(18,4) | nullable |
| currency_id | int FK(currencies.id) | nullable |
| status | varchar(20) | default 'planning' (planning/active/on_hold/completed/cancelled) |
| progress | int | default 0 (0-100) |
| manager_id | int FK(users.id) | nullable |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, code) |

#### `milestones`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| project_id | int FK(projects.id) CASCADE | NOT NULL |
| title | varchar(255) | NOT NULL |
| description | text | nullable |
| due_date | date | nullable |
| status | varchar(20) | default 'pending' (pending/in_progress/completed) |
| sort_order | int | default 0 |
| created_by / updated_by / timestamps | | standard |

#### `tasks`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| project_id | int FK(projects.id) CASCADE | NOT NULL |
| milestone_id | int FK(milestones.id) | nullable |
| parent_id | int FK(tasks.id) | nullable (subtasks) |
| title | varchar(255) | NOT NULL |
| description | text | nullable |
| assigned_to | int FK(users.id) | nullable |
| priority | varchar(20) | default 'medium' (low/medium/high/urgent) |
| status | varchar(20) | default 'todo' (todo/in_progress/review/done) |
| status_id | int FK(task_statuses.id) | nullable |
| start_date | date | nullable |
| due_date | date | nullable |
| estimated_hours | decimal(8,2) | nullable |
| sort_order | int | default 0 |
| color | varchar(7) | nullable (hex) |
| **Recurring Fields** | | |
| is_recurring | boolean | default false |
| recurring_frequency | varchar(20) | nullable (daily/weekly/biweekly/monthly) |
| recurring_end_date | date | nullable |
| next_recurring_date | date | nullable |
| parent_task_id | int FK(tasks.id) | nullable |
| recurring_count | int | default 0 |
| created_by / updated_by / timestamps | | standard |
| | | INDEX(tenant_id, project_id, status) |

#### `time_logs`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| task_id | int FK(tasks.id) CASCADE | NOT NULL |
| project_id | int FK(projects.id) CASCADE | NOT NULL |
| user_id | int FK(users.id) CASCADE | NOT NULL |
| hours | decimal(8,2) | NOT NULL |
| log_date | date | NOT NULL |
| description | text | nullable |
| is_billable | boolean | default false |
| started_at | timestamp | nullable |
| stopped_at | timestamp | nullable |
| created_by / updated_by / timestamps | | standard |
| | | INDEX(tenant_id, project_id, log_date) |

### Project UI Features

**Project Show Page (complex):**
- **Tabs:** Overview | Kanban | Tasks | Milestones | Time Log
- **Overview:** Stats cards (total tasks, completed, open milestones, total hours)
- **Kanban Board:**
  - Columns from TaskStatus master data
  - Drag-and-drop task cards (update status + sort_order)
  - Cards show: title, assignee avatar, due_date, priority badge
- **Task Management:** CRUD with filters (status, priority, assignee, milestone)
- **Milestone Management:** CRUD with task count per milestone
- **Time Logging:**
  - Start/stop timer per task
  - Manual entry: hours, date, description, billable flag
  - Summary: total hours, billable hours

### Recurring Task Service

Same pattern as Recurring Invoice Service but for tasks. Daily scheduled job generates task copies from templates.

---

## Module 6: HR

### Tables

#### `employees`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| user_id | int FK(users.id) | nullable |
| employee_id | varchar(50) | NOT NULL (auto-generated EMP-xxxxx) |
| first_name | varchar(100) | NOT NULL |
| last_name | varchar(100) | NOT NULL |
| email | varchar(255) | nullable |
| phone | varchar(50) | nullable |
| date_of_birth | date | nullable |
| gender | varchar(20) | nullable |
| address | text | nullable |
| city | varchar(100) | nullable |
| state | varchar(100) | nullable |
| postal_code | varchar(20) | nullable |
| country_id | int FK(countries.id) | nullable |
| department_id | int FK(departments.id) | nullable |
| designation_id | int FK(designations.id) | nullable |
| holiday_list_id | int FK(holiday_lists.id) | nullable |
| reports_to | int FK(employees.id) | nullable (self-ref) |
| joining_date | date | nullable |
| leaving_date | date | nullable |
| employment_type | varchar(20) | default 'full_time' (full_time/part_time/contract/intern) |
| status | varchar(20) | default 'active' (active/on_leave/terminated/resigned) |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, employee_id) |

**Computed:** `full_name` = `first_name + ' ' + last_name`
**Method:** `get_effective_holiday_list()` → employee's list → department's list → tenant default

#### `departments`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| name | varchar(255) | NOT NULL |
| code | varchar(50) | nullable |
| parent_id | int FK(departments.id) | nullable (hierarchy) |
| head_id | int FK(users.id) | nullable |
| is_active | boolean | default true |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, code) |

#### `designations`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| title | varchar(255) | NOT NULL |
| description | text | nullable |
| level | int | nullable |
| is_active | boolean | default true |
| created_by / updated_by / timestamps | | standard |

#### `attendance`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| employee_id | int FK(employees.id) CASCADE | NOT NULL |
| date | date | NOT NULL |
| check_in | time | nullable |
| check_out | time | nullable |
| status | varchar(20) | NOT NULL (present/absent/half_day/late/on_leave) |
| worked_hours | decimal(8,2) | nullable (auto-calculated) |
| notes | text | nullable |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(employee_id, date) |

#### `leave_requests`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| employee_id | int FK(employees.id) CASCADE | NOT NULL |
| leave_type_id | int FK(leave_types.id) | nullable |
| type | varchar(50) | nullable (annual/sick/personal/maternity/paternity/unpaid) |
| start_date | date | NOT NULL |
| end_date | date | NOT NULL |
| days | decimal(5,1) | NOT NULL |
| reason | text | nullable |
| status | varchar(20) | default 'pending' (pending/approved/rejected/cancelled) |
| approved_by | int FK(users.id) | nullable |
| approved_at | timestamp | nullable |
| rejection_reason | text | nullable |
| created_by / updated_by / timestamps | | standard |
| | | INDEX(tenant_id, employee_id, status) |

**Leave Day Calculation:**
1. Count calendar days between start_date and end_date (inclusive)
2. Subtract weekends (Saturday, Sunday)
3. Subtract holidays from employee's effective holiday list
4. Display excluded_weekends and excluded_holidays counts to user

#### `holiday_lists`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| name | varchar(255) | NOT NULL |
| fiscal_year_start | int | nullable |
| description | text | nullable |
| is_default | boolean | default false |
| is_active | boolean | default true |
| created_by / updated_by / timestamps | | standard |

#### `holidays`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| holiday_list_id | int FK(holiday_lists.id) CASCADE | NOT NULL |
| holiday_date | date | NOT NULL |
| name | varchar(255) | NOT NULL |
| holiday_type | varchar(50) | nullable (national/state/departmental) |
| created_by / updated_by / timestamps | | standard |

#### `payroll_structures`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| name | varchar(255) | NOT NULL |
| description | text | nullable |
| is_active | boolean | default true |
| components | jsonb | NOT NULL (salary structure percentages) |
| created_by / updated_by / timestamps | | standard |

#### `payroll_runs`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| title | varchar(255) | NOT NULL |
| year | int | NOT NULL |
| month | int | NOT NULL |
| period_start | date | NOT NULL |
| period_end | date | NOT NULL |
| status | varchar(20) | default 'draft' (draft/processing/completed/cancelled) |
| total_gross | decimal(15,2) | default 0 |
| total_deductions | decimal(15,2) | default 0 |
| total_net | decimal(15,2) | default 0 |
| currency_id | int FK(currencies.id) | nullable |
| processed_at | timestamp | nullable |
| processed_by | int FK(users.id) | nullable |
| notes | text | nullable |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, year, month) |

#### `payroll_slips`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| payroll_run_id | int FK(payroll_runs.id) CASCADE | NOT NULL |
| employee_id | int FK(employees.id) CASCADE | NOT NULL |
| basic_salary | decimal(15,2) | default 0 |
| gross_salary | decimal(15,2) | default 0 |
| total_deductions | decimal(15,2) | default 0 |
| net_salary | decimal(15,2) | default 0 |
| earnings | jsonb | default '{}' |
| deductions | jsonb | default '{}' |
| working_days | decimal(5,1) | default 0 |
| days_worked | decimal(5,1) | default 0 |
| leave_days | decimal(5,1) | default 0 |
| status | varchar(20) | default 'draft' (draft/finalized/paid) |
| payment_date | date | nullable |
| payment_method | varchar(50) | nullable |
| notes | text | nullable |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(payroll_run_id, employee_id) |

#### `performance_reviews`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| employee_id | int FK(employees.id) CASCADE | NOT NULL |
| reviewer_id | int FK(users.id) | nullable |
| review_period | varchar(100) | nullable |
| type | varchar(20) | NOT NULL (annual/quarterly/probation/project) |
| review_date | date | nullable |
| overall_rating | decimal(3,1) | nullable (1-5) |
| strengths | text | nullable |
| improvements | text | nullable |
| comments | text | nullable |
| status | varchar(20) | default 'draft' (draft/in_progress/completed/acknowledged) |
| acknowledged_at | timestamp | nullable |
| created_by / updated_by / timestamps | | standard |
| | | INDEX(tenant_id, employee_id, status) |

#### `review_goals`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| performance_review_id | int FK CASCADE | NOT NULL |
| title | varchar(255) | NOT NULL |
| description | text | nullable |
| weight | decimal(5,2) | nullable (percentage) |
| rating | decimal(3,1) | nullable (1-5) |
| employee_comment | text | nullable |
| reviewer_comment | text | nullable |
| created_by / updated_by / timestamps | | standard |

#### `expense_claims`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| claim_number | varchar(50) | NOT NULL |
| employee_id | int FK(employees.id) CASCADE | NOT NULL |
| title | varchar(255) | nullable |
| description | text | nullable |
| expense_date | date | NOT NULL |
| total_amount | decimal(15,2) | default 0 |
| currency_id | int FK(currencies.id) | nullable |
| status | varchar(20) | default 'draft' (draft/submitted/approved/rejected/paid) |
| approved_by | int FK(users.id) | nullable |
| approved_at | timestamp | nullable |
| rejection_reason | text | nullable |
| payment_date | date | nullable |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, claim_number) |
| | | INDEX(tenant_id, employee_id, status) |

#### `expense_claim_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| expense_claim_id | int FK CASCADE | NOT NULL |
| category | varchar(50) | NOT NULL (travel/meals/accommodation/office_supplies/other) |
| description | text | nullable |
| date | date | NOT NULL |
| amount | decimal(15,2) | NOT NULL |
| has_receipt | boolean | default false |
| created_by / updated_by / timestamps | | standard |

### HR UI Features

- **Employee form:** Tabbed (Personal | Employment | Documents)
- **Attendance:** Inline quick-entry form, auto-calculated worked hours
- **Leave requests:** Smart day calculation excluding weekends + holidays, shows excluded counts
- **Payroll:** Generate slips from active employees, per-slip earnings/deductions, aggregate totals
- **Performance reviews:** Tabbed (Details | Goals | Ratings), weighted goals
- **Expense claims:** Tabbed (Details | Items | Attachments), receipt file uploads
- **Holiday lists:** Dynamic add/remove holidays with date + description

### Approval Workflows

| Entity | Flow |
|--------|------|
| Leave Request | pending → approved/rejected |
| Stock Adjustment | draft → approved → completed |
| Expense Claim | draft → submitted → approved → rejected → paid |
| Performance Review | draft → in_progress → completed → acknowledged |
| Purchase Request | draft → submitted → approved → rejected → ordered |

---

## Module 7: Documents

### Tables

#### `documents` (polymorphic)
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| title | varchar(255) | NOT NULL |
| description | text | nullable |
| documentable_type | varchar(255) | nullable (polymorphic) |
| documentable_id | int | nullable (polymorphic) |
| category | varchar(100) | nullable |
| created_by / updated_by / timestamps | | standard |
| | | INDEX(documentable_type, documentable_id) |
| | | INDEX(tenant_id, category) |

#### `attachments`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| document_id | int FK(documents.id) CASCADE | NOT NULL |
| file_name | varchar(255) | NOT NULL |
| file_path | varchar(500) | NOT NULL (MinIO key) |
| mime_type | varchar(100) | nullable |
| file_size | bigint | nullable |
| uploaded_by | int FK(users.id) | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

**Allowed file types:** pdf, doc, docx, xls, xlsx, csv, txt, jpg, jpeg, png, gif, webp, zip, rar, 7z (max 10MB each)

**Attachable to:** customers, projects, sales orders, employees, or standalone

### Document UI Features

- File upload with drag-and-drop (multiple files)
- File type validation and size limits
- Download endpoint: `GET /api/documents/{id}/attachments/{attachmentId}/download`
- Remove attachments (with MinIO cleanup)
- Display file icons based on type (pdf, word, excel, image, archive)

---

## Module 8: Tickets

### Tables

#### `tickets`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| number | varchar(50) | NOT NULL |
| title | varchar(255) | NOT NULL |
| description | text | nullable |
| category_id | int FK(ticket_categories.id) | nullable |
| priority_id | int FK(ticket_priorities.id) | nullable |
| status_id | int FK(ticket_statuses.id) | nullable |
| assigned_to | int FK(users.id) | nullable |
| requester_id | int FK(users.id) | nullable |
| customer_id | int FK(customers.id) | nullable |
| due_date | date | nullable |
| resolved_at | timestamp | nullable |
| custom_fields | jsonb | default '{}' |
| created_by / updated_by / timestamps | | standard |
| | | UNIQUE(tenant_id, number) |
| | | INDEX(tenant_id, status_id, priority_id, assigned_to) |

#### `ticket_comments`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| tenant_id | int FK | NOT NULL |
| ticket_id | int FK(tickets.id) CASCADE | NOT NULL |
| user_id | int FK(users.id) | nullable |
| body | text | NOT NULL |
| is_internal | boolean | default false (private/public) |
| created_by / updated_by / timestamps | | standard |

#### `ticket_attachments`
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial PK | |
| ticket_id | int FK(tickets.id) CASCADE | NOT NULL |
| file_name | varchar(255) | NOT NULL |
| file_path | varchar(500) | NOT NULL (MinIO key) |
| mime_type | varchar(100) | nullable |
| file_size | bigint | nullable |
| uploaded_by | int FK(users.id) | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

### Ticket UI Features

- **Ticket Show Page:**
  - Main view with status badge
  - Sidebar quick-edit: status, priority, category, assignee, customer, due_date
  - Comments section with internal (private) / public toggle
  - Auto-set `resolved_at` when status changes to a closed status
  - Tabs: Details | Activity | Attachments

---

## API Endpoints (FastAPI Routers)

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Keycloak token exchange |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/auth/me` | Current user + tenant + permissions |
| POST | `/api/auth/switch-tenant` | Switch active tenant |

### CRM
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List leads (paginated, filterable) |
| POST | `/api/leads` | Create lead |
| GET | `/api/leads/{id}` | Get lead |
| PUT | `/api/leads/{id}` | Update lead |
| DELETE | `/api/leads/{id}` | Delete lead |
| POST | `/api/leads/{id}/convert` | Convert lead |
| GET | `/api/leads/{id}/duplicates` | Check duplicates |
| GET/POST/PUT/DELETE | `/api/contacts` | Contacts CRUD |
| GET/POST/PUT/DELETE | `/api/customers` | Customers CRUD |
| POST | `/api/customers/{id}/contacts` | Link contact |
| DELETE | `/api/customers/{id}/contacts/{contactId}` | Unlink contact |
| GET/POST/PUT/DELETE | `/api/opportunities` | Opportunities CRUD |
| GET/POST/PUT/DELETE | `/api/activities` | Activities CRUD |

### Sales
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/quotations` | Quotations CRUD |
| POST | `/api/quotations/{id}/duplicate` | Duplicate quotation |
| GET/POST/PUT/DELETE | `/api/sales-orders` | Sales Orders CRUD |
| GET/POST/PUT/DELETE | `/api/deliveries` | Deliveries CRUD |
| GET/POST/PUT/DELETE | `/api/invoices` | Invoices CRUD |
| POST | `/api/invoices/{id}/duplicate` | Duplicate invoice |

### Purchase
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/vendors` | Vendors CRUD |
| GET/POST/PUT/DELETE | `/api/purchase-requests` | Purchase Requests CRUD |
| GET/POST/PUT/DELETE | `/api/purchase-orders` | Purchase Orders CRUD |
| GET/POST/PUT/DELETE | `/api/goods-receipts` | Goods Receipts CRUD |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/products` | Products CRUD |
| GET/POST/PUT/DELETE | `/api/warehouses` | Warehouses CRUD |
| GET | `/api/stock-levels` | Stock levels (filterable) |
| GET | `/api/stock-movements` | Movement history |
| GET/POST/PUT/DELETE | `/api/stock-adjustments` | Adjustments CRUD |
| POST | `/api/stock-adjustments/{id}/approve` | Approve adjustment |
| GET/POST/PUT/DELETE | `/api/stock-transfers` | Transfers CRUD |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/projects` | Projects CRUD |
| GET | `/api/projects/{id}` | Full project with tasks/milestones/logs |
| GET/POST/PUT/DELETE | `/api/tasks` | Tasks CRUD |
| PATCH | `/api/tasks/{id}/status` | Update task status (Kanban drag) |
| PATCH | `/api/tasks/reorder` | Reorder tasks (sort_order) |
| GET/POST/PUT/DELETE | `/api/milestones` | Milestones CRUD |
| GET/POST/PUT/DELETE | `/api/time-logs` | Time Logs CRUD |
| POST | `/api/time-logs/start` | Start timer |
| POST | `/api/time-logs/{id}/stop` | Stop timer |

### HR
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/employees` | Employees CRUD |
| GET/POST/PUT/DELETE | `/api/departments` | Departments CRUD |
| GET/POST/PUT/DELETE | `/api/attendance` | Attendance CRUD |
| GET/POST/PUT/DELETE | `/api/leave-requests` | Leave Requests CRUD |
| POST | `/api/leave-requests/{id}/approve` | Approve leave |
| POST | `/api/leave-requests/{id}/reject` | Reject leave |
| GET | `/api/leave-requests/calculate-days` | Calculate working days |
| GET/POST/PUT/DELETE | `/api/holiday-lists` | Holiday Lists CRUD |
| GET/POST/PUT/DELETE | `/api/payroll-runs` | Payroll Runs CRUD |
| POST | `/api/payroll-runs/{id}/generate-slips` | Auto-generate slips |
| GET/POST/PUT/DELETE | `/api/performance-reviews` | Reviews CRUD |
| GET/POST/PUT/DELETE | `/api/expense-claims` | Expense Claims CRUD |
| POST | `/api/expense-claims/{id}/approve` | Approve claim |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/documents` | Documents CRUD |
| POST | `/api/documents/{id}/attachments` | Upload attachment |
| GET | `/api/documents/{id}/attachments/{aid}/download` | Download file |
| DELETE | `/api/documents/{id}/attachments/{aid}` | Delete attachment |

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/tickets` | Tickets CRUD |
| GET | `/api/tickets/{id}` | Full ticket with comments |
| POST | `/api/tickets/{id}/comments` | Add comment |
| DELETE | `/api/tickets/{id}/comments/{cid}` | Delete comment |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/settings/organization` | Organization settings |
| GET/POST/PUT/DELETE | `/api/settings/master-data/{type}` | Master data CRUD |
| GET | `/api/settings/master-data/types` | List all master data types |
| GET/PUT | `/api/team/members` | Team member management |
| GET/PUT | `/api/team/roles` | Role permission management |

### Utility
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/numbering/peek/{entity}` | Preview next number |
| GET | `/api/countries` | Countries list |
| GET | `/api/currencies` | Currencies list |
| GET | `/api/languages` | Languages list |

---

## Frontend Pages (Next.js App Router)

### Layout Structure

```
app/
├── (auth)/
│   ├── login/
│   └── register/
├── (dashboard)/
│   ├── layout.tsx          ← Sidebar + TopNav + Content area
│   ├── page.tsx            ← Dashboard
│   ├── crm/
│   │   ├── leads/
│   │   │   ├── page.tsx        ← LeadIndex
│   │   │   ├── new/page.tsx    ← LeadForm (create)
│   │   │   ├── [id]/edit/page.tsx ← LeadForm (edit)
│   │   │   └── [id]/convert/page.tsx ← LeadConvert wizard
│   │   ├── contacts/
│   │   ├── customers/
│   │   ├── opportunities/
│   │   └── activities/
│   ├── sales/
│   │   ├── quotations/
│   │   ├── sales-orders/
│   │   ├── deliveries/
│   │   └── invoices/
│   ├── purchase/
│   │   ├── vendors/
│   │   ├── purchase-requests/
│   │   ├── purchase-orders/
│   │   └── goods-receipts/
│   ├── inventory/
│   │   ├── products/
│   │   ├── warehouses/
│   │   ├── stock-levels/
│   │   ├── stock-movements/
│   │   ├── stock-adjustments/
│   │   └── stock-transfers/
│   ├── projects/
│   │   ├── page.tsx            ← ProjectIndex
│   │   ├── [id]/page.tsx       ← ProjectShow (Kanban + tabs)
│   │   ├── tasks/
│   │   ├── milestones/
│   │   └── time-logs/
│   ├── hr/
│   │   ├── employees/
│   │   ├── departments/
│   │   ├── attendance/
│   │   ├── leave-requests/
│   │   ├── holiday-lists/
│   │   ├── payroll/
│   │   ├── performance-reviews/
│   │   └── expense-claims/
│   ├── documents/
│   ├── tickets/
│   │   ├── page.tsx            ← TicketIndex
│   │   └── [id]/page.tsx       ← TicketShow (comments + sidebar)
│   └── settings/
│       ├── organization/
│       ├── master-data/
│       ├── team-members/
│       └── team-roles/
```

### Dashboard Page

**Stats widgets** (permission-gated):
- Total Customers, Active Leads, Open Orders, Active Projects, Employees, Open Tickets

**Recent lists:**
- 5 most recent leads with status badge
- 5 most recent sales orders with amount

**Quick access shortcuts** (permission-gated):
- New Lead, New Quote, New Order, Products, Projects, Employees

### Reusable UI Components (shadcn/ui based)

| Component | shadcn/ui Base | Features |
|-----------|---------------|----------|
| `DataTable` | `Table` + `Command` | Pagination, column visibility toggle, sorting, search, filters, grid/list view toggle, empty state |
| `PageHeader` | Custom | Title, breadcrumbs, create button |
| `FilterBar` | `Input` + `Select` | Search input + filter dropdowns |
| `ActionMenu` | `DropdownMenu` | Edit, delete, custom actions |
| `DeleteDialog` | `AlertDialog` | Confirmation with danger styling |
| `SlideOverForm` | `Sheet` | Side panel form for create/edit |
| `StatusBadge` | `Badge` | Color-coded status display |
| `TabNav` | `Tabs` | Tab navigation for multi-section forms |
| `StatCard` | `Card` | Dashboard stat display |
| `EmptyState` | Custom | Illustrated empty state with CTA |
| `FileUpload` | Custom + `Input` | Drag-and-drop, file type validation, preview |
| `KanbanBoard` | Custom | Drag-and-drop columns with cards |
| `LineItemEditor` | Custom | Dynamic add/remove rows with calculations |
| `TimerWidget` | Custom | Start/stop timer with display |

### Badge Color Variants

```
green, blue, yellow, red, gray, indigo, purple, cyan, orange, pink
```

### Form Patterns

**Standard Index Page:**
- Search bar + filter dropdowns
- Data table with sortable columns
- Pagination (10, 15, 25, 50 per page)
- Grid/list view toggle
- Action menu per row (edit, delete)
- Permission-gated create button

**Standard Form Page:**
- Tabbed sections for complex entities
- Auto-generated document number (peek on load, commit on save)
- Dropdowns for master data (ordered by sort_order, name)
- Dynamic line items (quotations, invoices, POs, etc.)
- Real-time calculation of totals
- Validation with inline error messages

**Slide-over Form:**
- Used for simpler CRUD (contacts, activities)
- Side panel overlay

---

## Multi-Currency Handling

- All monetary transactions store: `amount`, `currency_id`, `exchange_rate`
- Always preserve original currency — never convert and overwrite
- Customer has a default `currency_id`
- Product has a default `selling_price` + `currency_id`
- Exchange rates tracked in `exchange_rates` table with `effective_date`
- All decimal money fields: `decimal(18,4)`
- Exchange rate fields: `decimal(18,8)`

---

## Custom Fields System

Models supporting custom fields: Customer, Lead, Employee, Product, Invoice, Quotation, Ticket, Opportunity, Sales Order, Purchase Order

**Storage:** JSONB column `custom_fields` default `{}`

**API:**
```python
# Get
value = record.custom_fields.get("region", "default")

# Set
record.custom_fields["region"] = "APAC"

# Remove
del record.custom_fields["region"]
```

---

## File Storage (MinIO)

**Buckets:**
- `logos` — Company logos, icons
- `letterheads` — Company letterhead images
- `signatures` — Signatory signature images
- `attachments` — Document attachments
- `receipts` — Expense claim receipts
- `ticket-attachments` — Ticket file attachments

**File paths stored in DB** as MinIO object keys. Serve via signed URLs or proxy endpoint.

---

## Scheduled Jobs (Celery Beat)

| Job | Schedule | Description |
|-----|----------|-------------|
| `process_recurring_invoices` | Daily | Generate invoices from recurring templates |
| `process_recurring_tasks` | Daily | Generate tasks from recurring templates |

---

## Globalization Rules

1. **Never hardcode** currency, tax rate, country, units, or industry-specific fields
2. All must come from configuration tables or Organization Settings
3. Multi-currency: preserve original currency + exchange_rate on every transaction
4. Date format: configurable via `default_date_format`
5. Number format: configurable via `default_number_format`
6. Language direction: support LTR and RTL
7. Tax system: pluggable via tax_regions + tax_types (supports GST, VAT, Sales Tax, etc.)

---

## Key Business Rules

1. **Tenant isolation:** Every query MUST filter by tenant_id. No cross-tenant data access.
2. **Document numbering:** peek on form load, commit on save. Never skip numbers.
3. **Stock updates:** Only triggered by deliveries (out), goods receipts (in), adjustments, and transfers.
4. **Approval workflows:** Leave requests, expense claims, stock adjustments require approval.
5. **Lead conversion:** One-time only. Cannot re-convert. Creates linked contact + customer + opportunity.
6. **Recurring records:** Template records (parent) generate child records. Children link back via parent_id.
7. **Holiday-aware leave:** Days exclude weekends + holidays from employee's holiday list hierarchy.
8. **Master data ordering:** All dropdowns use `ORDER BY sort_order, name`.
9. **Polymorphic relations:** Activities and Documents can attach to any entity type.
10. **Cascade deletes:** Parent deletion cascades to child items (invoice → invoice_items, etc.).

---

## Redis Usage

| Use Case | Key Pattern | TTL |
|----------|-------------|-----|
| Session cache | `session:{session_id}` | 24h |
| User permissions cache | `perms:{tenant_id}:{user_id}` | 1h |
| Organization settings cache | `org_settings:{tenant_id}` | 1h |
| Master data cache | `master:{tenant_id}:{type}` | 1h |
| Rate limiting | `rate:{ip}:{endpoint}` | 1min |
| Background job queue | Celery broker | — |

---

## Summary: Table Count by Module

| Module | Tables |
|--------|--------|
| Auth & Tenancy | 3 (users, tenants, tenant_users) |
| Roles & Permissions | 4 (roles, permissions, role_permissions, user_roles) |
| Global Master | 7 (countries, currencies, languages, translations, exchange_rates, gst_states, units_of_measure) |
| Tenant Master Data | 17 (product_categories, product_brands, states, cities, lead_sources, lead_statuses, opportunity_stages, activity_types, task_statuses, ticket_statuses, ticket_priorities, ticket_categories, document_categories, salutations, leave_types, tax_regions, tax_types) |
| Settings | 1 (organization_settings) |
| CRM | 6 (leads, contacts, customers, customer_contacts, opportunities, activities) |
| Sales | 8 (quotations, quotation_items, sales_orders, sales_order_items, deliveries, delivery_items, invoices, invoice_items) |
| Purchase | 6 (vendors, purchase_requests, purchase_orders, purchase_order_items, goods_receipts, goods_receipt_items) |
| Inventory | 8 (products, product_variants, warehouses, stock_movements, stock_levels, stock_adjustments, stock_adjustment_items, stock_transfers, stock_transfer_items) |
| Projects | 4 (projects, milestones, tasks, time_logs) |
| HR | 12 (employees, departments, designations, attendance, leave_requests, holiday_lists, holidays, payroll_structures, payroll_runs, payroll_slips, performance_reviews, review_goals, expense_claims, expense_claim_items) |
| Documents | 2 (documents, attachments) |
| Tickets | 3 (tickets, ticket_comments, ticket_attachments) |
| **Total** | **~81 tables** |

