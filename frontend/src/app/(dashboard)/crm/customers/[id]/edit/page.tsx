'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { User, MapPin, Truck, Settings as SettingsIcon, Info, FileText, Plus, X, Loader2, Clock } from 'lucide-react'
import { AuditTimeline } from '@/components/shared/audit-timeline'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

interface CustomerForm {
  // Details
  code: string
  name: string
  type: string
  email: string
  phone: string
  mobile: string
  website: string
  tax_id: string
  status: string
  notes: string
  // Billing
  billing_address: string
  billing_city: string
  billing_state: string
  billing_postal_code: string
  billing_country: string
  // Shipping
  shipping_address: string
  shipping_city: string
  shipping_state: string
  shipping_postal_code: string
  shipping_country: string
  // Classification
  industry_id: string
  rating_id: string
  territory_id: string
  annual_revenue: string
  employee_count: string
  // Settings
  currency: string
  payment_terms: string
  credit_limit: string
  price_list: string
}

interface MasterDataOption {
  id: number
  name: string
}

interface CustomField {
  id: string
  key: string
  value: string
}

const INITIAL: CustomerForm = {
  code: '',
  name: '',
  type: 'company',
  email: '',
  phone: '',
  mobile: '',
  website: '',
  tax_id: '',
  status: 'active',
  notes: '',
  billing_address: '',
  billing_city: '',
  billing_state: '',
  billing_postal_code: '',
  billing_country: '',
  shipping_address: '',
  shipping_city: '',
  shipping_state: '',
  shipping_postal_code: '',
  shipping_country: '',
  industry_id: '',
  rating_id: '',
  territory_id: '',
  annual_revenue: '',
  employee_count: '',
  currency: 'USD',
  payment_terms: 'net30',
  credit_limit: '',
  price_list: '',
}

/* ── Reusable key-value row ─────────────────────────────────────────── */
function FormRow({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4 py-3.5 border-b border-border/30 last:border-b-0">
      <Label className="pt-2.5 text-[13px] font-medium text-muted-foreground leading-tight">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="flex flex-col gap-1">
        {children}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    </div>
  )
}

