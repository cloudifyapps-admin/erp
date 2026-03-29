# Import all models so Alembic and SQLAlchemy can discover them
from app.models.global_models import User, Tenant, TenantUser, TeamInvitation, Country, Currency, Language, Translation, ExchangeRate, GstState
from app.models.tenant_models import (
    Role, Permission, RolePermission, UserRole, OrganizationSettings,
    UnitOfMeasure, TaxRegion, TaxType, ProductCategory, ProductBrand,
    LeadSource, LeadStatus, OpportunityStage, ActivityType, TaskStatus,
    TicketStatus, TicketPriority, TicketCategory, DocumentCategory,
    Salutation, LeaveType,
    Industry, CustomerRating, LostReason, Competitor, Territory, Campaign,
    ProjectCategory, TaskLabel, CostCategory, RiskCategory,
)
from app.models.crm import (
    Lead, Contact, Customer, CustomerContact, Opportunity, Activity,
    OpportunityCompetitor, OpportunityProduct,
    Tag, EntityTag, Note, AuditLog,
    EmailTemplate, LeadScoringRule, WebForm,
)
from app.models.sales import Quotation, QuotationItem, SalesOrder, SalesOrderItem, Delivery, DeliveryItem, Invoice, InvoiceItem
from app.models.purchase import Vendor, PurchaseRequest, PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem
from app.models.inventory import Product, ProductVariant, Warehouse, StockMovement, StockLevel, StockAdjustment, StockAdjustmentItem, StockTransfer, StockTransferItem
from app.models.projects import (
    Project, Milestone, Task, TimeLog,
    TaskDependency, TaskChecklist, TaskLabelAssignment, TaskComment,
    TaskAttachment, TaskWatcher, ProjectMember, ProjectComment,
    ProjectAttachment, ProjectTemplate, ProjectPhase, ResourceAllocation,
    UserSkill, ProjectExpense, ProjectBudgetLine, BillingRate,
    ProjectInvoice, ProjectRisk, ProjectIssue, ChangeRequest,
    StatusReport, MeetingNote,
)
from app.models.hr import (
    Employee, Department, Designation, Attendance, LeaveRequest,
    HolidayList, Holiday, PayrollStructure, PayrollRun, PayrollSlip,
    PerformanceReview, ReviewGoal, ExpenseClaim, ExpenseClaimItem,
)
from app.models.documents import Document, Attachment
from app.models.tickets import Ticket, TicketComment, TicketAttachment
