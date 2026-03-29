'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  Trash2,
  ListChecks,
  Target,
  Clock,
  LayoutTemplate,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

/* ── Types ─────────────────────────────────────────────────────────── */

interface TemplateTask {
  title: string
  priority: string
  status: string
  estimated_hours: number | null
}

interface TemplateMilestone {
  title: string
  description?: string
}

interface TemplateData {
  tasks: TemplateTask[]
  milestones: TemplateMilestone[]
}

interface ProjectTemplate {
  id: string
  name: string
  description?: string
  default_billing_type?: string
  template_data: TemplateData
}

/* ── Constants ─────────────────────────────────────────────────────── */

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
const STATUSES = ['todo', 'in_progress', 'review', 'done'] as const

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const STATUS_STYLES: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
}

const INITIAL_TASK: TemplateTask = { title: '', priority: 'medium', status: 'todo', estimated_hours: null }
const INITIAL_MILESTONE: TemplateMilestone = { title: '', description: '' }

/* ── Page ──────────────────────────────────────────────────────────── */

export default function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: templateId } = use(params)

  const [template, setTemplate] = useState<ProjectTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Task dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskForm, setTaskForm] = useState<TemplateTask>(INITIAL_TASK)

  // Milestone dialog
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false)
  const [milestoneForm, setMilestoneForm] = useState<TemplateMilestone>(INITIAL_MILESTONE)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'task' | 'milestone'; index: number } | null>(null)

  /* ── Fetch ──────────────────────────────────────────────────────── */

  const fetchTemplate = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/projects/templates/${templateId}`)
      const td = data.template_data || {}
      setTemplate({
        ...data,
        template_data: {
          tasks: td.tasks || [],
          milestones: td.milestones || [],
        },
      })
    } catch {
      toast.error('Failed to load template')
    } finally {
      setLoading(false)
    }
  }, [templateId])

  useEffect(() => {
    fetchTemplate()
  }, [fetchTemplate])

  /* ── Save helper ────────────────────────────────────────────────── */

  const saveTemplateData = async (updatedData: TemplateData) => {
    if (!template) return
    setSaving(true)
    try {
      await api.put(`/projects/templates/${templateId}`, {
        template_data: updatedData,
      })
      setTemplate((prev) => prev ? { ...prev, template_data: updatedData } : prev)
      toast.success('Template updated')
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  /* ── Task handlers ──────────────────────────────────────────────── */

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error('Task title is required')
      return
    }
    if (!template) return
    const newTask: TemplateTask = {
      title: taskForm.title.trim(),
      priority: taskForm.priority,
      status: taskForm.status,
      estimated_hours: taskForm.estimated_hours,
    }
    const updated: TemplateData = {
      ...template.template_data,
      tasks: [...template.template_data.tasks, newTask],
    }
    await saveTemplateData(updated)
    setTaskDialogOpen(false)
    setTaskForm(INITIAL_TASK)
  }

  /* ── Milestone handlers ─────────────────────────────────────────── */

  const handleAddMilestone = async () => {
    if (!milestoneForm.title.trim()) {
      toast.error('Milestone title is required')
      return
    }
    if (!template) return
    const newMilestone: TemplateMilestone = {
      title: milestoneForm.title.trim(),
      description: milestoneForm.description || undefined,
    }
    const updated: TemplateData = {
      ...template.template_data,
      milestones: [...template.template_data.milestones, newMilestone],
    }
    await saveTemplateData(updated)
    setMilestoneDialogOpen(false)
    setMilestoneForm(INITIAL_MILESTONE)
  }

  /* ── Delete handler ─────────────────────────────────────────────── */

  const handleDelete = async () => {
    if (!deleteTarget || !template) return
    const { type, index } = deleteTarget
    const td = template.template_data
    const updated: TemplateData =
      type === 'task'
        ? { ...td, tasks: td.tasks.filter((_, i) => i !== index) }
        : { ...td, milestones: td.milestones.filter((_, i) => i !== index) }
    await saveTemplateData(updated)
    setDeleteTarget(null)
  }

  /* ── Loading / empty states ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Template"
          breadcrumbs={[
            { label: 'Projects', href: '/projects' },
            { label: 'Templates', href: '/projects/templates' },
            { label: 'Loading...' },
          ]}
        />
        <div className="rounded-xl border border-border/60 bg-card p-6 animate-pulse">
          <div className="h-6 w-1/3 rounded bg-muted-foreground/10 mb-4" />
          <div className="h-4 w-2/3 rounded bg-muted-foreground/8 mb-2" />
          <div className="h-4 w-1/2 rounded bg-muted-foreground/8" />
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Template Not Found"
          breadcrumbs={[
            { label: 'Projects', href: '/projects' },
            { label: 'Templates', href: '/projects/templates' },
            { label: 'Not Found' },
          ]}
        />
        <div className="rounded-xl border border-border/60 bg-card shadow-sm p-12 text-center">
          <p className="text-sm text-muted-foreground">This template could not be found.</p>
        </div>
      </div>
    )
  }

  const { tasks, milestones } = template.template_data

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={template.name}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: 'Templates', href: '/projects/templates' },
          { label: template.name },
        ]}
      />

      {/* Template info */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayoutTemplate className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{template.name}</h2>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {template.default_billing_type && (
                <Badge variant="outline" className="text-[11px] capitalize">
                  {template.default_billing_type}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{tasks.length} tasks</span>
              <span className="text-xs text-muted-foreground">{milestones.length} milestones</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="tasks" className="gap-1.5">
            <ListChecks className="h-3.5 w-3.5" />
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="milestones" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Milestones ({milestones.length})
          </TabsTrigger>
        </TabsList>

        {/* Tasks tab */}
        <TabsContent value="tasks" className="mt-4">
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-border/40">
              <h3 className="text-sm font-semibold">Template Tasks</h3>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  setTaskForm(INITIAL_TASK)
                  setTaskDialogOpen(true)
                }}
                disabled={saving}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Task
              </Button>
            </div>
            {tasks.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                  <ListChecks className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No tasks in this template yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5 text-xs"
                  onClick={() => {
                    setTaskForm(INITIAL_TASK)
                    setTaskDialogOpen(true)
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Add First Task
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {tasks.map((task, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">{task.title}</span>
                      <Badge
                        className={cn(
                          'text-[10px] px-1.5 py-0 font-medium capitalize border-0',
                          PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium
                        )}
                      >
                        {task.priority}
                      </Badge>
                      <Badge
                        className={cn(
                          'text-[10px] px-1.5 py-0 font-medium border-0',
                          STATUS_STYLES[task.status] || STATUS_STYLES.todo
                        )}
                      >
                        {STATUS_LABELS[task.status] || task.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {task.estimated_hours != null && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {task.estimated_hours}h
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget({ type: 'task', index })}
                        disabled={saving}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Milestones tab */}
        <TabsContent value="milestones" className="mt-4">
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-border/40">
              <h3 className="text-sm font-semibold">Template Milestones</h3>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  setMilestoneForm(INITIAL_MILESTONE)
                  setMilestoneDialogOpen(true)
                }}
                disabled={saving}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Milestone
              </Button>
            </div>
            {milestones.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                  <Target className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No milestones in this template yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5 text-xs"
                  onClick={() => {
                    setMilestoneForm(INITIAL_MILESTONE)
                    setMilestoneDialogOpen(true)
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Add First Milestone
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {milestones.map((milestone, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{milestone.title}</p>
                      {milestone.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {milestone.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setDeleteTarget({ type: 'milestone', index })}
                      disabled={saving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Task dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>Add a task to this project template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="task-title" className="text-[13px]">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Set up project structure"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[13px]">Priority</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px]">Status</Label>
                <Select
                  value={taskForm.status}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-hours" className="text-[13px]">
                Estimated Hours
              </Label>
              <Input
                id="task-hours"
                type="number"
                min={0}
                step={0.5}
                value={taskForm.estimated_hours ?? ''}
                onChange={(e) =>
                  setTaskForm((f) => ({
                    ...f,
                    estimated_hours: e.target.value ? parseFloat(e.target.value) : null,
                  }))
                }
                placeholder="e.g. 4"
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddTask} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Milestone dialog */}
      <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Milestone</DialogTitle>
            <DialogDescription>Add a milestone to this project template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="milestone-title" className="text-[13px]">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="milestone-title"
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Phase 1 Complete"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-desc" className="text-[13px]">
                Description
              </Label>
              <Input
                id="milestone-desc"
                value={milestoneForm.description || ''}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description..."
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddMilestone} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Add Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === 'task' ? 'Task' : 'Milestone'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this {deleteTarget?.type} from the template? This will
              be saved immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