export default function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<CustomerForm>(INITIAL)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerForm, string>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [industries, setIndustries] = useState<MasterDataOption[]>([])
  const [ratings, setRatings] = useState<MasterDataOption[]>([])
  const [territories, setTerritories] = useState<MasterDataOption[]>([])

  useEffect(() => {
    api.get('/settings/master-data/industries').then(({ data }) => setIndustries(data.items ?? [])).catch(() => {})
    api.get('/settings/master-data/customer-ratings').then(({ data }) => setRatings(data.items ?? [])).catch(() => {})
    api.get('/settings/master-data/territories').then(({ data }) => setTerritories(data.items ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    api
      .get(`/crm/customers/${id}`)
      .then(({ data }) => {
        setForm({
          code: data.code ?? '',
          name: data.name ?? '',
          type: data.type ?? 'company',
          email: data.email ?? '',
          phone: data.phone ?? '',
          mobile: data.mobile ?? '',
          website: data.website ?? '',
          tax_id: data.tax_id ?? '',
          status: data.status ?? 'active',
          notes: data.notes ?? '',
          billing_address: data.billing_address ?? '',
          billing_city: data.billing_city ?? '',
          billing_state: data.billing_state ?? '',
          billing_postal_code: data.billing_postal_code ?? '',
          billing_country: data.billing_country ?? '',
          shipping_address: data.shipping_address ?? '',
          shipping_city: data.shipping_city ?? '',
          shipping_state: data.shipping_state ?? '',
          shipping_postal_code: data.shipping_postal_code ?? '',
          shipping_country: data.shipping_country ?? '',
          industry_id: data.industry_id != null ? String(data.industry_id) : '',
          rating_id: data.rating_id != null ? String(data.rating_id) : '',
          territory_id: data.territory_id != null ? String(data.territory_id) : '',
          annual_revenue: data.annual_revenue != null ? String(data.annual_revenue) : '',
          employee_count: data.employee_count != null ? String(data.employee_count) : '',
          currency: data.currency ?? 'USD',
          payment_terms: data.payment_terms ?? 'net30',
          credit_limit: data.credit_limit != null ? String(data.credit_limit) : '',
          price_list: data.price_list ?? '',
        })
        if (data.custom_fields && typeof data.custom_fields === 'object') {
          const existing = Object.entries(data.custom_fields).map(([key, value]) => ({
            id: crypto.randomUUID(),
            key,
            value: String(value),
          }))
          setCustomFields(existing)
        }
      })
      .catch(() => toast.error('Failed to load customer'))
      .finally(() => setLoadingData(false))
  }, [id])

  const set =
    (key: keyof CustomerForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((e) => ({ ...e, [key]: undefined }))
    }

  const setSelect = (key: keyof CustomerForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const copyBillingToShipping = () => {
    setForm((f) => ({
      ...f,
      shipping_address: f.billing_address,
      shipping_city: f.billing_city,
      shipping_state: f.billing_state,
      shipping_postal_code: f.billing_postal_code,
      shipping_country: f.billing_country,
    }))
  }

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      { id: crypto.randomUUID(), key: '', value: '' },
    ])
  }

  const updateCustomField = (id: string, field: 'key' | 'value', val: string) => {
    setCustomFields((prev) =>
      prev.map((cf) => (cf.id === id ? { ...cf, [field]: val } : cf))
    )
  }

  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((cf) => cf.id !== id))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof CustomerForm, string>> = {}
    if (!form.name.trim()) errs.name = 'Customer name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const customData: Record<string, string> = {}
      customFields.forEach((cf) => {
        if (cf.key.trim()) customData[cf.key.trim()] = cf.value
      })
      const payload = {
        ...form,
        industry_id: form.industry_id ? Number(form.industry_id) : null,
        rating_id: form.rating_id ? Number(form.rating_id) : null,
        territory_id: form.territory_id ? Number(form.territory_id) : null,
        annual_revenue: form.annual_revenue ? Number(form.annual_revenue) : null,
        employee_count: form.employee_count ? Number(form.employee_count) : null,
        credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
        custom_fields: Object.keys(customData).length > 0 ? customData : null,
      }
      await api.put(`/crm/customers/${id}`, payload)
      toast.success('Customer updated successfully')
      router.push('/crm/customers')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to update customer'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Edit Customer"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Customers', href: '/crm/customers' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg px-4 text-[13px]"
              onClick={() => router.back()}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="customer-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      <form id="customer-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <User className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="billing" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <MapPin className="h-[18px] w-[18px]" />
                  Billing Address
                </TabsTrigger>
                <TabsTrigger value="shipping" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Truck className="h-[18px] w-[18px]" />
                  Shipping Address
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <SettingsIcon className="h-[18px] w-[18px]" />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="additional" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Info className="h-[18px] w-[18px]" />
                  Additional Information
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <FileText className="h-[18px] w-[18px]" />
                  Notes
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Clock className="h-[18px] w-[18px]" />
                  Timeline
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Details */}
            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Customer Name" required error={errors.name}>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Acme Corporation"
                  aria-invalid={!!errors.name}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Customer Code">
                <Input
                  id="code"
                  value={form.code}
                  onChange={set('code')}
                  placeholder="CUST-0001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Type">
                <Select value={form.type} onValueChange={setSelect('type')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Status">
                <Select value={form.status} onValueChange={setSelect('status')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Email">
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="contact@acme.com"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Phone">
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+1 555 0100"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Mobile">
                <Input
                  id="mobile"
                  value={form.mobile}
                  onChange={set('mobile')}
                  placeholder="+1 555 0101"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Website">
                <Input
                  id="website"
                  value={form.website}
                  onChange={set('website')}
                  placeholder="https://acme.com"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Tax ID / VAT Number">
                <Input
                  id="tax_id"
                  value={form.tax_id}
                  onChange={set('tax_id')}
                  placeholder="12-3456789"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Industry">
                <Select value={form.industry_id} onValueChange={setSelect('industry_id')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Rating">
                <Select value={form.rating_id} onValueChange={setSelect('rating_id')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    {ratings.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Territory">
                <Select value={form.territory_id} onValueChange={setSelect('territory_id')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select territory" />
                  </SelectTrigger>
                  <SelectContent>
                    {territories.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Annual Revenue">
                <Input
                  id="annual_revenue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.annual_revenue}
                  onChange={set('annual_revenue')}
                  placeholder="1000000.00"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Employee Count">
                <Input
                  id="employee_count"
                  type="number"
                  min="0"
                  step="1"
                  value={form.employee_count}
                  onChange={set('employee_count')}
                  placeholder="50"
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Billing Address */}
            <TabsContent value="billing" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Street Address">
                <Input
                  id="billing_address"
                  value={form.billing_address}
                  onChange={set('billing_address')}
                  placeholder="123 Main St"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="City">
                <Input
                  id="billing_city"
                  value={form.billing_city}
                  onChange={set('billing_city')}
                  placeholder="New York"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="State / Province">
                <Input
                  id="billing_state"
                  value={form.billing_state}
                  onChange={set('billing_state')}
                  placeholder="NY"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Postal Code">
                <Input
                  id="billing_postal_code"
                  value={form.billing_postal_code}
                  onChange={set('billing_postal_code')}
                  placeholder="10001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Country">
                <Input
                  id="billing_country"
                  value={form.billing_country}
                  onChange={set('billing_country')}
                  placeholder="US"
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Shipping Address */}
            <TabsContent value="shipping" className="p-6 lg:px-8 lg:py-2">
              <div className="flex items-center justify-between pb-2">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Shipping Address</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-[12px]"
                  onClick={copyBillingToShipping}
                >
                  Copy from Billing
                </Button>
              </div>
              <FormRow label="Street Address">
                <Input
                  id="shipping_address"
                  value={form.shipping_address}
                  onChange={set('shipping_address')}
                  placeholder="456 Commerce Ave"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="City">
                <Input
                  id="shipping_city"
                  value={form.shipping_city}
                  onChange={set('shipping_city')}
                  placeholder="New York"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="State / Province">
                <Input
                  id="shipping_state"
                  value={form.shipping_state}
                  onChange={set('shipping_state')}
                  placeholder="NY"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Postal Code">
                <Input
                  id="shipping_postal_code"
                  value={form.shipping_postal_code}
                  onChange={set('shipping_postal_code')}
                  placeholder="10001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Country">
                <Input
                  id="shipping_country"
                  value={form.shipping_country}
                  onChange={set('shipping_country')}
                  placeholder="US"
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Settings */}
            <TabsContent value="settings" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Currency">
                <Select value={form.currency} onValueChange={setSelect('currency')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD – US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR – Euro</SelectItem>
                    <SelectItem value="GBP">GBP – British Pound</SelectItem>
                    <SelectItem value="INR">INR – Indian Rupee</SelectItem>
                    <SelectItem value="AED">AED – UAE Dirham</SelectItem>
                    <SelectItem value="JPY">JPY – Japanese Yen</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Payment Terms">
                <Select value={form.payment_terms} onValueChange={setSelect('payment_terms')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="net15">Net 15</SelectItem>
                    <SelectItem value="net30">Net 30</SelectItem>
                    <SelectItem value="net45">Net 45</SelectItem>
                    <SelectItem value="net60">Net 60</SelectItem>
                    <SelectItem value="net90">Net 90</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Credit Limit">
                <Input
                  id="credit_limit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.credit_limit}
                  onChange={set('credit_limit')}
                  placeholder="10000.00"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Price List">
                <Input
                  id="price_list"
                  value={form.price_list}
                  onChange={set('price_list')}
                  placeholder="Standard Retail"
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Additional Information — dynamic custom key-value fields */}
            <TabsContent value="additional" className="p-6 lg:px-8 lg:py-2">
              <div className="pt-2 pb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Custom Fields</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-[12px] gap-1.5"
                  onClick={addCustomField}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Field
                </Button>
              </div>

              {customFields.length === 0 && (
                <div className="py-6 text-center border border-dashed border-border/50 rounded-lg">
                  <p className="text-[13px] text-muted-foreground">No custom fields added yet.</p>
                  <p className="text-[12px] text-muted-foreground/60 mt-1">Click &quot;Add Field&quot; to add custom key-value data.</p>
                </div>
              )}

              {customFields.map((cf) => (
                <div
                  key={cf.id}
                  className="grid grid-cols-[180px_1fr_36px] items-center gap-4 py-3 border-b border-border/30 last:border-b-0"
                >
                  <Input
                    value={cf.key}
                    onChange={(e) => updateCustomField(cf.id, 'key', e.target.value)}
                    placeholder="Field name"
                    className="h-10 text-[13px] font-medium text-muted-foreground"
                  />
                  <Input
                    value={cf.value}
                    onChange={(e) => updateCustomField(cf.id, 'value', e.target.value)}
                    placeholder="Value"
                    className="h-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCustomField(cf.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </TabsContent>

            {/* Tab: Notes */}
            <TabsContent value="notes" className="p-6 lg:p-8">
              <Textarea
                value={form.notes}
                onChange={set('notes')}
                placeholder="Add any relevant notes about this customer..."
                rows={10}
                className="resize-none"
              />
            </TabsContent>

            {/* Tab: Timeline */}
            <TabsContent value="timeline" className="p-6 lg:px-8 lg:py-4">
              <AuditTimeline entityType="customers" entityId={Number(id)} />
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
