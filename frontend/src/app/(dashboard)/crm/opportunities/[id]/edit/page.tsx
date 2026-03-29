'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, TrendingUp, Info, Tag, FileText, Plus, X, Clock } from 'lucide-react'
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

interface OpportunityForm {
  title: string
  contact_name: string
  company: string
  value: string
  currency: string
  expected_close_date: string
  stage: string
  probability: string
  source: string
  assigned_to: string
  notes: string
  campaign_id: string
  territory_id: string
  lost_reason_id: string
  lost_reason_detail: string
  next_follow_up_at: string
}

interface CustomField {
  id: string
  key: string
  value: string
}

const INITIAL: OpportunityForm = {
  title: '',
  contact_name: '',
  company: '',
  value: '',
  currency: 'USD',
  expected_close_date: '',
  stage: 'prospecting',
  probability: '',
  source: 'manual',
  assigned_to: '',
  notes: '',
  campaign_id: '',
  territory_id: '',
  lost_reason_id: '',
  lost_reason_detail: '',
  next_follow_up_at: '',
}

const STAGE_OPTIONS = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
]

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
]

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD – US Dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'GBP', label: 'GBP – British Pound' },
  { value: 'INR', label: 'INR – Indian Rupee' },
]

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

export default function EditOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<OpportunityForm>(INITIAL)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof OpportunityForm, string>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [campaigns, setCampaigns] = useState<DropdownOption[]>([])
  const [territories, setTerritories] = useState<DropdownOption[]>([])
  const [lostReasons, setLostReasons] = useState<DropdownOption[]>([])

  useEffect(() => {
    api.get('/crm/campaigns').then(({ data }) => setCampaigns(data.items ?? [])).catch(() => {})
    api.get('/settings/master-data/territories').then(({ data }) => setTerritories(data.items ?? [])).catch(() => {})
    api.get('/settings/master-data/lost-reasons').then(({ data }) => setLostReasons(data.items ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    api
      .get(`/crm/opportunities/${id}`)
      .then(({ data }) => {
        setForm({
          title: data.title ?? '',
          contact_name: data.contact_name ?? '',
          company: data.company ?? '',
          value: data.value != null ? String(data.value) : '',
          currency: data.currency ?? 'USD',
          expected_close_date: data.expected_close_date ?? '',
          stage: data.stage ?? 'prospecting',
          probability: data.probability != null ? String(data.probability) : '',
          source: data.source ?? 'manual',
          assigned_to: data.assigned_to ? String(data.assigned_to) : '',
          notes: data.notes ?? '',
          campaign_id: data.campaign_id ? String(data.campaign_id) : '',
          territory_id: data.territory_id ? String(data.territory_id) : '',
          lost_reason_id: data.lost_reason_id ? String(data.lost_reason_id) : '',
          lost_reason_detail: data.lost_reason_detail ?? '',
          next_follow_up_at: data.next_follow_up_at ?? '',
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
      .catch(() => toast.error('Failed to load opportunity'))
      .finally(() => setLoadingData(false))
  }, [id])

  const isLostStage = form.stage === 'closed_lost' || form.stage === 'lost'

  const set =
    (key: keyof OpportunityForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((e) => ({ ...e, [key]: undefined }))
    }

  const setSelect = (key: keyof OpportunityForm) => (value: string) => {
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
    const errs: Partial<Record<keyof OpportunityForm, string>> = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (form.probability && (Number(form.probability) < 0 || Number(form.probability) > 100))
      errs.probability = 'Probability must be between 0 and 100'
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
        value: form.value ? Number(form.value) : null,
        probability: form.probability ? Number(form.probability) : null,
        assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
        expected_close_date: form.expected_close_date || null,
        campaign_id: form.campaign_id ? parseInt(form.campaign_id) : null,
        territory_id: form.territory_id ? parseInt(form.territory_id) : null,
        lost_reason_id: isLostStage && form.lost_reason_id ? parseInt(form.lost_reason_id) : null,
        lost_reason_detail: isLostStage && form.lost_reason_detail ? form.lost_reason_detail : null,
        next_follow_up_at: form.next_follow_up_at || null,
        custom_fields: Object.keys(customData).length > 0 ? customData : null,
      }
      await api.put(`/crm/opportunities/${id}`, payload)
      toast.success('Opportunity updated successfully')
      router.push('/crm/opportunities')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to update opportunity'
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
        title="Edit Opportunity"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Opportunities', href: '/crm/opportunities' },
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
              form="opportunity-form"
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

      <form id="opportunity-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <TrendingUp className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="classification" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Tag className="h-[18px] w-[18px]" />
                  Classification
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
              <FormRow label="Title" required error={errors.title}>
                <Input
                  id="title"
                  value={form.title}
                  onChange={set('title')}
                  placeholder="New deal with Acme Corp"
                  aria-invalid={!!errors.title}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Contact Name">
                <Input
                  id="contact_name"
                  value={form.contact_name}
                  onChange={set('contact_name')}
                  placeholder="John Doe"
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
              <FormRow label="Value">
                <Input
                  id="value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.value}
                  onChange={set('value')}
                  placeholder="10000.00"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Currency">
                <Select value={form.currency} onValueChange={setSelect('currency')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Expected Close Date">
                <Input
                  id="expected_close_date"
                  type="date"
                  value={form.expected_close_date}
                  onChange={set('expected_close_date')}
                  className="h-10"
                />
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

            {/* Tab: Classification */}
            <TabsContent value="classification" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Stage">
                <Select value={form.stage} onValueChange={setSelect('stage')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Probability (%)" error={errors.probability}>
                <Input
                  id="probability"
                  type="number"
                  min="0"
                  max="100"
                  value={form.probability}
                  onChange={set('probability')}
                  placeholder="50"
                  aria-invalid={!!errors.probability}
                  className="h-10"
                />
              </FormRow>
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
              <FormRow label="Assigned To">
                <Input
                  id="assigned_to"
                  value={form.assigned_to}
                  onChange={set('assigned_to')}
                  placeholder="User ID or name"
                  className="h-10"
                />
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
              {isLostStage && (
                <>
                  <FormRow label="Lost Reason">
                    <Select value={form.lost_reason_id} onValueChange={setSelect('lost_reason_id')}>
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Select lost reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {lostReasons.map((o) => (
                          <SelectItem key={o.id} value={String(o.id)}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label="Lost Reason Detail">
                    <Textarea
                      value={form.lost_reason_detail}
                      onChange={set('lost_reason_detail')}
                      placeholder="Provide additional detail on why this opportunity was lost..."
                      rows={3}
                      className="resize-none"
                    />
                  </FormRow>
                </>
              )}
            </TabsContent>

            {/* Tab: Additional Information */}
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
                placeholder="Add any relevant notes about this opportunity..."
                rows={10}
                className="resize-none"
              />
            </TabsContent>

            {/* Tab: Timeline */}
            <TabsContent value="timeline" className="p-6 lg:p-8">
              <AuditTimeline entityType="opportunities" entityId={Number(id)} />
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
