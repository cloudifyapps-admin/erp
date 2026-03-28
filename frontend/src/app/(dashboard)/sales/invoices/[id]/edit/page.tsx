'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface LineItem {
  id: string
  product_name: string
  description: string
  quantity: string
  unit_price: string
  discount: string
  tax_rate: string
  line_total: number
}

interface InvoiceForm {
  invoice_number: string
  customer_name: string
  status: string
  currency: string
  invoice_date: string
  due_date: string
  payment_terms: string
  notes: string
}

const INITIAL_FORM: InvoiceForm = {
  invoice_number: '',
  customer_name: '',
  status: 'draft',
  currency: 'USD',
  invoice_date: '',
  due_date: '',
  payment_terms: 'net30',
  notes: '',
}

const newLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  product_name: '',
  description: '',
  quantity: '1',
  unit_price: '0',
  discount: '0',
  tax_rate: '0',
  line_total: 0,
})

function calcLineTotal(item: LineItem): number {
  const qty = parseFloat(item.quantity) || 0
  const price = parseFloat(item.unit_price) || 0
  const disc = parseFloat(item.discount) || 0
  const taxRate = parseFloat(item.tax_rate) || 0
  const base = qty * price * (1 - disc / 100)
  return base * (1 + taxRate / 100)
}

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

