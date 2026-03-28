'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Building } from 'lucide-react'
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

interface DepartmentForm {
  name: string
  code: string
  parent_department: string
  manager: string
  description: string
  status: string
}

const INITIAL: DepartmentForm = {
  name: '',
  code: '',
  parent_department: '',
  manager: '',
  description: '',
  status: 'active',
}

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

export default function NewDepartmentPage() {
  const router = useRouter()
  const [form, setForm] = useState<DepartmentForm>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof DepartmentForm, string>>>({})

  const set =
    (key: keyof DepartmentForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof DepartmentForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof DepartmentForm, string>> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/hr/departments', {
        name: form.name,
        code: form.code || null,
        parent_department: form.parent_department || null,
        manager: form.manager || null,
        description: form.description || null,
        status: form.status,
      })
      toast.success('Department created successfully')
      router.push('/hr/departments')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create department'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Department"
        breadcrumbs={[
          { label: 'HR' },
          { label: 'Departments', href: '/hr/departments' },
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
              form="department-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Department'}
            </Button>
          </div>
        }
      />

      <form id="department-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Building className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Name" required error={errors.name}>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Engineering"
                  aria-invalid={!!errors.name}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Code">
                <Input
                  id="code"
                  value={form.code}
                  onChange={set('code')}
                  placeholder="e.g. ENG"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Parent Department">
                <Input
                  id="parent_department"
                  value={form.parent_department}
                  onChange={set('parent_department')}
                  placeholder="Parent department name or ID"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Manager">
                <Input
                  id="manager"
                  value={form.manager}
                  onChange={set('manager')}
                  placeholder="Manager name or ID"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Description">
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={set('description')}
                  rows={3}
                  placeholder="Department description"
                />
              </FormRow>
              <FormRow label="Status">
                <Select value={form.status} onValueChange={setSelect('status')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
