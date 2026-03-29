'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, FileText, DollarSign, Info, BarChart3, Plus, X } from 'lucide-react'
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

interface CampaignForm {
  name: string
  type: string
  status: string
  start_date: string
  end_date: string
  description: string
  budget: string
  actual_cost: string
  expected_revenue: string
}

interface CustomField {
  id: string
  key: string
  value: string
}

interface CampaignStats {
  leads_count: number
  opportunities_count: number
  pipeline_value: number
}

const INITIAL: CampaignForm = {
  name: '',
  type: 'email',
  status: 'draft',
  start_date: '',
  end_date: '',
  description: '',
  budget: '',
  actual_cost: '',
  expected_revenue: '',
}

const TYPE_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'event', label: 'Event' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'advertising', label: 'Advertising' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'other', label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
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

/* ── Stat card for performance tab ──────────────────────────────────── */
function StatCard({
  label,
  value,
  format = 'number',
}: {
  label: string
  value: number
  format?: 'number' | 'currency'
}) {
  const formatted =
    format === 'currency'
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(value)
      : value.toLocaleString()

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-5">
      <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{formatted}</p>
    </div>
  )
}

export default function EditCampaignPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [form, setForm] = useState<CampaignForm>(INITIAL)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof CampaignForm, string>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [stats, setStats] = useState<CampaignStats>({
    leads_count: 0,
    opportunities_count: 0,
    pipeline_value: 0,
  })

  useEffect(() => {
    api
      .get(`/crm/campaigns/${id}`)
      .then(({ data }) => {
        setForm({
          name: data.name ?? '',
          type: data.type ?? 'email',
          status: data.status ?? 'draft',
          start_date: data.start_date ? data.start_date.slice(0, 10) : '',
          end_date: data.end_date ? data.end_date.slice(0, 10) : '',
          description: data.description ?? '',
          budget: data.budget != null ? String(data.budget) : '',
          actual_cost: data.actual_cost != null ? String(data.actual_cost) : '',
          expected_revenue: data.expected_revenue != null ? String(data.expected_revenue) : '',
        })
        // Load existing custom fields
        if (data.custom_fields && typeof data.custom_fields === 'object') {
          const existing = Object.entries(data.custom_fields).map(([key, value]) => ({
            id: crypto.randomUUID(),
            key,
            value: String(value),
          }))
          setCustomFields(existing)
        }
        // Load performance stats
        setStats({
          leads_count: data.leads_count ?? 0,
          opportunities_count: data.opportunities_count ?? 0,
          pipeline_value: data.pipeline_value ?? 0,
        })
      })
      .catch(() => toast.error('Failed to load campaign'))
      .finally(() => setLoadingData(false))
  }, [id])

  const set =
    (key: keyof CampaignForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((e) => ({ ...e, [key]: undefined }))
    }

  const setSelect = (key: keyof CampaignForm) => (value: string) => {
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
    const errs: Partial<Record<keyof CampaignForm, string>> = {}
    if (!form.name.trim()) errs.name = 'Campaign name is required'
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      errs.end_date = 'End date must be after start date'
    }
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
        budget: form.budget ? parseFloat(form.budget) : null,
        actual_cost: form.actual_cost ? parseFloat(form.actual_cost) : null,
        expected_revenue: form.expected_revenue ? parseFloat(form.expected_revenue) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        custom_fields: Object.keys(customData).length > 0 ? customData : null,
      }
      await api.put(`/crm/campaigns/${id}`, payload)
      toast.success('Campaign updated successfully')
      router.push('/crm/campaigns')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to update campaign'
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
        title="Edit Campaign"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Campaigns', href: '/crm/campaigns' },
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
              form="campaign-form"
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

      <form id="campaign-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <FileText className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="budget" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <DollarSign className="h-[18px] w-[18px]" />
                  Budget
                </TabsTrigger>
                <TabsTrigger value="additional" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Info className="h-[18px] w-[18px]" />
                  Additional Information
                </TabsTrigger>
                <TabsTrigger value="performance" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <BarChart3 className="h-[18px] w-[18px]" />
                  Performance
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Details */}
            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Campaign Name" required error={errors.name}>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Spring 2026 Email Blast"
                  aria-invalid={!!errors.name}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Type">
                <Select value={form.type} onValueChange={setSelect('type')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => (
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
              <FormRow label="Start Date">
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={set('start_date')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="End Date" error={errors.end_date}>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={set('end_date')}
                  aria-invalid={!!errors.end_date}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Description">
                <Textarea
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Describe the campaign objectives and strategy..."
                  rows={4}
                  className="resize-none"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Budget */}
            <TabsContent value="budget" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Budget">
                <Input
                  id="budget"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.budget}
                  onChange={set('budget')}
                  placeholder="0.00"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Actual Cost">
                <Input
                  id="actual_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.actual_cost}
                  onChange={set('actual_cost')}
                  placeholder="0.00"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Expected Revenue">
                <Input
                  id="expected_revenue"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.expected_revenue}
                  onChange={set('expected_revenue')}
                  placeholder="0.00"
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Additional Information — dynamic key-value pairs */}
            <TabsContent value="additional" className="p-6 lg:px-8 lg:py-2">
              <div className="pt-1 pb-2 flex items-center justify-between">
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

            {/* Tab: Performance — read-only stats */}
            <TabsContent value="performance" className="p-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Leads Generated" value={stats.leads_count} />
                <StatCard label="Opportunities Created" value={stats.opportunities_count} />
                <StatCard label="Pipeline Value" value={stats.pipeline_value} format="currency" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
