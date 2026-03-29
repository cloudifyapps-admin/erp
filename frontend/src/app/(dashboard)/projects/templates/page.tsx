'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  ListChecks,
  Milestone,
  Search as SearchIcon,
} from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ProjectTemplate {
  id: string
  name: string
  description?: string
  task_count: number
  milestone_count: number
  created_at: string
  updated_at?: string
}

interface TemplateForm {
  name: string
  description: string
}

const INITIAL_FORM: TemplateForm = { name: '', description: '' }

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateForm>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [useTemplateId, setUseTemplateId] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/projects/templates', {
        params: { ...(search && { search }) },
      })
      const normalized = normalizePaginated<ProjectTemplate>(raw)
      setTemplates(normalized.items)
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openCreate = () => {
    setEditingId(null)
    setForm(INITIAL_FORM)
    setDialogOpen(true)
  }

  const openEdit = (template: ProjectTemplate) => {
    setEditingId(template.id)
    setForm({ name: template.name, description: template.description || '' })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Template name is required')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/projects/templates/${editingId}`, {
          name: form.name,
          description: form.description || null,
        })
        toast.success('Template updated')
      } else {
        await api.post('/projects/templates', {
          name: form.name,
          description: form.description || null,
        })
        toast.success('Template created')
      }
      setDialogOpen(false)
      fetchData()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to save template'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/projects/templates/${deleteId}`)
      toast.success('Template deleted')
      setDeleteId(null)
      fetchData()
    } catch {
      toast.error('Failed to delete template')
    } finally {
      setDeleting(false)
    }
  }

  const handleUseTemplate = async () => {
    if (!useTemplateId || !newProjectName.trim()) {
      toast.error('Project name is required')
      return
    }
    setCreatingProject(true)
    try {
      const { data } = await api.post(`/projects/from-template/${useTemplateId}`, {
        name: newProjectName,
      })
      toast.success('Project created from template')
      setUseTemplateId(null)
      setNewProjectName('')
      router.push(`/projects/${data.id}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to create project from template'
      toast.error(msg)
    } finally {
      setCreatingProject(false)
    }
  }

  const filtered = search
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase())
      )
    : templates

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Project Templates"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Templates' }]}
        createLabel="New Template"
        createIcon={Plus}
        actions={
          <Button
            size="sm"
            className="h-9 rounded-lg px-4 gap-1.5 shadow-sm font-semibold text-[13px]"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            New Template
          </Button>
        }
      />

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Template grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card p-5 animate-pulse"
            >
              <div className="h-5 w-3/4 rounded bg-muted-foreground/10 mb-3" />
              <div className="h-3 w-full rounded bg-muted-foreground/8 mb-2" />
              <div className="h-3 w-2/3 rounded bg-muted-foreground/8 mb-4" />
              <div className="h-8 w-full rounded bg-muted-foreground/5" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-12 flex flex-col items-center justify-center gap-3">
          <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center">
            <LayoutTemplate className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-foreground/80">No templates found</p>
          <p className="text-xs text-muted-foreground text-center max-w-sm">
            Templates help you quickly set up new projects with predefined tasks and milestones.
          </p>
          <Button size="sm" className="mt-2 gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="group rounded-xl border border-border/60 bg-card p-5 hover:shadow-md transition-all flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LayoutTemplate className="h-4 w-4" />
                  </div>
                  <Link
                    href={`/projects/templates/${template.id}`}
                    className="font-semibold text-sm line-clamp-1 hover:text-primary hover:underline transition-colors"
                  >
                    {template.name}
                  </Link>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(template)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteId(template.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {template.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {template.description}
                </p>
              )}

              <div className="flex items-center gap-3 mt-auto mb-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" />
                  {template.task_count ?? 0} tasks
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Milestone className="h-3.5 w-3.5" />
                  {template.milestone_count ?? 0} milestones
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs gap-1.5"
                onClick={() => {
                  setUseTemplateId(template.id)
                  setNewProjectName('')
                }}
              >
                <Copy className="h-3 w-3" />
                Use Template
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Template' : 'New Template'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the template details below.'
                : 'Create a reusable project template with predefined structure.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name" className="text-[13px]">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="template-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Web Development Project"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-desc" className="text-[13px]">
                Description
              </Label>
              <Textarea
                id="template-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe this template..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use Template dialog */}
      <Dialog open={!!useTemplateId} onOpenChange={(open) => !open && setUseTemplateId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Project from Template</DialogTitle>
            <DialogDescription>
              A new project will be created with tasks and milestones from this template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-name" className="text-[13px]">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Client Website Redesign"
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseTemplateId(null)} disabled={creatingProject}>
              Cancel
            </Button>
            <Button onClick={handleUseTemplate} disabled={creatingProject}>
              {creatingProject && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
