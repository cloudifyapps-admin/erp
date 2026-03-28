'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2,
  FileText,
  Info,
  Upload,
  Plus,
  X,
  FileUp,
  Paperclip,
  Trash2,
} from 'lucide-react'
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

/* ── Types ──────────────────────────────────────────────────────────── */

interface DocumentForm {
  title: string
  description: string
  category: string
  documentable_type: string
  documentable_id: string
}

interface CustomField {
  id: string
  key: string
  value: string
}

interface PendingFile {
  id: string
  file: File
}

const INITIAL: DocumentForm = {
  title: '',
  description: '',
  category: '',
  documentable_type: '',
  documentable_id: '',
}

const CATEGORY_OPTIONS = [
  { value: 'contract', label: 'Contract' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'report', label: 'Report' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'policy', label: 'Policy' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
]

const RELATED_TYPE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'customer', label: 'Customer' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'sales_order', label: 'Sales Order' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'project', label: 'Project' },
  { value: 'employee', label: 'Employee' },
  { value: 'ticket', label: 'Ticket' },
]

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function UploadDocumentPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<DocumentForm>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof DocumentForm, string>>>({})
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])

  const set =
    (key: keyof DocumentForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const setSelect = (key: keyof DocumentForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  /* ── Custom fields ──────────────────────────────────────────────── */
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

  /* ── File handling ──────────────────────────────────────────────── */
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newFiles: PendingFile[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
    }))
    setPendingFiles((prev) => [...prev, ...newFiles])
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id))
  }

  /* ── Validation ─────────────────────────────────────────────────── */
  const validate = (): boolean => {
    const errs: Partial<Record<keyof DocumentForm, string>> = {}
    if (!form.title.trim()) errs.title = 'Document title is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  /* ── Submit ─────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      // 1. Create document record
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description || null,
        category: form.category || null,
        documentable_type: form.documentable_type || null,
        documentable_id: form.documentable_id ? parseInt(form.documentable_id) : null,
      }

      // Include custom fields if any
      const customData: Record<string, string> = {}
      customFields.forEach((cf) => {
        if (cf.key.trim()) customData[cf.key.trim()] = cf.value
      })
      if (Object.keys(customData).length > 0) {
        payload.custom_fields = customData
      }

      const { data: doc } = await api.post('/documents', payload)

      // 2. Upload each file as attachment
      for (const pf of pendingFiles) {
        const fd = new FormData()
        fd.append('file', pf.file)
        await api.post(`/documents/${doc.id}/attachments`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      toast.success('Document uploaded successfully')
      router.push('/documents')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to upload document'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Upload Document"
        breadcrumbs={[
          { label: 'Documents', href: '/documents' },
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
              form="document-form"
              size="sm"
              className="h-9 rounded-lg px-5 text-[13px] font-semibold shadow-sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Uploading...' : 'Upload Document'}
            </Button>
          </div>
        }
      />

      <form id="document-form" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="gap-0">
            <div className="border-b border-border/40 bg-muted/30 px-6">
              <TabsList variant="line" className="!h-auto gap-2">
                <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <FileText className="h-[18px] w-[18px]" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="files" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Upload className="h-[18px] w-[18px]" />
                  Files
                </TabsTrigger>
                <TabsTrigger value="additional" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                  <Info className="h-[18px] w-[18px]" />
                  Additional Information
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Details */}
            <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
              <FormRow label="Document Title" required error={errors.title}>
                <Input
                  id="title"
                  value={form.title}
                  onChange={set('title')}
                  placeholder="e.g. Q1 Sales Report"
                  aria-invalid={!!errors.title}
                  className="h-10"
                />
              </FormRow>
              <FormRow label="Category">
                <Select value={form.category} onValueChange={setSelect('category')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Related To">
                <Select value={form.documentable_type} onValueChange={setSelect('documentable_type')}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select related entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATED_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value || '__none'} value={o.value || '__none'}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              {form.documentable_type && form.documentable_type !== '__none' && (
                <FormRow label="Related ID">
                  <Input
                    id="documentable_id"
                    value={form.documentable_id}
                    onChange={set('documentable_id')}
                    placeholder="Enter the related record ID"
                    className="h-10"
                  />
                </FormRow>
              )}
              <FormRow label="Description">
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Brief description of this document..."
                  rows={4}
                  className="resize-none"
                />
              </FormRow>
            </TabsContent>

            {/* Tab: Files */}
            <TabsContent value="files" className="p-6 lg:px-8 lg:py-2">
              {/* Drop zone / file picker */}
              <div className="py-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-border/60 rounded-xl bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <FileUp className="size-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-medium text-foreground">
                      Click to upload files
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      PDF, DOC, XLS, images, and more — up to 50 MB each
                    </p>
                  </div>
                </button>
              </div>

              {/* Pending files list */}
              {pendingFiles.length > 0 && (
                <div className="pb-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
                    Selected Files ({pendingFiles.length})
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {pendingFiles.map((pf) => (
                      <div
                        key={pf.id}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/40 bg-muted/20"
                      >
                        <Paperclip className="size-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{pf.file.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatBytes(pf.file.size)} &middot; {pf.file.type || 'Unknown type'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeFile(pf.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingFiles.length === 0 && (
                <div className="pb-4">
                  <div className="py-6 text-center border border-dashed border-border/50 rounded-lg">
                    <p className="text-[13px] text-muted-foreground">No files selected yet.</p>
                    <p className="text-[12px] text-muted-foreground/60 mt-1">
                      Click the upload area above to select files.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab: Additional Information */}
            <TabsContent value="additional" className="p-6 lg:px-8 lg:py-2">
              {/* Dynamic custom key-value fields */}
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
                  <p className="text-[12px] text-muted-foreground/60 mt-1">
                    Click &quot;Add Field&quot; to add custom key-value data.
                  </p>
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
