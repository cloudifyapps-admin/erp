'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Ticket, Info, Plus, X } from 'lucide-react'
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

interface TicketForm {
  subject: string
  type: string
  priority: string
  status: string
  assigned_to: string
  description: string
}

interface CustomField {
  id: string
  key: string
  value: string
}

const INITIAL: TicketForm = {
  subject: '',
  type: 'support',
  priority: 'medium',
  status: 'open',
  assigned_to: '',
  description: '',
}

/* -- Reusable key-value row ------------------------------------------------ */
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

export default function NewTicketPage() {
  const router = useRouter()
  const [form, setForm] = useState<TicketForm>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof TicketForm, string>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])

  const set =
    (key: keyof TicketForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof TicketForm) => (value: string) => {
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
    const errs: Partial<Record<keyof TicketForm, string>> = {}
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
      await api.post('/tickets', {
        subject: form.subject,
        type: form.type,
        priority: form.priority,
        status: form.status,
        assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
        description: form.description || null,
        custom_fields: Object.keys(customData).length > 0 ? customData : null,
      })
      toast.success('Ticket created successfully')
      router.push('/tickets')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create ticket'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Ticket"
        breadcrumbs={[{ label: 'Tickets', href: '/tickets' }]}
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
              form="ticket-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        }
      />

      <form id="ticket-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Ticket className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="additional" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Info className="h-[18px] w-[18px]" />
                  Additional Info
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
                  placeholder="Brief description of the issue"
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
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="question">Question</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Priority">
                <Select value={form.priority} onValueChange={setSelect('priority')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Status">
                <Select value={form.status} onValueChange={setSelect('status')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
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
              <FormRow label="Description">
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Provide detailed information about this ticket..."
                  rows={5}
                  className="resize-none"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Additional Info — custom fields */}
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
