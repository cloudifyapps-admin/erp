'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, SlidersHorizontal, ShoppingCart, Plus, Trash2 } from 'lucide-react'
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

interface AdjustmentForm {
  reference_number: string
  warehouse: string
  adjustment_date: string
  reason: string
  status: string
}

interface AdjustmentItem {
  id: string
  product_name: string
  current_qty: string
  new_qty: string
  notes: string
}

const INITIAL: AdjustmentForm = {
  reference_number: '',
  warehouse: '',
  adjustment_date: new Date().toISOString().split('T')[0],
  reason: 'count_correction',
  status: 'draft',
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

export default function NewStockAdjustmentPage() {
  const router = useRouter()
  const [form, setForm] = useState<AdjustmentForm>(INITIAL)
  const [items, setItems] = useState<AdjustmentItem[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof AdjustmentForm, string>>>({})

  const set =
    (key: keyof AdjustmentForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof AdjustmentForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), product_name: '', current_qty: '0', new_qty: '0', notes: '' },
    ])
  }

  const updateItem = (id: string, field: keyof AdjustmentItem, val: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: val } : it)))
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof AdjustmentForm, string>> = {}
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/inventory/stock-adjustments', {
        reference_number: form.reference_number || null,
        warehouse: form.warehouse || null,
        adjustment_date: form.adjustment_date || null,
        reason: form.reason,
        status: form.status,
        items: items.map((it) => ({
          product_name: it.product_name,
          current_qty: parseFloat(it.current_qty) || 0,
          new_qty: parseFloat(it.new_qty) || 0,
          notes: it.notes || null,
        })),
      })
      toast.success('Stock adjustment created successfully')
      router.push('/inventory/stock-adjustments')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create stock adjustment'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Stock Adjustment"
        breadcrumbs={[
          { label: 'Inventory' },
          { label: 'Adjustments', href: '/inventory/stock-adjustments' },
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
              form="adjustment-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Adjustment'}
            </Button>
          </div>
        }
      />

      <form id="adjustment-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <SlidersHorizontal className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="items" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <ShoppingCart className="h-[18px] w-[18px]" />
                  Items
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Details */}
            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Reference Number">
                <Input
                  id="reference_number"
                  value={form.reference_number}
                  onChange={set('reference_number')}
                  placeholder="ADJ-0001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Warehouse">
                <Input
                  id="warehouse"
                  value={form.warehouse}
                  onChange={set('warehouse')}
                  placeholder="Main Warehouse"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Adjustment Date">
                <Input
                  id="adjustment_date"
                  type="date"
                  value={form.adjustment_date}
                  onChange={set('adjustment_date')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Reason">
                <Select value={form.reason} onValueChange={setSelect('reason')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="damaged">Damaged</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="count_correction">Count Correction</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Status">
                <Select value={form.status} onValueChange={setSelect('status')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
            </TabsContent>

            {/* Tab: Items */}
            <TabsContent value="items" className="p-6 lg:px-8 lg:py-2">
              <div className="flex items-center justify-between pb-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Adjustment Items</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-[12px] gap-1.5"
                  onClick={addItem}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </Button>
              </div>

              {items.length === 0 && (
                <div className="py-6 text-center border border-dashed border-border/50 rounded-lg">
                  <p className="text-[13px] text-muted-foreground">No items added yet.</p>
                  <p className="text-[12px] text-muted-foreground/60 mt-1">Click &quot;Add Item&quot; to add products for adjustment.</p>
                </div>
              )}

              {items.length > 0 && (
                <div className="border border-border/40 rounded-lg overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Product Name</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Current Qty</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">New Qty</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Difference</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Notes</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const diff = (parseFloat(item.new_qty) || 0) - (parseFloat(item.current_qty) || 0)
                        return (
                          <tr key={item.id} className="border-b border-border/30 last:border-b-0">
                            <td className="px-4 py-2">
                              <Input
                                value={item.product_name}
                                onChange={(e) => updateItem(item.id, 'product_name', e.target.value)}
                                placeholder="Product name"
                                className="h-9"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                min="0"
                                value={item.current_qty}
                                onChange={(e) => updateItem(item.id, 'current_qty', e.target.value)}
                                className="h-9"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                min="0"
                                value={item.new_qty}
                                onChange={(e) => updateItem(item.id, 'new_qty', e.target.value)}
                                className="h-9"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-[13px] font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {diff > 0 ? '+' : ''}{diff}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={item.notes}
                                onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                                placeholder="Notes"
                                className="h-9"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
