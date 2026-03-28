'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Warehouse } from 'lucide-react'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

interface WarehouseForm {
  name: string
  code: string
  address: string
  city: string
  state: string
  country: string
  contact_person: string
  phone: string
  email: string
  status: string
}

const INITIAL: WarehouseForm = {
  name: '',
  code: '',
  address: '',
  city: '',
  state: '',
  country: '',
  contact_person: '',
  phone: '',
  email: '',
  status: 'active',
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

export default function EditWarehousePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<WarehouseForm>(INITIAL)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof WarehouseForm, string>>>({})

  useEffect(() => {
    api
      .get(`/inventory/warehouses/${id}`)
      .then(({ data }) => {
        setForm({
          name: data.name ?? '',
          code: data.code ?? '',
          address: data.address ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          country: data.country ?? '',
          contact_person: data.contact_person ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
          status: data.status ?? 'active',
        })
      })
      .catch(() => toast.error('Failed to load warehouse'))
      .finally(() => setLoadingData(false))
  }, [id])

  const set =
    (key: keyof WarehouseForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof WarehouseForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof WarehouseForm, string>> = {}
    if (!form.name.trim()) errs.name = 'Warehouse name is required'
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.put(`/inventory/warehouses/${id}`, {
        name: form.name,
        code: form.code || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        email: form.email || null,
        status: form.status,
      })
      toast.success('Warehouse updated successfully')
      router.push('/inventory/warehouses')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to update warehouse'
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
        title="Edit Warehouse"
        breadcrumbs={[
          { label: 'Inventory' },
          { label: 'Warehouses', href: '/inventory/warehouses' },
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
              form="warehouse-form"
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

      <form id="warehouse-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Warehouse className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Warehouse Name" required error={errors.name}>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Main Warehouse"
                  aria-invalid={!!errors.name}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Code">
                <Input
                  id="code"
                  value={form.code}
                  onChange={set('code')}
                  placeholder="WH-001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Address">
                <Input
                  id="address"
                  value={form.address}
                  onChange={set('address')}
                  placeholder="123 Industrial Ave"
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
              <FormRow label="Country">
                <Input
                  id="country"
                  value={form.country}
                  onChange={set('country')}
                  placeholder="United States"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Contact Person">
                <Input
                  id="contact_person"
                  value={form.contact_person}
                  onChange={set('contact_person')}
                  placeholder="John Doe"
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
              <FormRow label="Email" error={errors.email}>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="warehouse@example.com"
                  aria-invalid={!!errors.email}
                  className="h-10"
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
