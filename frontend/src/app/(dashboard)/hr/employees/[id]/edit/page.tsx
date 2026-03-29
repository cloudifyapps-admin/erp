'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, User, Briefcase, FileText, Info, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
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

interface Department {
  id: string
  name: string
}

interface EmployeeForm {
  // Personal
  first_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth: string
  gender: string
  nationality: string
  address: string
  emergency_contact_name: string
  emergency_contact_phone: string
  // Employment
  employee_id: string
  department_id: string
  designation: string
  employment_type: string
  date_of_joining: string
  work_location: string
  manager_id: string
  salary: string
  salary_currency: string
  status: string
  // Documents
  id_type: string
  id_number: string
  passport_number: string
  passport_expiry: string
}

interface CustomField {
  id: string
  key: string
  value: string
}

const INITIAL: EmployeeForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  nationality: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  employee_id: '',
  department_id: '',
  designation: '',
  employment_type: 'full_time',
  date_of_joining: '',
  work_location: '',
  manager_id: '',
  salary: '',
  salary_currency: 'USD',
  status: 'active',
  id_type: '',
  id_number: '',
  passport_number: '',
  passport_expiry: '',
}

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

export default function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<EmployeeForm>(INITIAL)
  const [departments, setDepartments] = useState<Department[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeForm, string>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])

  useEffect(() => {
    Promise.all([
      api.get(`/hr/employees/${id}`),
      api.get('/hr/departments', { params: { page_size: 200 } }),
    ])
      .then(([empRes, deptRes]) => {
        const data = empRes.data
        setForm({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          date_of_birth: data.date_of_birth ?? '',
          gender: data.gender ?? '',
          nationality: data.nationality ?? '',
          address: data.address ?? '',
          emergency_contact_name: data.emergency_contact_name ?? '',
          emergency_contact_phone: data.emergency_contact_phone ?? '',
          employee_id: data.employee_id ?? '',
          department_id: data.department_id ? String(data.department_id) : '',
          designation: data.designation ?? '',
          employment_type: data.employment_type ?? 'full_time',
          date_of_joining: data.joining_date ?? data.date_of_joining ?? '',
          work_location: data.work_location ?? '',
          manager_id: data.manager_id ? String(data.manager_id) : '',
          salary: data.salary != null ? String(data.salary) : '',
          salary_currency: data.salary_currency ?? 'USD',
          status: data.status ?? 'active',
          id_type: data.id_type ?? '',
          id_number: data.id_number ?? '',
          passport_number: data.passport_number ?? '',
          passport_expiry: data.passport_expiry ?? '',
        })
        if (data.custom_fields && typeof data.custom_fields === 'object') {
          const existing = Object.entries(data.custom_fields).map(([key, value]) => ({
            id: crypto.randomUUID(),
            key,
            value: String(value),
          }))
          setCustomFields(existing)
        }
        setDepartments(normalizePaginated<Department>(deptRes.data).items)
      })
      .catch(() => toast.error('Failed to load employee'))
      .finally(() => setLoadingData(false))
  }, [id])

  const set =
    (key: keyof EmployeeForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof EmployeeForm) => (value: string) => {
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
    const errs: Partial<Record<keyof EmployeeForm, string>> = {}
    if (!form.first_name.trim()) errs.first_name = 'First name is required'
    if (!form.last_name.trim()) errs.last_name = 'Last name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.put(`/hr/employees/${id}`, {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        address: form.address || null,
        employee_id: form.employee_id || null,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        employment_type: form.employment_type,
        joining_date: form.date_of_joining || null,
        status: form.status,
      })
      toast.success('Employee updated successfully')
      router.push('/hr/employees')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to update employee'
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
        title="Edit Employee"
        breadcrumbs={[
          { label: 'HR' },
          { label: 'Employees', href: '/hr/employees' },
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
              form="employee-form"
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

      <form id="employee-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="personal" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="personal" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <User className="h-[18px] w-[18px]" />
                  Personal
                </TabsTrigger>
                <TabsTrigger value="employment" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Briefcase className="h-[18px] w-[18px]" />
                  Employment
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <FileText className="h-[18px] w-[18px]" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="additional" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Info className="h-[18px] w-[18px]" />
                  Additional Information
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Personal */}
            <TabsContent value="personal" className="p-6 lg:px-8 lg:py-2">
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
              <FormRow label="Email" required error={errors.email}>
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
              <FormRow label="Date of Birth">
                <Input
                  id="date_of_birth"
                  type="date"
                  value={form.date_of_birth}
                  onChange={set('date_of_birth')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Gender">
                <Select value={form.gender} onValueChange={setSelect('gender')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Nationality">
                <Input
                  id="nationality"
                  value={form.nationality}
                  onChange={set('nationality')}
                  placeholder="e.g. American"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Address">
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={set('address')}
                  rows={2}
                  placeholder="Full address"
                />
              </FormRow>
              <FormRow label="Emergency Contact">
                <Input
                  id="emergency_contact_name"
                  value={form.emergency_contact_name}
                  onChange={set('emergency_contact_name')}
                  placeholder="Full name"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Emergency Phone">
                <Input
                  id="emergency_contact_phone"
                  value={form.emergency_contact_phone}
                  onChange={set('emergency_contact_phone')}
                  placeholder="+1 555 0200"
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Employment */}
            <TabsContent value="employment" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Employee ID">
                <Input
                  id="employee_id"
                  value={form.employee_id}
                  onChange={set('employee_id')}
                  placeholder="EMP-001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Designation">
                <Input
                  id="designation"
                  value={form.designation}
                  onChange={set('designation')}
                  placeholder="Software Engineer"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Department">
                <Select value={form.department_id} onValueChange={setSelect('department_id')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Employment Type">
                <Select value={form.employment_type} onValueChange={setSelect('employment_type')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Date of Joining">
                <Input
                  id="date_of_joining"
                  type="date"
                  value={form.date_of_joining}
                  onChange={set('date_of_joining')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Work Location">
                <Input
                  id="work_location"
                  value={form.work_location}
                  onChange={set('work_location')}
                  placeholder="HQ / Remote"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Salary">
                <Input
                  id="salary"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.salary}
                  onChange={set('salary')}
                  placeholder="0.00"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Currency">
                <Select value={form.salary_currency} onValueChange={setSelect('salary_currency')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
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
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
            </TabsContent>

            {/* Tab: Documents */}
            <TabsContent value="documents" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="ID Type">
                <Select value={form.id_type} onValueChange={setSelect('id_type')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national_id">National ID</SelectItem>
                    <SelectItem value="drivers_license">Driver&apos;s License</SelectItem>
                    <SelectItem value="tax_id">Tax ID</SelectItem>
                    <SelectItem value="social_security">Social Security</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="ID Number">
                <Input
                  id="id_number"
                  value={form.id_number}
                  onChange={set('id_number')}
                  placeholder="ID number"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Passport Number">
                <Input
                  id="passport_number"
                  value={form.passport_number}
                  onChange={set('passport_number')}
                  placeholder="Passport number"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Passport Expiry">
                <Input
                  id="passport_expiry"
                  type="date"
                  value={form.passport_expiry}
                  onChange={set('passport_expiry')}
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
          </Tabs>
        </div>
      </form>
    </div>
  )
}
