'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, CalendarDays, Info, Plus, X } from 'lucide-react'
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

interface ActivityForm {
  subject: string
  type: string
  status: string
  date: string
  time: string
  duration: string
  related_to: string
  assigned_to: string
  description: string
}

interface CustomField {
  id: string
  key: string
  value: string
}

const INITIAL: ActivityForm = {
  subject: '',
  type: 'call',
  status: 'planned',
  date: '',
  time: '',
  duration: '',
  related_to: '',
  assigned_to: '',
  description: '',
}

const TYPE_OPTIONS = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'task', label: 'Task' },
  { value: 'note', label: 'Note' },
]

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
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

export default function NewActivityPage() {
  const router = useRouter()
  const [form, setForm] = useState<ActivityForm>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ActivityForm, string>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])

  const set =
    (key: keyof ActivityForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((e) => ({ ...e, [key]: undefined }))
    }

  const setSelect = (key: keyof ActivityForm) => (value: string) => {
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
    const errs: Partial<Record<keyof ActivityForm, string>> = {}
    if (!form.subject.trim()) errs.subject = 'Subject is required'
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
        date: form.date || null,
        time: form.time || null,
        custom_fields: Object.keys(customData).length > 0 ? customData : null,
      }
      await api.post('/crm/activities', payload)
      toast.success('Activity created successfully')
      router.push('/crm/activities')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create activity'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Activity"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Activities', href: '/crm/activities' },
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
              form="activity-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Activity'}
            </Button>
          </div>
        }
      />

      <form id="activity-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <CalendarDays className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="additional" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Info className="h-[18px] w-[18px]" />
                  Additional Information
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Details */}
            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Subject" required error={errors.subject}>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={set('subject')}
                  placeholder="Follow up call with client"
                  aria-invalid={!!errors.subject}
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
              <FormRow label="Date">
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={set('date')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Time">
                <Input
                  id="time"
                  type="time"
                  value={form.time}
                  onChange={set('time')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Duration">
                <Input
                  id="duration"
                  value={form.duration}
                  onChange={set('duration')}
                  placeholder="e.g. 30 minutes"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Related To">
                <Input
                  id="related_to"
                  value={form.related_to}
                  onChange={set('related_to')}
                  placeholder="Lead, Contact, or Opportunity"
                  className="h-10"
                />
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
              <FormRow label="Description">
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Describe the activity..."
                  rows={4}
                  className="resize-none"
                />
              </FormRow>
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
          </Tabs>
        </div>
      </form>
    </div>
  )
}
