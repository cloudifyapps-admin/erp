'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeftRight, ShoppingCart, Plus, Trash2 } from 'lucide-react'
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

interface TransferForm {
  transfer_number: string
  from_warehouse: string
  to_warehouse: string
  transfer_date: string
  status: string
  notes: string
}

interface TransferItem {
  id: string
  product_name: string
  quantity: string
  unit: string
}

const INITIAL: TransferForm = {
  transfer_number: '',
  from_warehouse: '',
  to_warehouse: '',
  transfer_date: new Date().toISOString().split('T')[0],
  status: 'draft',
  notes: '',
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

export default function NewStockTransferPage() {
  const router = useRouter()
  const [form, setForm] = useState<TransferForm>(INITIAL)
  const [items, setItems] = useState<TransferItem[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof TransferForm, string>>>({})

  const set =
    (key: keyof TransferForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof TransferForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), product_name: '', quantity: '0', unit: 'pcs' },
    ])
  }

  const updateItem = (id: string, field: keyof TransferItem, val: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: val } : it)))
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof TransferForm, string>> = {}
    if (!form.from_warehouse.trim()) errs.from_warehouse = 'Source warehouse is required'
    if (!form.to_warehouse.trim()) errs.to_warehouse = 'Destination warehouse is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/inventory/stock-transfers', {
        transfer_number: form.transfer_number || null,
        from_warehouse: form.from_warehouse,
        to_warehouse: form.to_warehouse,
        transfer_date: form.transfer_date || null,
        status: form.status,
        notes: form.notes || null,
        items: items.map((it) => ({
          product_name: it.product_name,
          quantity: parseFloat(it.quantity) || 0,
          unit: it.unit,
        })),
      })
      toast.success('Stock transfer created successfully')
      router.push('/inventory/stock-transfers')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create stock transfer'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Stock Transfer"
        breadcrumbs={[
          { label: 'Inventory' },
          { label: 'Transfers', href: '/inventory/stock-transfers' },
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
              form="transfer-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Transfer'}
            </Button>
          </div>
        }
      />

      <form id="transfer-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <ArrowLeftRight className="h-[18px] w-[18px]" />
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
              <FormRow label="Transfer Number">
                <Input
                  id="transfer_number"
                  value={form.transfer_number}
                  onChange={set('transfer_number')}
                  placeholder="TRF-0001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="From Warehouse" required error={errors.from_warehouse}>
                <Input
                  id="from_warehouse"
                  value={form.from_warehouse}
                  onChange={set('from_warehouse')}
                  placeholder="Source warehouse"
                  aria-invalid={!!errors.from_warehouse}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="To Warehouse" required error={errors.to_warehouse}>
                <Input
                  id="to_warehouse"
                  value={form.to_warehouse}
                  onChange={set('to_warehouse')}
                  placeholder="Destination warehouse"
                  aria-invalid={!!errors.to_warehouse}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Transfer Date">
                <Input
                  id="transfer_date"
                  type="date"
                  value={form.transfer_date}
                  onChange={set('transfer_date')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Status">
                <Select value={form.status} onValueChange={setSelect('status')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Notes">
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="Additional notes about this transfer..."
                  rows={3}
                  className="resize-none"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Items */}
            <TabsContent value="items" className="p-6 lg:px-8 lg:py-2">
              <div className="flex items-center justify-between pb-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Transfer Items</p>
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
                  <p className="text-[12px] text-muted-foreground/60 mt-1">Click &quot;Add Item&quot; to add products for transfer.</p>
                </div>
              )}

              {items.length > 0 && (
                <div className="border border-border/40 rounded-lg overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Product Name</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">Quantity</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">Unit</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
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
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                              className="h-9"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={item.unit}
                              onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                              placeholder="pcs"
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
                      ))}
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
