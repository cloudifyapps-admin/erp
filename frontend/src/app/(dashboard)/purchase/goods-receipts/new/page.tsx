'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PackageCheck, ShoppingCart, StickyNote, Plus, Trash2, Loader2 } from 'lucide-react'
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

interface GRItem {
  id: string
  product_name: string
  expected_qty: string
  received_qty: string
  unit: string
}

interface GRForm {
  receipt_number: string
  po_reference: string
  vendor_name: string
  status: string
  receipt_date: string
  warehouse: string
  notes: string
}

const INITIAL: GRForm = {
  receipt_number: '',
  po_reference: '',
  vendor_name: '',
  status: 'pending',
  receipt_date: new Date().toISOString().split('T')[0],
  warehouse: '',
  notes: '',
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'partial', label: 'Partial' },
  { value: 'rejected', label: 'Rejected' },
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

export default function NewGoodsReceiptPage() {
  const router = useRouter()
  const [form, setForm] = useState<GRForm>(INITIAL)
  const [items, setItems] = useState<GRItem[]>([
    { id: crypto.randomUUID(), product_name: '', expected_qty: '0', received_qty: '0', unit: 'pcs' },
  ])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof GRForm, string>>>({})

  const set =
    (key: keyof GRForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof GRForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const setItem = (id: string, key: keyof GRItem) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: e.target.value } : it)))
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), product_name: '', expected_qty: '0', received_qty: '0', unit: 'pcs' },
    ])
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof GRForm, string>> = {}
    if (!form.vendor_name.trim()) errs.vendor_name = 'Vendor name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/purchase/goods-receipts', {
        ...form,
        items: items
          .filter((it) => it.product_name.trim())
          .map((it) => ({
            product_name: it.product_name,
            expected_qty: parseFloat(it.expected_qty) || 0,
            received_qty: parseFloat(it.received_qty) || 0,
            unit: it.unit,
          })),
      })
      toast.success('Goods receipt created successfully')
      router.push('/purchase/goods-receipts')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to create goods receipt'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Goods Receipt"
        breadcrumbs={[
          { label: 'Purchase' },
          { label: 'Goods Receipts', href: '/purchase/goods-receipts' },
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
              form="gr-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Receipt'}
            </Button>
          </div>
        }
      />

      <form id="gr-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <PackageCheck className="h-[18px] w-[18px]" />
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
              <FormRow label="Receipt Number">
                <Input
                  id="receipt_number"
                  value={form.receipt_number}
                  onChange={set('receipt_number')}
                  placeholder="Auto-generated if blank"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="PO Reference">
                <Input
                  id="po_reference"
                  value={form.po_reference}
                  onChange={set('po_reference')}
                  placeholder="e.g. PO-0001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Vendor Name" required error={errors.vendor_name}>
                <Input
                  id="vendor_name"
                  value={form.vendor_name}
                  onChange={set('vendor_name')}
                  placeholder="Acme Corp"
                  aria-invalid={!!errors.vendor_name}
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
              <FormRow label="Receipt Date">
                <Input
                  id="receipt_date"
                  type="date"
                  value={form.receipt_date}
                  onChange={set('receipt_date')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Warehouse">
                <Input
                  id="warehouse"
                  value={form.warehouse}
                  onChange={set('warehouse')}
                  placeholder="e.g. Main Warehouse"
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Items */}
            <TabsContent value="items" className="p-6 lg:px-8 lg:py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Receipt Items</h2>
                <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-3 font-medium">Product Name</th>
                      <th className="text-right py-2 px-3 font-medium w-24">Expected Qty</th>
                      <th className="text-right py-2 px-3 font-medium w-24">Received Qty</th>
                      <th className="text-left py-2 px-3 font-medium w-24">Unit</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2 pr-3">
                          <Input
                            value={item.product_name}
                            onChange={setItem(item.id, 'product_name')}
                            placeholder="Product name"
                            className="h-7 text-sm"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            value={item.expected_qty}
                            onChange={setItem(item.id, 'expected_qty')}
                            type="number"
                            min="0"
                            className="h-7 text-sm text-right"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            value={item.received_qty}
                            onChange={setItem(item.id, 'received_qty')}
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
                placeholder="Notes about this goods receipt..."
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
