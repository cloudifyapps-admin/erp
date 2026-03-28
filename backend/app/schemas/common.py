from pydantic import BaseModel
from typing import Optional, Any, Generic, TypeVar
from datetime import datetime

T = TypeVar("T")


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    per_page: int
    pages: int


class MessageResponse(BaseModel):
    message: str


class IdResponse(BaseModel):
    id: int


# CRM Schemas
class LeadCreate(BaseModel):
    title: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country_id: Optional[int] = None
    source: Optional[str] = None
    status: Optional[str] = "new"
    assigned_to: Optional[int] = None
    notes: Optional[str] = None
    salutation_id: Optional[int] = None
    custom_fields: Optional[dict] = {}


class LeadUpdate(LeadCreate):
    title: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class LeadResponse(BaseModel):
    id: int
    tenant_id: int
    title: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    notes: Optional[str] = None
    custom_fields: Optional[dict] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    salutation_id: Optional[int] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country_id: Optional[int] = None
    custom_fields: Optional[dict] = {}


class ContactUpdate(ContactCreate):
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class ContactResponse(BaseModel):
    id: int
    tenant_id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CustomerCreate(BaseModel):
    name: str
    code: Optional[str] = None
    type: str = "company"
    company_name: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None
    billing_attention: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country_id: Optional[int] = None
    billing_phone: Optional[str] = None
    shipping_attention: Optional[str] = None
    shipping_address_line_1: Optional[str] = None
    shipping_address_line_2: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_postal_code: Optional[str] = None
    shipping_country_id: Optional[int] = None
    shipping_phone: Optional[str] = None
    currency_id: Optional[int] = None
    language_id: Optional[int] = None
    status: Optional[str] = "active"
    custom_fields: Optional[dict] = {}


class CustomerUpdate(CustomerCreate):
    name: Optional[str] = None
    type: Optional[str] = None


class CustomerResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    code: str
    type: str
    company_name: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Generic for all modules
class GenericCreate(BaseModel):
    class Config:
        extra = "allow"


class GenericUpdate(BaseModel):
    class Config:
        extra = "allow"
