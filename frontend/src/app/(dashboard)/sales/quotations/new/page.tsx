'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
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
  product_id: string
  product_name: string
  description: string
  quantity: string
  unit_price: string
  discount: string
  tax_rate: string
  line_total: number
}

interface QuotationForm {
  number: string
  customer_id: string
  customer_name: string
  status: string
  currency: string
  valid_until: string
  payment_terms: string
  delivery_terms: string
  notes: string
  terms_and_conditions: string
}

const INITIAL_FORM: QuotationForm = {
  number: '',
  customer_id: '',
  customer_name: '',
  status: 'draft',
  currency: 'USD',
  valid_until: '',
  payment_terms: 'net30',
  delivery_terms: '',
  notes: '',
  terms_and_conditions: '',
}

const newLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  product_id: '',
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

export default function NewQuotationPage() {
  const router = useRouter()
  const [form, setForm] = useState<QuotationForm>(INITIAL_FORM)
  const [lines, setLines] = useState<LineItem[]>([newLineItem()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .get('/numbering/peek/quotation')
      .then(({ data }) => {
        if (data?.number) setForm((f) => ({ ...f, number: data.number }))
      })
      .catch(() => {/* optional */})
  }, [])

  const setField =
    (key: keyof QuotationForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const setSelectField = (key: keyof QuotationForm) => (value: string) =>
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

  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.id !== id))

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
    if (!form.customer_name && !form.customer_id) {
      toast.error('Customer is required')
      return
    }
    if (lines.length === 0) {
      toast.error('At least one line item is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        lines: lines.map((l) => ({
          product_id: l.product_id || null,
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
      await api.post('/sales/quotations', payload)
      toast.success('Quotation created successfully')
      router.push('/sales/quotations')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create quotation'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl">
      <PageHeader
        title="New Quotation"
        breadcrumbs={[
          { label: 'Sales' },
          { label: 'Quotations', href: '/sales/quotations' },
          { label: 'New' },
        ]}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Quotation Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="number">Quotation Number</Label>
              <Input
                id="number"
                value={form.number}
                onChange={setField('number')}
                placeholder="QUO-0001"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer_name">
                Customer <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer_name"
                value={form.customer_name}
                onChange={setField('customer_name')}
                placeholder="Customer name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={setSelectField('status')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={setSelectField('currency')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="valid_until">Valid Until</Label>
              <Input
                id="valid_until"
                type="date"
                value={form.valid_until}
                onChange={setField('valid_until')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Payment Terms</Label>
              <Select value={form.payment_terms} onValueChange={setSelectField('payment_terms')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="net15">Net 15</SelectItem>
                  <SelectItem value="net30">Net 30</SelectItem>
                  <SelectItem value="net45">Net 45</SelectItem>
                  <SelectItem value="net60">Net 60</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Line Items
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Line
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
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
                        <Input
                          value={line.product_name}
                          onChange={(e) => updateLine(line.id, 'product_name', e.target.value)}
                          placeholder="Product name"
                          className="h-7 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                          placeholder="Description"
                          className="h-7 text-xs"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                          className="h-7 text-xs text-right w-20 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) => updateLine(line.id, 'unit_price', e.target.value)}
                          className="h-7 text-xs text-right w-28 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={line.discount}
                          onChange={(e) => updateLine(line.id, 'discount', e.target.value)}
                          className="h-7 text-xs text-right w-20 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={line.tax_rate}
                          onChange={(e) => updateLine(line.id, 'tax_rate', e.target.value)}
                          className="h-7 text-xs text-right w-20 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium pr-4">
                        {form.currency}{' '}
                        {line.line_total.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Totals */}
            <div className="flex justify-end px-4 pb-4 pt-2">
              <div className="flex flex-col gap-1 min-w-[240px]">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">
                    {form.currency}{' '}
                    {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">
                    {form.currency}{' '}
                    {taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {form.currency}{' '}
                    {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes & Terms */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.notes}
                onChange={setField('notes')}
                placeholder="Notes visible to the customer..."
                rows={4}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Terms & Conditions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.terms_and_conditions}
                onChange={setField('terms_and_conditions')}
                placeholder="Terms and conditions..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

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
            {saving ? 'Creating...' : 'Create Quotation'}
          </Button>
        </div>
      </form>
    </div>
  )
}