export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [form, setForm] = useState<InvoiceForm>(INITIAL_FORM)
  const [lines, setLines] = useState<LineItem[]>([newLineItem()])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get(`/sales/invoices/${id}`)
      .then(({ data }) => {
        setForm({
          invoice_number: data.invoice_number || '',
          customer_name: data.customer_name || '',
          status: data.status || 'draft',
          currency: data.currency || 'USD',
          invoice_date: data.invoice_date || '',
          due_date: data.due_date || '',
          payment_terms: data.payment_terms || 'net30',
          notes: data.notes || '',
        })
        if (data.lines && data.lines.length > 0) {
          setLines(
            data.lines.map((l: Record<string, unknown>) => {
              const item: LineItem = {
                id: crypto.randomUUID(),
                product_name: (l.product_name as string) || '',
                description: (l.description as string) || '',
                quantity: String(l.quantity ?? '1'),
                unit_price: String(l.unit_price ?? '0'),
                discount: String(l.discount ?? '0'),
                tax_rate: String(l.tax_rate ?? '0'),
                line_total: 0,
              }
              item.line_total = calcLineTotal(item)
              return item
            })
          )
        }
      })
      .catch(() => {
        toast.error('Failed to load invoice')
        router.push('/sales/invoices')
      })
      .finally(() => setLoading(false))
  }, [id, router])

  const setField =
    (key: keyof InvoiceForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const setSelectField = (key: keyof InvoiceForm) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const updateLine = useCallback(
    (id: string, key: keyof LineItem, value: string) => {
      setLines((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l
          const updated = { ...l, [key]: value }
          updated.line_total = calcLineTotal(updated)
          return updated
        })
      )
    },
    []
  )

  const addLine = () => setLines((prev) => [...prev, newLineItem()])

  const removeLine = (lid: string) =>
    setLines((prev) => prev.filter((l) => l.id !== lid))

  const subtotal = lines.reduce((acc, l) => {
    const qty = parseFloat(l.quantity) || 0
    const price = parseFloat(l.unit_price) || 0
    const disc = parseFloat(l.discount) || 0
    return acc + qty * price * (1 - disc / 100)
  }, 0)

  const taxTotal = lines.reduce((acc, l) => {
    const qty = parseFloat(l.quantity) || 0
    const price = parseFloat(l.unit_price) || 0
    const disc = parseFloat(l.discount) || 0
    const taxRate = parseFloat(l.tax_rate) || 0
    const base = qty * price * (1 - disc / 100)
    return acc + base * (taxRate / 100)
  }, 0)

  const grandTotal = subtotal + taxTotal

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customer_name) {
      toast.error('Customer is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        lines: lines.map((l) => ({
          product_name: l.product_name,
          description: l.description,
          quantity: parseFloat(l.quantity) || 0,
          unit_price: parseFloat(l.unit_price) || 0,
          discount: parseFloat(l.discount) || 0,
          tax_rate: parseFloat(l.tax_rate) || 0,
          line_total: l.line_total,
        })),
        subtotal,
        tax_total: taxTotal,
        total: grandTotal,
      }
      await api.put(`/sales/invoices/${id}`, payload)
      toast.success('Invoice updated successfully')
      router.push('/sales/invoices')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to update invoice'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Edit Invoice"
        breadcrumbs={[
          { label: 'Sales' },
          { label: 'Invoices', href: '/sales/invoices' },
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
              form="invoice-form"
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

      <form id="invoice-form" onSubmit={handleSubmit}>
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

            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Invoice Number">
                <Input id="invoice_number" value={form.invoice_number} onChange={setField('invoice_number')} placeholder="INV-0001" className="h-10" />
              </FormRow>
              <FormRow label="Customer" required>
                <Input id="customer_name" value={form.customer_name} onChange={setField('customer_name')} placeholder="Customer name" className="h-10" />
              </FormRow>
              <FormRow label="Status">
                <Select value={form.status} onValueChange={setSelectField('status')}>
                  <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Currency">
                <Select value={form.currency} onValueChange={setSelectField('currency')}>
                  <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Invoice Date">
                <Input id="invoice_date" type="date" value={form.invoice_date} onChange={setField('invoice_date')} className="h-10" />
              </FormRow>
              <FormRow label="Due Date">
                <Input id="due_date" type="date" value={form.due_date} onChange={setField('due_date')} className="h-10" />
              </FormRow>
              <FormRow label="Payment Terms">
                <Select value={form.payment_terms} onValueChange={setSelectField('payment_terms')}>
                  <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="net15">Net 15</SelectItem>
                    <SelectItem value="net30">Net 30</SelectItem>
                    <SelectItem value="net60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
            </TabsContent>

            <TabsContent value="line-items" className="p-0">
              <div className="flex items-center justify-between px-6 py-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Line Items</p>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-3 text-[12px] gap-1.5" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Line
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4 min-w-[180px]">Product / Service</TableHead>
                      <TableHead className="min-w-[160px]">Description</TableHead>
                      <TableHead className="w-20 text-right">Qty</TableHead>
                      <TableHead className="w-28 text-right">Unit Price</TableHead>
                      <TableHead className="w-24 text-right">Disc %</TableHead>
                      <TableHead className="w-24 text-right">Tax %</TableHead>
                      <TableHead className="w-32 text-right">Line Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="pl-4">
                          <Input value={line.product_name} onChange={(e) => updateLine(line.id, 'product_name', e.target.value)} placeholder="Product name" className="h-7 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input value={line.description} onChange={(e) => updateLine(line.id, 'description', e.target.value)} placeholder="Description" className="h-7 text-xs" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min="0" step="0.001" value={line.quantity} onChange={(e) => updateLine(line.id, 'quantity', e.target.value)} className="h-7 text-xs text-right w-20 ml-auto" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => updateLine(line.id, 'unit_price', e.target.value)} className="h-7 text-xs text-right w-28 ml-auto" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min="0" max="100" step="0.01" value={line.discount} onChange={(e) => updateLine(line.id, 'discount', e.target.value)} className="h-7 text-xs text-right w-20 ml-auto" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min="0" max="100" step="0.01" value={line.tax_rate} onChange={(e) => updateLine(line.id, 'tax_rate', e.target.value)} className="h-7 text-xs text-right w-20 ml-auto" />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium pr-4">
                          {form.currency}{' '}{line.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeLine(line.id)} disabled={lines.length === 1}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end px-4 pb-4 pt-2">
                <div className="flex flex-col gap-1 min-w-[240px]">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{form.currency}{' '}{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="tabular-nums">{form.currency}{' '}{taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{form.currency}{' '}{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="p-6 lg:px-8 lg:py-6">
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Notes</p>
                <Textarea value={form.notes} onChange={setField('notes')} placeholder="Add any notes for this invoice..." rows={8} className="resize-none" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
