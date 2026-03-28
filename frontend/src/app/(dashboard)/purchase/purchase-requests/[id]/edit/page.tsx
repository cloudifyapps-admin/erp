'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, ShoppingCart, StickyNote, Plus, Trash2, Loader2 } from 'lucide-react'
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

interface PRItem {
  id: string
  description: string
  quantity: string
  unit: string
  estimated_cost: string
}

interface PRForm {
  request_number: string
  department: string
  requested_by: string
  status: string
  priority: string
  required_date: string
  notes: string
}

const INITIAL: PRForm = {
  request_number: '',
  department: '',
  requested_by: '',
  status: 'draft',
  priority: 'medium',
  required_date: '',
  notes: '',
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
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

export default function EditPurchaseRequestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<PRForm>(INITIAL)
  const [items, setItems] = useState<PRItem[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof PRForm, string>>>({})

  useEffect(() => {
    api
      .get(`/purchase/purchase-requests/${id}`)
      .then(({ data }) => {
        setForm({
          request_number: data.request_number ?? '',
          department: data.department ?? '',
          requested_by: data.requested_by ?? '',
          status: data.status ?? 'draft',
          priority: data.priority ?? 'medium',
          required_date: data.required_date ? data.required_date.split('T')[0] : '',
          notes: data.notes ?? '',
        })
        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems(
            data.items.map((it: Record<string, unknown>) => ({
              id: crypto.randomUUID(),
              description: String(it.description ?? ''),
              quantity: String(it.quantity ?? '1'),
              unit: String(it.unit ?? 'pcs'),
              estimated_cost: String(it.estimated_cost ?? '0'),
            }))
          )
        } else {
          setItems([{ id: crypto.randomUUID(), description: '', quantity: '1', unit: 'pcs', estimated_cost: '0' }])
        }
      })
      .catch(() => toast.error('Failed to load purchase request'))
      .finally(() => setLoadingData(false))
  }, [id])

  const set =
    (key: keyof PRForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof PRForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const setItem = (itemId: string, key: keyof PRItem) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, [key]: e.target.value } : it)))
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: '', quantity: '1', unit: 'pcs', estimated_cost: '0' },
    ])
  }

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof PRForm, string>> = {}
    if (!form.requested_by.trim()) errs.requested_by = 'Requested by is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.put(`/purchase/purchase-requests/${id}`, {
        ...form,
        items: items
          .filter((it) => it.description.trim())
          .map((it) => ({
            description: it.description,
            quantity: parseFloat(it.quantity) || 0,
            unit: it.unit,
            estimated_cost: parseFloat(it.estimated_cost) || 0,
          })),
      })
      toast.success('Purchase request updated successfully')
      router.push('/purchase/purchase-requests')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to update purchase request'
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
        title="Edit Purchase Request"
        breadcrumbs={[
          { label: 'Purchase' },
          { label: 'Purchase Requests', href: '/purchase/purchase-requests' },
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
              form="pr-form"
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

      <form id="pr-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <FileText className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="items" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <ShoppingCart className="h-[18px] w-[18px]" />
                  Items
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <StickyNote className="h-[18px] w-[18px]" />
                  Notes
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Details */}
            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Request Number">
                <Input
                  id="request_number"
                  value={form.request_number}
                  onChange={set('request_number')}
                  placeholder="PR-0001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Department">
                <Input
                  id="department"
                  value={form.department}
                  onChange={set('department')}
                  placeholder="e.g. Engineering"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Requested By" required error={errors.requested_by}>
                <Input
                  id="requested_by"
                  value={form.requested_by}
                  onChange={set('requested_by')}
                  placeholder="Employee name"
                  aria-invalid={!!errors.requested_by}
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
              <FormRow label="Priority">
                <Select value={form.priority} onValueChange={setSelect('priority')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Required Date">
                <Input
                  id="required_date"
                  type="date"
                  value={form.required_date}
                  onChange={set('required_date')}
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Items */}
            <TabsContent value="items" className="p-6 lg:px-8 lg:py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Request Items</h2>
                <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-3 font-medium">Description</th>
                      <th className="text-right py-2 px-3 font-medium w-20">Qty</th>
                      <th className="text-left py-2 px-3 font-medium w-24">Unit</th>
                      <th className="text-right py-2 px-3 font-medium w-32">Est. Cost</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2 pr-3">
                          <Input
                            value={item.description}
                            onChange={setItem(item.id, 'description')}
                            placeholder="Item description"
                            className="h-7 text-sm"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            value={item.quantity}
                            onChange={setItem(item.id, 'quantity')}
                            type="number"
                            min="0"
                            className="h-7 text-sm text-right"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            value={item.unit}
                            onChange={setItem(item.id, 'unit')}
                            className="h-7 text-sm"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            value={item.estimated_cost}
                            onChange={setItem(item.id, 'estimated_cost')}
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-7 text-sm text-right"
                          />
                        </td>
                        <td className="py-2 pl-2">
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                          >
                            <Trash2 className="text-destructive size-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Tab: Notes */}
            <TabsContent value="notes" className="p-6 lg:p-8">
              <Textarea
                value={form.notes}
                onChange={set('notes')}
                placeholder="Additional notes or justification for this purchase request..."
                rows={10}
                className="resize-none"
              />
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
