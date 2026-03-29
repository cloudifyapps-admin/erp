'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, User, Info, Tag, FileText, Plus, X, Target, Clock, ArrowRightCircle, CheckCircle2, Sparkles } from 'lucide-react'
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
import { AuditTimeline } from '@/components/shared/audit-timeline'

interface DropdownOption {
  id: number
  name: string
}

interface LeadForm {
  title: string
  first_name: string
  last_name: string
  email: string
  phone: string
  mobile: string
  company: string
  job_title: string
  source: string
  status: string
  assigned_to: string
  notes: string
  website: string
  industry: string
  annual_revenue: string
  number_of_employees: string
  industry_id: string
  rating_id: string
  campaign_id: string
  territory_id: string
  next_follow_up_at: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip_code: string
  country: string
}

interface CustomField {
  id: string
  key: string
  value: string
}

const INITIAL: LeadForm = {
  title: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  mobile: '',
  company: '',
  job_title: '',
  source: 'manual',
  status: 'new',
  assigned_to: '',
  notes: '',
  website: '',
  industry: '',
  annual_revenue: '',
  number_of_employees: '',
  industry_id: '',
  rating_id: '',
  campaign_id: '',
  territory_id: '',
  next_follow_up_at: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip_code: '',
  country: '',
}

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'email_campaign', label: 'Email Campaign' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'trade_show', label: 'Trade Show' },
  { value: 'other', label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
  { value: 'rejected', label: 'Rejected' },
]

const INDUSTRY_OPTIONS = [
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'education', label: 'Education' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'media', label: 'Media & Entertainment' },
  { value: 'other', label: 'Other' },
]

