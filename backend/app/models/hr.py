from sqlalchemy import Column, Integer, String, Boolean, Text, Date, DateTime, Time, ForeignKey, Numeric, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
from app.models.base import TenantMixin, TimestampMixin


class Employee(TenantMixin, Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    employee_id = Column(String(50), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    designation_id = Column(Integer, ForeignKey("designations.id"), nullable=True)
    holiday_list_id = Column(Integer, ForeignKey("holiday_lists.id"), nullable=True)
    reports_to = Column(Integer, ForeignKey("employees.id"), nullable=True)
    joining_date = Column(Date, nullable=True)
    leaving_date = Column(Date, nullable=True)
    employment_type = Column(String(20), default="full_time")
    status = Column(String(20), default="active")
    custom_fields = Column(JSONB, server_default='{}')

    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", name="uq_employee_id"),
    )


class Department(TenantMixin, Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    parent_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    head_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_department_code"),
    )


class Designation(TenantMixin, Base):
    __tablename__ = "designations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    level = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)


class Attendance(TenantMixin, Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(Time, nullable=True)
    check_out = Column(Time, nullable=True)
    status = Column(String(20), nullable=False)
    worked_hours = Column(Numeric(8, 2), nullable=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_attendance_employee_date"),
    )


class LeaveRequest(TenantMixin, Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=True)
    type = Column(String(50), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days = Column(Numeric(5, 1), nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_leave_request_number"),
        Index("ix_leave_requests_tenant_emp_status", "tenant_id", "employee_id", "status"),
    )


class HolidayList(TenantMixin, Base):
    __tablename__ = "holiday_lists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    fiscal_year_start = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)


class Holiday(TenantMixin, Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    holiday_list_id = Column(Integer, ForeignKey("holiday_lists.id", ondelete="CASCADE"), nullable=False)
    holiday_date = Column(Date, nullable=False)
    name = Column(String(255), nullable=False)
    holiday_type = Column(String(50), nullable=True)


class PayrollStructure(TenantMixin, Base):
    __tablename__ = "payroll_structures"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    components = Column(JSONB, nullable=False)


class PayrollRun(TenantMixin, Base):
    __tablename__ = "payroll_runs"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    status = Column(String(20), default="draft")
    total_gross = Column(Numeric(15, 2), default=0)
    total_deductions = Column(Numeric(15, 2), default=0)
    total_net = Column(Numeric(15, 2), default=0)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    processed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_payroll_run_number"),
        UniqueConstraint("tenant_id", "year", "month", name="uq_payroll_run_period"),
    )


class PayrollSlip(TenantMixin, Base):
    __tablename__ = "payroll_slips"

    id = Column(Integer, primary_key=True, index=True)
    payroll_run_id = Column(Integer, ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    basic_salary = Column(Numeric(15, 2), default=0)
    gross_salary = Column(Numeric(15, 2), default=0)
    total_deductions = Column(Numeric(15, 2), default=0)
    net_salary = Column(Numeric(15, 2), default=0)
    earnings = Column(JSONB, server_default='{}')
    deductions = Column(JSONB, server_default='{}')
    working_days = Column(Numeric(5, 1), default=0)
    days_worked = Column(Numeric(5, 1), default=0)
    leave_days = Column(Numeric(5, 1), default=0)
    status = Column(String(20), default="draft")
    payment_date = Column(Date, nullable=True)
    payment_method = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("payroll_run_id", "employee_id", name="uq_payroll_slip_employee"),
    )


class PerformanceReview(TenantMixin, Base):
    __tablename__ = "performance_reviews"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_period = Column(String(100), nullable=True)
    type = Column(String(20), nullable=False)
    review_date = Column(Date, nullable=True)
    overall_rating = Column(Numeric(3, 1), nullable=True)
    strengths = Column(Text, nullable=True)
    improvements = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)
    status = Column(String(20), default="draft")
    acknowledged_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_performance_review_number"),
        Index("ix_perf_reviews_tenant_emp_status", "tenant_id", "employee_id", "status"),
    )


class ReviewGoal(TenantMixin, Base):
    __tablename__ = "review_goals"

    id = Column(Integer, primary_key=True, index=True)
    performance_review_id = Column(Integer, ForeignKey("performance_reviews.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    weight = Column(Numeric(5, 2), nullable=True)
    rating = Column(Numeric(3, 1), nullable=True)
    employee_comment = Column(Text, nullable=True)
    reviewer_comment = Column(Text, nullable=True)


class ExpenseClaim(TenantMixin, Base):
    __tablename__ = "expense_claims"

    id = Column(Integer, primary_key=True, index=True)
    claim_number = Column(String(50), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    expense_date = Column(Date, nullable=False)
    total_amount = Column(Numeric(15, 2), default=0)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    status = Column(String(20), default="draft")
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    payment_date = Column(Date, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "claim_number", name="uq_expense_claim_number"),
        Index("ix_expense_claims_tenant_emp_status", "tenant_id", "employee_id", "status"),
    )


class ExpenseClaimItem(TenantMixin, Base):
    __tablename__ = "expense_claim_items"

    id = Column(Integer, primary_key=True, index=True)
    expense_claim_id = Column(Integer, ForeignKey("expense_claims.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    date = Column(Date, nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    has_receipt = Column(Boolean, default=False)
