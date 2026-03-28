'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, CalendarCheck, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface HolidayListForm {
  name: string
  year: string
  country: string
  description: string
}

interface Holiday {
  id: string
  date: string
  name: string
}

const INITIAL: HolidayListForm = {
  name: '',
  year: new Date().getFullYear().toString(),
  country: '',
  description: '',
}

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

export default function NewHolidayListPage() {
  const router = useRouter()
  const [form, setForm] = useState<HolidayListForm>(INITIAL)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof HolidayListForm, string>>>({})

  const set =
    (key: keyof HolidayListForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const addHoliday = () => {
    setHolidays((prev) => [
      ...prev,
      { id: crypto.randomUUID(), date: '', name: '' },
    ])
  }

  const updateHoliday = (id: string, field: 'date' | 'name', val: string) => {
    setHolidays((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: val } : h)))
  }

  const removeHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof HolidayListForm, string>> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/hr/holiday-lists', {
        name: form.name,
        year: form.year ? parseInt(form.year) : null,
        country: form.country || null,
        description: form.description || null,
        holidays: holidays.map((h) => ({
          date: h.date,
          name: h.name,
        })),
      })
      toast.success('Holiday list created successfully')
      router.push('/hr/holiday-lists')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create holiday list'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Holiday List"
        breadcrumbs={[
          { label: 'HR' },
          { label: 'Holiday Lists', href: '/hr/holiday-lists' },
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
              form="holiday-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Holiday List'}
            </Button>
          </div>
        }
      />

      <form id="holiday-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <CalendarCheck className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Name" required error={errors.name}>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. US Holidays 2026"
                  aria-invalid={!!errors.name}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Year">
                <Input
                  id="year"
                  type="number"
                  value={form.year}
                  onChange={set('year')}
                  placeholder="2026"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Country">
                <Input
                  id="country"
                  value={form.country}
                  onChange={set('country')}
                  placeholder="e.g. United States"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Description">
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={set('description')}
                  rows={3}
                  placeholder="Description of this holiday list"
                />
              </FormRow>

              {/* Holidays table */}
              <div className="pt-5 pb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Holidays</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-[12px] gap-1.5"
                  onClick={addHoliday}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Holiday
                </Button>
              </div>

              {holidays.length === 0 && (
                <div className="py-6 text-center border border-dashed border-border/50 rounded-lg">
                  <p className="text-[13px] text-muted-foreground">No holidays added yet.</p>
                  <p className="text-[12px] text-muted-foreground/60 mt-1">Click &quot;Add Holiday&quot; to add holidays to this list.</p>
                </div>
              )}

              {holidays.length > 0 && (
                <div className="border border-border/40 rounded-lg overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/40">
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[160px]">Date</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Holiday Name</th>
                        <th className="w-[44px]" />
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.map((h) => (
                        <tr key={h.id} className="border-b border-border/30 last:border-b-0">
                          <td className="px-2 py-1.5">
                            <Input
                              type="date"
                              value={h.date}
                              onChange={(e) => updateHoliday(h.id, 'date', e.target.value)}
                              className="h-9 text-[13px] border-0 shadow-none focus-visible:ring-1"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={h.name}
                              onChange={(e) => updateHoliday(h.id, 'name', e.target.value)}
                              placeholder="Holiday name"
                              className="h-9 text-[13px] border-0 shadow-none focus-visible:ring-1"
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeHoliday(h.id)}
                            >
                              <X className="h-4 w-4" />
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
