'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, CalendarOff } from 'lucide-react'
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

interface LeaveForm {
  employee_name: string
  leave_type: string
  start_date: string
  end_date: string
  status: string
  reason: string
}

const INITIAL: LeaveForm = {
  employee_name: '',
  leave_type: 'annual',
  start_date: '',
  end_date: '',
  status: 'pending',
  reason: '',
}

const LEAVE_TYPE_OPTIONS = [
  { value: 'annual', label: 'Annual' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function FormRow({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4 py-3.5 border-b border-border/30 last:border-b-0">
      <Label className="pt-2.5 text-[13px] font-medium text-muted-foreground leading-tight">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="flex flex-col gap-1">{children}{error && <p className="text-[11px] text-destructive">{error}</p>}</div>
    </div>
  )
}

export default function NewLeaveRequestPage() {
  const router = useRouter()
  const [form, setForm] = useState<LeaveForm>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof LeaveForm, string>>>({})

  const set =
    (key: keyof LeaveForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof LeaveForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof LeaveForm, string>> = {}
    if (!form.start_date) errs.start_date = 'Start date is required'
    if (!form.end_date) errs.end_date = 'End date is required'
    if (form.start_date && form.end_date && form.start_date > form.end_date)
      errs.end_date = 'End date must be after start date'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/hr/leave-requests', {
        employee_name: form.employee_name || null,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        reason: form.reason || null,
      })
      toast.success('Leave request created successfully')
      router.push('/hr/leave-requests')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create leave request'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Leave Request"
        breadcrumbs={[
          { label: 'HR' },
          { label: 'Leave Requests', href: '/hr/leave-requests' },
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
              form="leave-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Leave Request'}
            </Button>
          </div>
        }
      />

      <form id="leave-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <CalendarOff className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Employee Name">
                <Input
                  id="employee_name"
                  value={form.employee_name}
                  onChange={set('employee_name')}
                  placeholder="Employee name"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Leave Type">
                <Select value={form.leave_type} onValueChange={setSelect('leave_type')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Start Date" required error={errors.start_date}>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={set('start_date')}
                  aria-invalid={!!errors.start_date}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="End Date" required error={errors.end_date}>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={set('end_date')}
                  aria-invalid={!!errors.end_date}
                  className="h-10"
                />
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
              <FormRow label="Reason">
                <Textarea
                  id="reason"
                  value={form.reason}
                  onChange={set('reason')}
                  rows={3}
                  placeholder="Reason for leave"
                />
              </FormRow>
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
