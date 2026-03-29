'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FolderKanban, DollarSign, Info, Plus, X, Loader2, LayoutTemplate } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'

interface ProjectForm {
  name: string
  code: string
  description: string
  client_name: string
  manager_email: string
  start_date: string
  end_date: string
  budget: string
  currency: string
  billing_type: string
  status: string
  priority: string
  category_id: string
}

interface ProjectCategory {
  id: string
  name: string
}

interface ProjectTemplate {
  id: string
  name: string
  description?: string
  task_count: number
  milestone_count: number
}

interface CustomField {
  id: string
  key: string
  value: string
}

const INITIAL: ProjectForm = {
  name: '',
  code: '',
  description: '',
  client_name: '',
  manager_email: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  budget: '',
  currency: 'USD',
  billing_type: 'fixed',
  status: 'planning',
  priority: 'medium',
  category_id: '',
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

export default function NewProjectPage() {
  const router = useRouter()
  const [form, setForm] = useState<ProjectForm>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectForm, string>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [categories, setCategories] = useState<ProjectCategory[]>([])
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false)

  // Fetch categories and templates on mount
  useEffect(() => {
    api
      .get('/settings/master-data/project-categories')
      .then(({ data }) => {
        const items = normalizePaginated<ProjectCategory>(data).items
        setCategories(items)
      })
      .catch(() => {})
    api
      .get('/projects/templates')
      .then(({ data }) => {
        const items = normalizePaginated<ProjectTemplate>(data).items
        setTemplates(items)
      })
      .catch(() => {})
  }, [])

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateId || !form.name.trim()) {
      toast.error('Please enter a project name first')
      return
    }
    setCreatingFromTemplate(true)
    try {
      const { data } = await api.post(`/projects/templates/${selectedTemplateId}/use`, {
        name: form.name,
        category_id: form.category_id || null,
        priority: form.priority,
        billing_type: form.billing_type,
      })
      toast.success('Project created from template')
      setTemplateDialogOpen(false)
      router.push(`/projects/${data.id}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to create from template'
      toast.error(msg)
    } finally {
      setCreatingFromTemplate(false)
    }
  }

  const set =
    (key: keyof ProjectForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof ProjectForm) => (value: string) => {
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
    const errs: Partial<Record<keyof ProjectForm, string>> = {}
    if (!form.name.trim()) errs.name = 'Project name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const { data } = await api.post('/projects', {
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        client_name: form.client_name || null,
        manager_email: form.manager_email || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget: form.budget ? parseFloat(form.budget) : null,
        currency: form.currency || null,
        billing_type: form.billing_type || null,
        status: form.status,
        priority: form.priority,
        category_id: form.category_id && form.category_id !== '__none__' ? form.category_id : null,
      })
      toast.success('Project created')
      router.push(`/projects/${data.id}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to create project'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New Project"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }]}
        actions={
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg px-4 text-[13px] gap-1.5"
                onClick={() => setTemplateDialogOpen(true)}
                disabled={saving}
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                From Template
              </Button>
            )}
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
              form="project-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        }
      />

      <form id="project-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <FolderKanban className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <DollarSign className="h-[18px] w-[18px]" />
                  Timeline &amp; Budget
                </TabsTrigger>
                <TabsTrigger value="additional" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Info className="h-[18px] w-[18px]" />
                  Additional Information
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Details */}
            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Project Name" required error={errors.name}>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Website Redesign"
                  aria-invalid={!!errors.name}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Project Code">
                <Input
                  id="code"
                  value={form.code}
                  onChange={set('code')}
                  placeholder="PRJ-001"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Client">
                <Input
                  id="client_name"
                  value={form.client_name}
                  onChange={set('client_name')}
                  placeholder="Acme Corp"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Manager Email">
                <Input
                  id="manager_email"
                  type="email"
                  value={form.manager_email}
                  onChange={set('manager_email')}
                  placeholder="manager@example.com"
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Category">
                <Select value={form.category_id} onValueChange={setSelect('category_id')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Priority">
                <Select value={form.priority} onValueChange={setSelect('priority')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Status">
                <Select value={form.status} onValueChange={setSelect('status')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Description">
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Describe the project scope and objectives..."
                  rows={3}
                  className="resize-none"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Timeline & Budget */}
            <TabsContent value="timeline" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Start Date">
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={set('start_date')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="End Date">
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={set('end_date')}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Budget">
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget}
                  onChange={set('budget')}
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
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Billing Type">
                <Select value={form.billing_type} onValueChange={setSelect('billing_type')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                    <SelectItem value="time_material">Time &amp; Material</SelectItem>
                    <SelectItem value="retainer">Retainer</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
            </TabsContent>

            {/* Tab: Additional Information */}
            <TabsContent value="additional" className="p-6 lg:px-8 lg:py-2">
              {/* Dynamic custom key-value fields */}
              <div className="pt-5 pb-2 flex items-center justify-between">
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

      {/* Template picker dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create from Template</DialogTitle>
            <DialogDescription>
              Select a template to create your project with predefined tasks and milestones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTemplateId === tpl.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 hover:border-primary/30'
                }`}
                onClick={() => setSelectedTemplateId(tpl.id)}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                  <LayoutTemplate className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{tpl.name}</p>
                  {tpl.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {tpl.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>{tpl.task_count ?? 0} tasks</span>
                    <span>{tpl.milestone_count ?? 0} milestones</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)} disabled={creatingFromTemplate}>
              Cancel
            </Button>
            <Button onClick={handleCreateFromTemplate} disabled={creatingFromTemplate || !selectedTemplateId}>
              {creatingFromTemplate && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create from Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
