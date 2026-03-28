'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Package, DollarSign, Warehouse, Info, Plus, X, Loader2 } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

interface ProductForm {
  name: string
  sku: string
  barcode: string
  type: string
  category: string
  unit: string
  price: string
  cost: string
  currency: string
  tax_rate: string
  min_stock_level: string
  reorder_point: string
  description: string
  status: string
  is_serialized: boolean
  is_batch_tracked: boolean
  weight: string
  weight_unit: string
}

interface CustomField {
  id: string
  key: string
  value: string
}

const INITIAL: ProductForm = {
  name: '',
  sku: '',
  barcode: '',
  type: 'finished_good',
  category: '',
  unit: 'pcs',
  price: '',
  cost: '',
  currency: 'USD',
  tax_rate: '0',
  min_stock_level: '0',
  reorder_point: '0',
  description: '',
  status: 'active',
  is_serialized: false,
  is_batch_tracked: false,
  weight: '',
  weight_unit: 'kg',
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

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<ProductForm>(INITIAL)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ProductForm, string>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])

  useEffect(() => {
    api
      .get(`/inventory/products/${id}`)
      .then(({ data }) => {
        setForm({
          name: data.name ?? '',
          sku: data.sku ?? '',
          barcode: data.barcode ?? '',
          type: data.type ?? 'finished_good',
          category: data.category ?? '',
          unit: data.unit ?? 'pcs',
          price: data.selling_price ? String(data.selling_price) : '',
          cost: data.purchase_price ? String(data.purchase_price) : '',
          currency: data.currency ?? 'USD',
          tax_rate: data.tax_rate ? String(data.tax_rate) : '0',
          min_stock_level: data.min_stock_level ? String(data.min_stock_level) : '0',
          reorder_point: data.reorder_level ? String(data.reorder_level) : '0',
          description: data.description ?? '',
          status: data.status ?? 'active',
          is_serialized: data.is_serialized ?? false,
          is_batch_tracked: data.is_batch_tracked ?? false,
          weight: data.weight ? String(data.weight) : '',
          weight_unit: data.weight_unit ?? 'kg',
        })
        if (data.custom_fields && typeof data.custom_fields === 'object') {
          const existing = Object.entries(data.custom_fields).map(([key, value]) => ({
            id: crypto.randomUUID(),
            key,
            value: String(value),
          }))
          setCustomFields(existing)
        }
      })
      .catch(() => toast.error('Failed to load product'))
      .finally(() => setLoadingData(false))
  }, [id])

  const set =
    (key: keyof ProductForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof ProductForm) => (value: string) => {
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
    const errs: Partial<Record<keyof ProductForm, string>> = {}
    if (!form.name.trim()) errs.name = 'Product name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.put(`/inventory/products/${id}`, {
        name: form.name,
        sku: form.sku || null,
        barcode: form.barcode || null,
        type: form.type,
        status: form.status,
        description: form.description || null,
        selling_price: parseFloat(form.price) || 0,
        purchase_price: parseFloat(form.cost) || 0,
        reorder_level: parseFloat(form.reorder_point) || 0,
        track_inventory: true,
      })
      toast.success('Product updated successfully')
      router.push('/inventory/products')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to update product'
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
        title="Edit Product"
        breadcrumbs={[
          { label: 'Inventory' },
          { label: 'Products', href: '/inventory/products' },
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
              form="product-form"
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

      <form id="product-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Package className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="pricing" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <DollarSign className="h-[18px] w-[18px]" />
                  Pricing
                </TabsTrigger>
                <TabsTrigger value="inventory" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Warehouse className="h-[18px] w-[18px]" />
                  Inventory
                </TabsTrigger>
                <TabsTrigger value="additional" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Info className="h-[18px] w-[18px]" />
                  Additional Information
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Details */}
            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Product Name" required error={errors.name}>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Office Chair"
                  aria-invalid={!!errors.name}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="SKU">
                <Input
                  id="sku"
                  value={form.sku}
                  onChange={set('sku')}
                  placeholder="PRD-001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Barcode">
                <Input
                  id="barcode"
                  value={form.barcode}
                  onChange={set('barcode')}
                  placeholder="123456789012"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Type">
                <Select value={form.type} onValueChange={setSelect('type')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finished_good">Finished Good</SelectItem>
                    <SelectItem value="raw_material">Raw Material</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="consumable">Consumable</SelectItem>
                    <SelectItem value="asset">Asset</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Category">
                <Input
                  id="category"
                  value={form.category}
                  onChange={set('category')}
                  placeholder="Furniture"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Unit of Measure">
                <Select value={form.unit} onValueChange={setSelect('unit')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces</SelectItem>
                    <SelectItem value="kg">Kilograms</SelectItem>
                    <SelectItem value="ltr">Liters</SelectItem>
                    <SelectItem value="mtr">Meters</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="set">Set</SelectItem>
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
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Description">
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={set('description')}
                  rows={3}
                  className="resize-none"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Pricing */}
            <TabsContent value="pricing" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Selling Price">
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={set('price')}
                  placeholder="0.00"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Cost Price">
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={set('cost')}
                  placeholder="0.00"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Currency">
                <Select value={form.currency} onValueChange={setSelect('currency')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Tax Rate (%)">
                <Input
                  id="tax_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.tax_rate}
                  onChange={set('tax_rate')}
                  className="h-10"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Inventory */}
            <TabsContent value="inventory" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Minimum Stock Level">
                <Input
                  id="min_stock_level"
                  type="number"
                  min="0"
                  value={form.min_stock_level}
                  onChange={set('min_stock_level')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Reorder Point">
                <Input
                  id="reorder_point"
                  type="number"
                  min="0"
                  value={form.reorder_point}
                  onChange={set('reorder_point')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Weight">
                <Input
                  id="weight"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.weight}
                  onChange={set('weight')}
                  placeholder="0.00"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Weight Unit">
                <Select value={form.weight_unit} onValueChange={setSelect('weight_unit')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="lb">Pounds (lb)</SelectItem>
                    <SelectItem value="oz">Ounces (oz)</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Serial Number Tracking">
                <div className="flex items-center pt-2">
                  <Switch
                    id="serialized"
                    checked={form.is_serialized}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, is_serialized: v }))}
                  />
                </div>
              </FormRow>
              <FormRow label="Batch Tracking">
                <div className="flex items-center pt-2">
                  <Switch
                    id="batch"
                    checked={form.is_batch_tracked}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, is_batch_tracked: v }))}
                  />
                </div>
              </FormRow>
            </TabsContent>

            {/* Tab: Additional Information — custom key-value fields */}
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
