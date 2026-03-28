'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Truck, ShoppingCart, StickyNote, Plus, Trash2, Loader2 } from 'lucide-react'
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

interface DeliveryItem {
  id: string
  product_name: string
  quantity: string
  unit: string
}

interface DeliveryForm {
  delivery_number: string
  order_reference: string
  customer_name: string
  status: string
  shipping_method: string
  tracking_number: string
  delivery_date: string
  shipping_address: string
  notes: string
}

const INITIAL_FORM: DeliveryForm = {
  delivery_number: '',
  order_reference: '',
  customer_name: '',
  status: 'pending',
  shipping_method: '',
  tracking_number: '',
  delivery_date: '',
  shipping_address: '',
  notes: '',
}

const newDeliveryItem = (): DeliveryItem => ({
  id: crypto.randomUUID(),
  product_name: '',
  quantity: '1',
  unit: 'pcs',
})

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

export default function NewDeliveryPage() {
  const router = useRouter()
  const [form, setForm] = useState<DeliveryForm>(INITIAL_FORM)
  const [items, setItems] = useState<DeliveryItem[]>([newDeliveryItem()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .get('/numbering/peek/delivery')
      .then(({ data }) => {
        if (data?.number) setForm((f) => ({ ...f, delivery_number: data.number }))
      })
      .catch(() => {/* optional */})
  }, [])

  const setField =
    (key: keyof DeliveryForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const setSelectField = (key: keyof DeliveryForm) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const updateItem = useCallback(
    (id: string, key: keyof DeliveryItem, value: string) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [key]: value } : item))
      )
    },
    []
  )

  const addItem = () => setItems((prev) => [...prev, newDeliveryItem()])

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((item) => item.id !== id))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customer_name) {
      toast.error('Customer is required')
      return
    }
    if (items.length === 0) {
      toast.error('At least one item is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        items: items.map((item) => ({
          product_name: item.product_name,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit,
        })),
      }
      await api.post('/sales/deliveries', payload)
      toast.success('Delivery created successfully')
      router.push('/sales/deliveries')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create delivery'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Delivery"
        breadcrumbs={[
          { label: 'Sales' },
          { label: 'Deliveries', href: '/sales/deliveries' },
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
              form="delivery-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Delivery'}
            </Button>
          </div>
        }
      />

      <form id="delivery-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Truck className="h-[18px] w-[18px]" />
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
              <FormRow label="Delivery Number">
                <Input id="delivery_number" value={form.delivery_number} onChange={setField('delivery_number')} placeholder="DEL-0001" className="h-10" />
              </FormRow>
              <FormRow label="Order Reference">
                <Input id="order_reference" value={form.order_reference} onChange={setField('order_reference')} placeholder="SO-0001" className="h-10" />
              </FormRow>
              <FormRow label="Customer" required>
                <Input id="customer_name" value={form.customer_name} onChange={setField('customer_name')} placeholder="Customer name" className="h-10" />
              </FormRow>
              <FormRow label="Status">
                <Select value={form.status} onValueChange={setSelectField('status')}>
                  <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Shipping Method">
                <Input id="shipping_method" value={form.shipping_method} onChange={setField('shipping_method')} placeholder="e.g. Ground, Express, Air" className="h-10" />
              </FormRow>
              <FormRow label="Tracking Number">
                <Input id="tracking_number" value={form.tracking_number} onChange={setField('tracking_number')} placeholder="Tracking number" className="h-10" />
              </FormRow>
              <FormRow label="Delivery Date">
                <Input id="delivery_date" type="date" value={form.delivery_date} onChange={setField('delivery_date')} className="h-10" />
              </FormRow>
              <FormRow label="Shipping Address">
                <Textarea id="shipping_address" value={form.shipping_address} onChange={setField('shipping_address')} placeholder="Enter shipping address" rows={3} className="resize-none" />
              </FormRow>
            </TabsContent>

            {/* Tab: Items */}
            <TabsContent value="items" className="p-0">
              <div className="flex items-center justify-between px-6 py-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Delivery Items</p>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-3 text-[12px] gap-1.5" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4 min-w-[240px]">Product</TableHead>
                      <TableHead className="w-28 text-right">Quantity</TableHead>
                      <TableHead className="w-32">Unit</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="pl-4">
                          <Input value={item.product_name} onChange={(e) => updateItem(item.id, 'product_name', e.target.value)} placeholder="Product name" className="h-7 text-xs" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min="0" step="0.001" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} className="h-7 text-xs text-right w-24 ml-auto" />
                        </TableCell>
                        <TableCell>
                          <Input value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} placeholder="pcs" className="h-7 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab: Notes */}
            <TabsContent value="notes" className="p-6 lg:px-8 lg:py-6">
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Notes</p>
                <Textarea value={form.notes} onChange={setField('notes')} placeholder="Add any notes for this delivery..." rows={8} className="resize-none" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </div>
  )
}
