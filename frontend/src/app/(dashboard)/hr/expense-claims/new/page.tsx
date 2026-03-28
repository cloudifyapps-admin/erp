'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, CreditCard, ShoppingCart, StickyNote, Plus, X } from 'lucide-react'
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

interface ExpenseForm {
  claim_number: string
  employee_name: string
  status: string
  claim_date: string
  currency: string
  notes: string
}

interface ExpenseItem {
  id: string
  description: string
  category: string
  date: string
  amount: string
}

const INITIAL: ExpenseForm = {
  claim_number: '',
  employee_name: '',
  status: 'draft',
  claim_date: new Date().toISOString().split('T')[0],
  currency: 'USD',
  notes: '',
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
]

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'INR', label: 'INR' },
]

const CATEGORY_OPTIONS = [
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'transport', label: 'Transport' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
]

function FormRow({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4 py-3.5 border-b border-border/30 last:border-b-0">
      <Label className="pt-2.5 text-[13px] font-medium text-muted-foreground leading-tight">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="flex flex-col gap-1">{children}{error && <p className="text-[11px] text-destructive">{error}</p>}</div>
    </div>
  )
}

export default function NewExpenseClaimPage() {
  const router = useRouter()
  const [form, setForm] = useState<ExpenseForm>(INITIAL)
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ExpenseForm, string>>>({})

  const set =
    (key: keyof ExpenseForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof ExpenseForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: '', category: 'other', date: '', amount: '' },
    ])
  }

  const updateItem = (id: string, field: keyof ExpenseItem, val: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: val } : item)))
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const total = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/hr/expense-claims', {
        claim_number: form.claim_number || null,
        employee_name: form.employee_name || null,
        status: form.status,
        claim_date: form.claim_date || null,
        currency: form.currency,
        notes: form.notes || null,
        items: items.map((item) => ({
          description: item.description,
          category: item.category,
          date: item.date || null,
          amount: parseFloat(item.amount) || 0,
        })),
        total_amount: total,
      })
      toast.success('Expense claim created successfully')
      router.push('/hr/expense-claims')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create expense claim'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Expense Claim"
        breadcrumbs={[
          { label: 'HR' },
          { label: 'Expense Claims', href: '/hr/expense-claims' },
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
              form="expense-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Expense Claim'}
            </Button>
          </div>
        }
      />

      <form id="expense-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <CreditCard className="h-[18px] w-[18px]" />
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

            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Claim Number">
                <Input
                  id="claim_number"
                  value={form.claim_number}
                  onChange={set('claim_number')}
                  placeholder="EXP-0001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Employee Name">
                <Input
                  id="employee_name"
                  value={form.employee_name}
                  onChange={set('employee_name')}
                  placeholder="Employee name"
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
              <FormRow label="Claim Date">
                <Input
                  id="claim_date"
                  type="date"
                  value={form.claim_date}
                  onChange={set('claim_date')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Currency">
                <Select value={form.currency} onValueChange={setSelect('currency')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
            </TabsContent>

            <TabsContent value="items" className="p-6 lg:px-8 lg:py-2">
              <div className="flex items-center justify-between pb-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Expense Items</p>
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
                  <p className="text-[13px] text-muted-foreground">No expense items added yet.</p>
                  <p className="text-[12px] text-muted-foreground/60 mt-1">Click &quot;Add Item&quot; to add expense line items.</p>
                </div>
              )}

              {items.length > 0 && (
                <div className="border border-border/40 rounded-lg overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/40">
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Description</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[140px]">Category</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[130px]">Date</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-[110px]">Amount</th>
                        <th className="w-[44px]" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-border/30 last:border-b-0">
                          <td className="px-2 py-1.5">
                            <Input
                              value={item.description}
                              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                              placeholder="Description"
                              className="h-9 text-[13px] border-0 shadow-none focus-visible:ring-1"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Select value={item.category} onValueChange={(v) => updateItem(item.id, 'category', v)}>
                              <SelectTrigger className="h-9 text-[13px] border-0 shadow-none focus-visible:ring-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORY_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateItem(item.id, 'date', e.target.value)}
                              className="h-9 text-[13px] border-0 shadow-none focus-visible:ring-1"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.amount}
                              onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                              placeholder="0.00"
                              className="h-9 text-[13px] text-right border-0 shadow-none focus-visible:ring-1"
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeItem(item.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-end px-3 py-3 bg-muted/20 border-t border-border/40">
                    <div className="text-[13px] font-semibold">
                      Total: {form.currency} {total.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="p-6 lg:p-8">
              <Textarea
                value={form.notes}
                onChange={set('notes')}
                placeholder="Add any relevant notes about this expense claim..."
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
