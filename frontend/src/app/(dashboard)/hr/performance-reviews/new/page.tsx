'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Star, FileText } from 'lucide-react'
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

interface ReviewForm {
  employee_name: string
  reviewer: string
  review_period: string
  review_date: string
  status: string
  overall_rating: string
  goals_achieved: string
  strengths: string
  improvements: string
  comments: string
}

const INITIAL: ReviewForm = {
  employee_name: '',
  reviewer: '',
  review_period: 'Annual',
  review_date: new Date().toISOString().split('T')[0],
  status: 'draft',
  overall_rating: '',
  goals_achieved: '',
  strengths: '',
  improvements: '',
  comments: '',
}

const PERIOD_OPTIONS = [
  { value: 'Q1', label: 'Q1' },
  { value: 'Q2', label: 'Q2' },
  { value: 'Q3', label: 'Q3' },
  { value: 'Q4', label: 'Q4' },
  { value: 'Annual', label: 'Annual' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'completed', label: 'Completed' },
]

const RATING_OPTIONS = [
  { value: '1', label: '1 - Needs Improvement' },
  { value: '2', label: '2 - Below Expectations' },
  { value: '3', label: '3 - Meets Expectations' },
  { value: '4', label: '4 - Exceeds Expectations' },
  { value: '5', label: '5 - Outstanding' },
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

export default function NewPerformanceReviewPage() {
  const router = useRouter()
  const [form, setForm] = useState<ReviewForm>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ReviewForm, string>>>({})

  const set =
    (key: keyof ReviewForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof ReviewForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof ReviewForm, string>> = {}
    if (!form.employee_name.trim()) errs.employee_name = 'Employee name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/hr/performance-reviews', {
        employee_name: form.employee_name,
        reviewer: form.reviewer || null,
        review_period: form.review_period,
        review_date: form.review_date || null,
        status: form.status,
        overall_rating: form.overall_rating ? parseInt(form.overall_rating) : null,
        goals_achieved: form.goals_achieved || null,
        strengths: form.strengths || null,
        improvements: form.improvements || null,
        comments: form.comments || null,
      })
      toast.success('Performance review created successfully')
      router.push('/hr/performance-reviews')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create performance review'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Performance Review"
        breadcrumbs={[
          { label: 'HR' },
          { label: 'Performance Reviews', href: '/hr/performance-reviews' },
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
              form="review-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Review'}
            </Button>
          </div>
        }
      />

      <form id="review-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Star className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="evaluation" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <FileText className="h-[18px] w-[18px]" />
                  Evaluation
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Employee Name" required error={errors.employee_name}>
                <Input
                  id="employee_name"
                  value={form.employee_name}
                  onChange={set('employee_name')}
                  placeholder="Employee name"
                  aria-invalid={!!errors.employee_name}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Reviewer">
                <Input
                  id="reviewer"
                  value={form.reviewer}
                  onChange={set('reviewer')}
                  placeholder="Reviewer name"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Review Period">
                <Select value={form.review_period} onValueChange={setSelect('review_period')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Review Date">
                <Input
                  id="review_date"
                  type="date"
                  value={form.review_date}
                  onChange={set('review_date')}
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
            </TabsContent>

            <TabsContent value="evaluation" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Overall Rating">
                <Select value={form.overall_rating} onValueChange={setSelect('overall_rating')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    {RATING_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Goals Achieved">
                <Textarea
                  id="goals_achieved"
                  value={form.goals_achieved}
                  onChange={set('goals_achieved')}
                  rows={3}
                  placeholder="Describe goals achieved during this period"
                />
              </FormRow>
              <FormRow label="Strengths">
                <Textarea
                  id="strengths"
                  value={form.strengths}
                  onChange={set('strengths')}
                  rows={3}
                  placeholder="Key strengths demonstrated"
                />
              </FormRow>
              <FormRow label="Areas for Improvement">
                <Textarea
                  id="improvements"
                  value={form.improvements}
                  onChange={set('improvements')}
                  rows={3}
                  placeholder="Areas that need improvement"
                />
              </FormRow>
              <FormRow label="Comments">
                <Textarea
                  id="comments"
                  value={form.comments}
                  onChange={set('comments')}
                  rows={3}
                  placeholder="Additional comments"
                />
              </FormRow>
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
