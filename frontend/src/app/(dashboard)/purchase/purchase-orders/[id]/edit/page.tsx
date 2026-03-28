'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, ShoppingCart, StickyNote, Plus, Trash2, Loader2 } from 'lucide-react'
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

interface LineItem {
  description: string
  quantity: string
  unit_price: string
  unit: string
  tax_rate: string
}

interface POForm {
  vendor_id: string
  number: string
  order_date: string
  expected_delivery: string
  currency: string
  payment_terms: string
  shipping_address: string
  notes: string
  status: string
}

interface Vendor {
  id: string
  name: string
  code: string
}

const EMPTY_LINE: LineItem = { description: '', quantity: '1', unit_price: '0', unit: 'pcs', tax_rate: '0' }

const INITIAL_FORM: POForm = {
  vendor_id: '',
  number: '',
  order_date: '',
  expected_delivery: '',
  currency: 'USD',
  payment_terms: 'net30',
  shipping_address: '',
  notes: '',
  status: 'draft',
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

export default function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<POForm>(INITIAL_FORM)
  const [lines, setLines] = useState<LineItem[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadVendors = api
      .get('/purchase/vendors', { params: { status: 'active', page_size: 200 } })
      .then(({ data }) => setVendors(normalizePaginated(data).items))
      .catch(() => {})

    const loadPO = api
      .get(`/purchase/purchase-orders/${id}`)
      .then(({ data }) => {
        setForm({
          vendor_id: data.vendor_id ? String(data.vendor_id) : '',
          number: data.number ?? '',
          order_date: data.order_date ? data.order_date.split('T')[0] : '',
          expected_delivery: data.expected_delivery ? data.expected_delivery.split('T')[0] : '',
          currency: data.currency ?? 'USD',
          payment_terms: data.payment_terms ?? 'net30',
          shipping_address: data.shipping_address ?? '',
          notes: data.notes ?? '',
          status: data.status ?? 'draft',
        })
        if (Array.isArray(data.items) && data.items.length > 0) {
          setLines(
            data.items.map((it: Record<string, unknown>) => ({
              description: String(it.description ?? ''),
              quantity: String(it.quantity ?? '1'),
              unit_price: String(it.unit_price ?? '0'),
              unit: String(it.unit ?? 'pcs'),
              tax_rate: String(it.tax_rate ?? '0'),
            }))
          )
        } else {
          setLines([{ ...EMPTY_LINE }])
        }
      })
      .catch(() => toast.error('Failed to load purchase order'))

    Promise.all([loadVendors, loadPO]).finally(() => setLoadingData(false))
  }, [id])

  const setField = (key: keyof POForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const setLine = (idx: number, key: keyof LineItem) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [key]: e.target.value } : l)))
  }

  const addLine = () => setLines((ls) => [...ls, { ...EMPTY_LINE }])
  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx))

  const subtotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0
    const price = parseFloat(l.unit_price) || 0
    return sum + qty * price
  }, 0)

  const tax = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0
    const price = parseFloat(l.unit_price) || 0
    const rate = parseFloat(l.tax_rate) || 0
    return sum + qty * price * (rate / 100)
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vendor_id) { toast.error('Please select a vendor'); return }
    if (lines.every((l) => !l.description)) { toast.error('Add at least one line item'); return }
    setSaving(true)
    try {
      await api.put(`/purchase/purchase-orders/${id}`, {
        ...form,
        items: lines.filter((l) => l.description).map((l) => ({
          ...l,
          quantity: parseFloat(l.quantity),
          unit_price: parseFloat(l.unit_price),
          tax_rate: parseFloat(l.tax_rate),
        })),
      })
      toast.success('Purchase order updated successfully')
      router.push('/purchase/purchase-orders')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to update PO'
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
        title="Edit Purchase Order"
        breadcrumbs={[
          { label: 'Purchase' },
          { label: 'Purchase Orders', href: '/purchase/purchase-orders' },
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
              form="po-form"
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

      <form id="po-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <FileText className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="line-items" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <ShoppingCart className="h-[18px] w-[18px]" />
                  Line Items
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <StickyNote className="h-[18px] w-[18px]" />
                  Notes
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Details */}
            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Vendor" required>
                <Select value={form.vendor_id} onValueChange={(v) => setForm((f) => ({ ...f, vendor_id: v }))}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name} ({v.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="PO Number">
                <Input
                  id="number"
                  value={form.number}
                  onChange={setField('number')}
                  placeholder="PO-0001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Order Date">
                <Input
                  id="order_date"
                  type="date"
                  value={form.order_date}
                  onChange={setField('order_date')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Expected Delivery">
                <Input
                  id="expected_delivery"
                  type="date"
                  value={form.expected_delivery}
                  onChange={setField('expected_delivery')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Currency">
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
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
              <FormRow label="Payment Terms">
                <Select value={form.payment_terms} onValueChange={(v) => setForm((f) => ({ ...f, payment_terms: v }))}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="net15">Net 15</SelectItem>
                    <SelectItem value="net30">Net 30</SelectItem>
                    <SelectItem value="net60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Shipping Address">
                <Textarea
                  id="shipping_address"
                  value={form.shipping_address}
                  onChange={setField('shipping_address')}
                  rows={2}
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Line Items */}
            <TabsContent value="line-items" className="p-6 lg:px-8 lg:py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Line Items</h2>
                <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Line
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-3 font-medium">Description</th>
                      <th className="text-right py-2 px-3 font-medium w-20">Qty</th>
                      <th className="text-left py-2 px-3 font-medium w-20">Unit</th>
                      <th className="text-right py-2 px-3 font-medium w-28">Unit Price</th>
                      <th className="text-right py-2 px-3 font-medium w-20">Tax %</th>
                      <th className="text-right py-2 pl-3 font-medium w-28">Amount</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const amount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0)
                      return (
                        <tr key={idx} className="border-b">
                          <td className="py-2 pr-3">
                            <Input value={line.description} onChange={setLine(idx, 'description')} placeholder="Item description" className="h-7 text-sm" />
                          </td>
                          <td className="py-2 px-3">
                            <Input value={line.quantity} onChange={setLine(idx, 'quantity')} type="number" min="0" className="h-7 text-sm text-right" />
                          </td>
                          <td className="py-2 px-3">
                            <Input value={line.unit} onChange={setLine(idx, 'unit')} className="h-7 text-sm" />
                          </td>
                          <td className="py-2 px-3">
                            <Input value={line.unit_price} onChange={setLine(idx, 'unit_price')} type="number" min="0" step="0.01" className="h-7 text-sm text-right" />
                          </td>
                          <td className="py-2 px-3">
                            <Input value={line.tax_rate} onChange={setLine(idx, 'tax_rate')} type="number" min="0" max="100" step="0.1" className="h-7 text-sm text-right" />
                          </td>
                          <td className="py-2 pl-3 text-right tabular-nums font-medium">
                            {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 pl-2">
                            <Button type="button" size="icon-xs" variant="ghost" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                              <Trash2 className="text-destructive size-3" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <div className="w-64 flex flex-col gap-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span className="tabular-nums">{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span>Total ({form.currency})</span>
                    <span className="tabular-nums">{(subtotal + tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Notes */}
            <TabsContent value="notes" className="p-6 lg:p-8">
              <Textarea
                value={form.notes}
                onChange={setField('notes')}
                placeholder="Internal notes or instructions for the vendor..."
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
