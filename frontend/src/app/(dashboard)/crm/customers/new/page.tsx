'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface CustomerForm {
  // Details
  code: string
  name: string
  type: string
  email: string
  phone: string
  mobile: string
  website: string
  tax_id: string
  status: string
  notes: string
  // Billing
  billing_address: string
  billing_city: string
  billing_state: string
  billing_postal_code: string
  billing_country: string
  // Shipping
  shipping_address: string
  shipping_city: string
  shipping_state: string
  shipping_postal_code: string
  shipping_country: string
  // Settings
  currency: string
  payment_terms: string
  credit_limit: string
  price_list: string
}

const INITIAL: CustomerForm = {
  code: '',
  name: '',
  type: 'company',
  email: '',
  phone: '',
  mobile: '',
  website: '',
  tax_id: '',
  status: 'active',
  notes: '',
  billing_address: '',
  billing_city: '',
  billing_state: '',
  billing_postal_code: '',
  billing_country: '',
  shipping_address: '',
  shipping_city: '',
  shipping_state: '',
  shipping_postal_code: '',
  shipping_country: '',
  currency: 'USD',
  payment_terms: 'net30',
  credit_limit: '',
  price_list: '',
}

export default function NewCustomerPage() {
  const router = useRouter()
  const [form, setForm] = useState<CustomerForm>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerForm, string>>>({})

  const set =
    (key: keyof CustomerForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((e) => ({ ...e, [key]: undefined }))
    }

  const setSelect = (key: keyof CustomerForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const copyBillingToShipping = () => {
    setForm((f) => ({
      ...f,
      shipping_address: f.billing_address,
      shipping_city: f.billing_city,
      shipping_state: f.billing_state,
      shipping_postal_code: f.billing_postal_code,
      shipping_country: f.billing_country,
    }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof CustomerForm, string>> = {}
    if (!form.name.trim()) errs.name = 'Customer name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
      }
      await api.post('/crm/customers', payload)
      toast.success('Customer created successfully')
      router.push('/crm/customers')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create customer'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl">
      <PageHeader
        title="New Customer"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Customers', href: '/crm/customers' },
          { label: 'New' },
        ]}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="billing">Billing Address</TabsTrigger>
            <TabsTrigger value="shipping">Shipping Address</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">
                    Customer Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="Acme Corporation"
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="code">Customer Code</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={set('code')}
                    placeholder="CUST-0001"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={setSelect('type')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="government">Government</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={setSelect('status')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="contact@acme.com"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="+1 555 0100"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={form.mobile}
                    onChange={set('mobile')}
                    placeholder="+1 555 0101"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={set('website')}
                    placeholder="https://acme.com"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tax_id">Tax ID / VAT Number</Label>
                  <Input
                    id="tax_id"
                    value={form.tax_id}
                    onChange={set('tax_id')}
                    placeholder="12-3456789"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={set('notes')}
                    rows={3}
                    placeholder="Internal notes..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="billing_address">Street Address</Label>
                  <Input
                    id="billing_address"
                    value={form.billing_address}
                    onChange={set('billing_address')}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="billing_city">City</Label>
                  <Input
                    id="billing_city"
                    value={form.billing_city}
                    onChange={set('billing_city')}
                    placeholder="New York"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="billing_state">State / Province</Label>
                  <Input
                    id="billing_state"
                    value={form.billing_state}
                    onChange={set('billing_state')}
                    placeholder="NY"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="billing_postal_code">Postal Code</Label>
                  <Input
                    id="billing_postal_code"
                    value={form.billing_postal_code}
                    onChange={set('billing_postal_code')}
                    placeholder="10001"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="billing_country">Country</Label>
                  <Input
                    id="billing_country"
                    value={form.billing_country}
                    onChange={set('billing_country')}
                    placeholder="US"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shipping" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Shipping Address
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyBillingToShipping}
                  >
                    Copy from Billing
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="shipping_address">Street Address</Label>
                  <Input
                    id="shipping_address"
                    value={form.shipping_address}
                    onChange={set('shipping_address')}
                    placeholder="456 Commerce Ave"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="shipping_city">City</Label>
                  <Input
                    id="shipping_city"
                    value={form.shipping_city}
                    onChange={set('shipping_city')}
                    placeholder="New York"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="shipping_state">State / Province</Label>
                  <Input
                    id="shipping_state"
                    value={form.shipping_state}
                    onChange={set('shipping_state')}
                    placeholder="NY"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="shipping_postal_code">Postal Code</Label>
                  <Input
                    id="shipping_postal_code"
                    value={form.shipping_postal_code}
                    onChange={set('shipping_postal_code')}
                    placeholder="10001"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="shipping_country">Country</Label>
                  <Input
                    id="shipping_country"
                    value={form.shipping_country}
                    onChange={set('shipping_country')}
                    placeholder="US"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Commercial Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={setSelect('currency')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD – US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR – Euro</SelectItem>
                      <SelectItem value="GBP">GBP – British Pound</SelectItem>
                      <SelectItem value="INR">INR – Indian Rupee</SelectItem>
                      <SelectItem value="AED">AED – UAE Dirham</SelectItem>
                      <SelectItem value="JPY">JPY – Japanese Yen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Payment Terms</Label>
                  <Select value={form.payment_terms} onValueChange={setSelect('payment_terms')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="net15">Net 15</SelectItem>
                      <SelectItem value="net30">Net 30</SelectItem>
                      <SelectItem value="net45">Net 45</SelectItem>
                      <SelectItem value="net60">Net 60</SelectItem>
                      <SelectItem value="net90">Net 90</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="credit_limit">Credit Limit</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.credit_limit}
                    onChange={set('credit_limit')}
                    placeholder="10000.00"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="price_list">Price List</Label>
                  <Input
                    id="price_list"
                    value={form.price_list}
                    onChange={set('price_list')}
                    placeholder="Standard Retail"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
            {saving ? 'Creating...' : 'Create Customer'}
          </Button>
        </div>
      </form>
    </div>
  )
}
