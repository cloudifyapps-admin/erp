'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export default function NewLeadPage() {
  const router = useRouter()
  const [form, setForm] = useState<LeadForm>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof LeadForm, string>>>({})

  useEffect(() => {
    api
      .get('/numbering/peek/lead')
      .then(({ data }) => {
        if (data?.number) {
          setForm((f) => ({ ...f, title: data.number }))
        }
      })
      .catch(() => {/* numbering optional */})
  }, [])

  const set =
    (key: keyof LeadForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((e) => ({ ...e, [key]: undefined }))
    }

  const setSelect = (key: keyof LeadForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
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
      const payload = {
        ...form,
        assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
        salutation_id: (form as Record<string, unknown>).salutation_id || null,
        country_id: (form as Record<string, unknown>).country_id || null,
      }
      await api.post('/crm/leads', payload)
      toast.success('Lead created successfully')
      router.push('/crm/leads')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create lead'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <PageHeader
        title="New Lead"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Leads', href: '/crm/leads' },
          { label: 'New' },
        ]}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Lead Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="title">Lead Title / Reference</Label>
              <Input
                id="title"
                value={form.title}
                onChange={set('title')}
                placeholder="Lead-0001"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first_name">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="first_name"
                value={form.first_name}
                onChange={set('first_name')}
                placeholder="John"
                aria-invalid={!!errors.first_name}
              />
              {errors.first_name && (
                <p className="text-xs text-destructive">{errors.first_name}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last_name">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="last_name"
                value={form.last_name}
                onChange={set('last_name')}
                placeholder="Doe"
                aria-invalid={!!errors.last_name}
              />
              {errors.last_name && (
                <p className="text-xs text-destructive">{errors.last_name}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="john.doe@example.com"
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={set('phone')}
                placeholder="+1 555 0100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                value={form.mobile}
                onChange={set('mobile')}
                placeholder="+1 555 0101"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={form.company}
                onChange={set('company')}
                placeholder="Acme Corp"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job_title">Job Title</Label>
              <Input
                id="job_title"
                value={form.job_title}
                onChange={set('job_title')}
                placeholder="VP of Sales"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={setSelect('source')}>
                <SelectTrigger className="w-full">
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
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={setSelect('status')}>
                <SelectTrigger className="w-full">
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
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assigned_to">Assigned To (User ID)</Label>
              <Input
                id="assigned_to"
                value={form.assigned_to}
                onChange={set('assigned_to')}
                placeholder="User ID or name"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.notes}
              onChange={set('notes')}
              placeholder="Add any relevant notes about this lead..."
              rows={4}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? 'Creating...' : 'Create Lead'}
          </Button>
        </div>
      </form>
    </div>
  )
}