/* ── Reusable key-value row ─────────────────────────────────────────── */
function FormRow({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
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

export default function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<LeadForm>(INITIAL)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof LeadForm, string>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [leadScore, setLeadScore] = useState<number>(0)
  const [convertedAt, setConvertedAt] = useState<string | null>(null)
  const [industries, setIndustries] = useState<DropdownOption[]>([])
  const [ratings, setRatings] = useState<DropdownOption[]>([])
  const [campaigns, setCampaigns] = useState<DropdownOption[]>([])
  const [territories, setTerritories] = useState<DropdownOption[]>([])

  useEffect(() => {
    api.get('/settings/master-data/industries').then(({ data }) => setIndustries(data.items ?? [])).catch(() => {})
    api.get('/settings/master-data/customer-ratings').then(({ data }) => setRatings(data.items ?? [])).catch(() => {})
    api.get('/crm/campaigns').then(({ data }) => setCampaigns(data.items ?? [])).catch(() => {})
    api.get('/settings/master-data/territories').then(({ data }) => setTerritories(data.items ?? [])).catch(() => {})

    api
      .get(`/crm/leads/${id}`)
      .then(({ data }) => {
        setForm({
          title: data.title ?? '',
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          mobile: data.mobile ?? '',
          company: data.company ?? '',
          job_title: data.job_title ?? '',
          source: data.source ?? 'manual',
          status: data.status ?? 'new',
          assigned_to: data.assigned_to ? String(data.assigned_to) : '',
          notes: data.notes ?? '',
          website: data.website ?? '',
          industry: data.industry ?? '',
          annual_revenue: data.annual_revenue ? String(data.annual_revenue) : '',
          number_of_employees: data.number_of_employees ? String(data.number_of_employees) : '',
          industry_id: data.industry_id ? String(data.industry_id) : '',
          rating_id: data.rating_id ? String(data.rating_id) : '',
          campaign_id: data.campaign_id ? String(data.campaign_id) : '',
          territory_id: data.territory_id ? String(data.territory_id) : '',
          next_follow_up_at: data.next_follow_up_at ? data.next_follow_up_at.slice(0, 16) : '',
          address_line1: data.address_line1 ?? '',
          address_line2: data.address_line2 ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          zip_code: data.zip_code ?? '',
          country: data.country ?? '',
        })
        setLeadScore(data.lead_score ?? 0)
        setConvertedAt(data.converted_at ?? null)
        // Load existing custom fields
        if (data.custom_fields && typeof data.custom_fields === 'object') {
          const existing = Object.entries(data.custom_fields).map(([key, value]) => ({
            id: crypto.randomUUID(),
            key,
            value: String(value),
          }))
          setCustomFields(existing)
        }
      })
      .catch(() => toast.error('Failed to load lead'))
      .finally(() => setLoadingData(false))
  }, [id])

  const set =
    (key: keyof LeadForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((e) => ({ ...e, [key]: undefined }))
    }

  const setSelect = (key: keyof LeadForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
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
    const errs: Partial<Record<keyof LeadForm, string>> = {}
    if (!form.first_name.trim()) errs.first_name = 'First name is required'
    if (!form.last_name.trim()) errs.last_name = 'Last name is required'
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email'
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
        assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
        salutation_id: (form as unknown as Record<string, unknown>).salutation_id || null,
        country_id: (form as unknown as Record<string, unknown>).country_id || null,
        industry_id: form.industry_id ? parseInt(form.industry_id) : null,
        rating_id: form.rating_id ? parseInt(form.rating_id) : null,
        campaign_id: form.campaign_id ? parseInt(form.campaign_id) : null,
        territory_id: form.territory_id ? parseInt(form.territory_id) : null,
        annual_revenue: form.annual_revenue ? parseFloat(form.annual_revenue) : null,
        number_of_employees: form.number_of_employees ? parseInt(form.number_of_employees) : null,
        next_follow_up_at: form.next_follow_up_at || null,
        custom_fields: Object.keys(customData).length > 0 ? customData : null,
      }
      await api.put(`/crm/leads/${id}`, payload)
      toast.success('Lead updated successfully')
      router.push('/crm/leads')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to update lead'
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
        title="Edit Lead"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Leads', href: '/crm/leads' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* Lead Score Badge */}
            {leadScore > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                  leadScore >= 60
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : leadScore >= 30
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                Score: {leadScore}
              </span>
            )}
            {convertedAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Converted {new Date(convertedAt).toLocaleDateString()}
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg px-4 text-[13px] gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => router.push(`/crm/leads/${id}/convert`)}
              >
                <ArrowRightCircle className="h-3.5 w-3.5" />
                Convert Lead
              </Button>
            )}
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
              form="lead-form"
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

      <form id="lead-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <User className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="classification" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Tag className="h-[18px] w-[18px]" />
                  Classification
                </TabsTrigger>
                <TabsTrigger value="crm" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Target className="h-[18px] w-[18px]" />
                  CRM
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

            {/* Tab: Details — key-value rows */}
            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Lead Title / Reference">
                <Input
                  id="title"
                  value={form.title}
                  onChange={set('title')}
                  placeholder="Lead-0001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="First Name" required error={errors.first_name}>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={set('first_name')}
                  placeholder="John"
                  aria-invalid={!!errors.first_name}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Last Name" required error={errors.last_name}>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={set('last_name')}
                  placeholder="Doe"
                  aria-invalid={!!errors.last_name}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Email" error={errors.email}>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="john.doe@example.com"
                  aria-invalid={!!errors.email}
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
              <FormRow label="Company">
                <Input
                  id="company"
                  value={form.company}
                  onChange={set('company')}
                  placeholder="Acme Corp"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Job Title">
                <Input
                  id="job_title"
                  value={form.job_title}
                  onChange={set('job_title')}
                  placeholder="VP of Sales"
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Classification — key-value rows */}
            <TabsContent value="classification" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Source">
                <Select value={form.source} onValueChange={setSelect('source')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Status">
                <Select value={form.status} onValueChange={setSelect('status')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Assigned To">
                <Input
                  id="assigned_to"
                  value={form.assigned_to}
                  onChange={set('assigned_to')}
                  placeholder="User ID or name"
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: CRM — campaign, territory, rating, follow-up */}
            <TabsContent value="crm" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Industry">
                <Select value={form.industry_id} onValueChange={setSelect('industry_id')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.name}
                      </SelectItem>
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
                    {ratings.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Campaign">
                <Select value={form.campaign_id} onValueChange={setSelect('campaign_id')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.name}
                      </SelectItem>
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
                    {territories.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Next Follow Up">
                <Input
                  id="next_follow_up_at"
                  type="datetime-local"
                  value={form.next_follow_up_at}
                  onChange={set('next_follow_up_at')}
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Additional Information — fixed fields + dynamic key-value pairs */}
            <TabsContent value="additional" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Website">
                <Input
                  id="website"
                  value={form.website}
                  onChange={set('website')}
                  placeholder="https://example.com"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Industry">
                <Select value={form.industry} onValueChange={setSelect('industry')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Annual Revenue">
                <Input
                  id="annual_revenue"
                  type="number"
                  value={form.annual_revenue}
                  onChange={set('annual_revenue')}
                  placeholder="0.00"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="No. of Employees">
                <Input
                  id="number_of_employees"
                  type="number"
                  value={form.number_of_employees}
                  onChange={set('number_of_employees')}
                  placeholder="e.g. 50"
                  className="h-10"
                />
              </FormRow>

              <div className="pt-4 pb-2">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Address</p>
              </div>

              <FormRow label="Address Line 1">
                <Input
                  id="address_line1"
                  value={form.address_line1}
                  onChange={set('address_line1')}
                  placeholder="123 Main Street"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Address Line 2">
                <Input
                  id="address_line2"
                  value={form.address_line2}
                  onChange={set('address_line2')}
                  placeholder="Suite 100"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="City">
                <Input
                  id="city"
                  value={form.city}
                  onChange={set('city')}
                  placeholder="New York"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="State / Province">
                <Input
                  id="state"
                  value={form.state}
                  onChange={set('state')}
                  placeholder="NY"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="ZIP / Postal Code">
                <Input
                  id="zip_code"
                  value={form.zip_code}
                  onChange={set('zip_code')}
                  placeholder="10001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Country">
                <Input
                  id="country"
                  value={form.country}
                  onChange={set('country')}
                  placeholder="United States"
                  className="h-10"
                />
              </FormRow>

              {/* Dynamic custom key-value fields */}
              <div className="pt-5 pb-2 flex items-center justify-between">
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
                placeholder="Add any relevant notes about this lead..."
                rows={10}
                className="resize-none"
              />
            </TabsContent>

            {/* Tab: Timeline */}
            <TabsContent value="timeline" className="p-6 lg:p-8">
              <AuditTimeline entityType="leads" entityId={parseInt(id)} />
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
