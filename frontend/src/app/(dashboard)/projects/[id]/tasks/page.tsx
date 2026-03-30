'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import {
  Plus, Loader2, List, LayoutGrid, KanbanSquare,
  Calendar, User2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TaskDetailPanel,
  TaskKanbanBoard,
  TaskFilterBar,
  type Task,
  type Milestone,
  type ProjectMember,
  PRIORITY_COLORS,
} from '@/components/shared/tasks'

interface Project { id: string; name: string }
type ViewMode = 'table' | 'card' | 'kanban'

const VIEW_OPTIONS: { value: ViewMode; icon: typeof List; label: string }[] = [
  { value: 'table', icon: List, label: 'Table view' },
  { value: 'card', icon: LayoutGrid, label: 'Card view' },
  { value: 'kanban', icon: KanbanSquare, label: 'Kanban view' },
]

export default function ProjectTasksPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskPanelOpen, setTaskPanelOpen] = useState(false)

  // View mode from URL or localStorage
  const [view, setViewState] = useState<ViewMode>(() => {
    const urlView = searchParams.get('view')
    if (urlView === 'table' || urlView === 'card' || urlView === 'kanban') return urlView
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('project-tasks-view')
      if (saved === 'table' || saved === 'card' || saved === 'kanban') return saved
    }
    return 'table'
  })
  const setView = (v: ViewMode) => {
    setViewState(v)
    localStorage.setItem('project-tasks-view', v)
  }

  // Filters
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterMilestone, setFilterMilestone] = useState('all')

  // New task dialog
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('medium')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [newTaskEstHours, setNewTaskEstHours] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}`)
      setProject(data)
    } catch { toast.error('Failed to load project') }
  }, [projectId])

  const fetchTasks = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page_size: 200 }
      if (filterPriority !== 'all') params.priority = filterPriority
      if (filterAssignee !== 'all') params.assigned_to = filterAssignee
      if (filterMilestone !== 'all') params.milestone_id = filterMilestone
      const { data } = await api.get(`/projects/${projectId}/tasks`, { params })
      setTasks(normalizePaginated<Task>(data).items)
    } catch { toast.error('Failed to load tasks') }
  }, [projectId, filterPriority, filterAssignee, filterMilestone])

  const fetchMilestones = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/milestones`, { params: { page_size: 100 } })
      setMilestones(normalizePaginated<Milestone>(data).items)
    } catch { /* optional */ }
  }, [projectId])

  const fetchMembers = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/members`, { params: { page_size: 100 } })
      const items = Array.isArray(data) ? data : (data.data || data.items || data.results || [])
      setMembers(items)
    } catch { /* optional */ }
  }, [projectId])

  useEffect(() => {
    Promise.all([fetchProject(), fetchMilestones(), fetchMembers()]).finally(() => setLoading(false))
  }, [fetchProject, fetchMilestones, fetchMembers])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // Client-side search filter
  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks
    const q = search.toLowerCase()
    return tasks.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.assignee_name?.toLowerCase().includes(q)
    )
  }, [tasks, search])

  const activeFilterCount = [
    filterPriority !== 'all' ? 1 : 0,
    filterAssignee !== 'all' ? 1 : 0,
    filterMilestone !== 'all' ? 1 : 0,
    search.trim() ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const clearFilters = () => {
    setSearch('')
    setFilterPriority('all')
    setFilterAssignee('all')
    setFilterMilestone('all')
  }

  const handleDrop = async (taskId: string, newStatus: string) => {
    const prevTasks = tasks
    setTasks((ts) => ts.map((t) => (String(t.id) === String(taskId) ? { ...t, status: newStatus } : t)))
    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}/status`, { status: newStatus })
    } catch {
      setTasks(prevTasks)
      toast.error('Failed to update task')
    }
  }

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${projectId}/tasks`, {
        title: newTaskTitle, priority: newTaskPriority, status: 'todo',
        assigned_to: newTaskAssignee ? parseInt(newTaskAssignee) : null,
        due_date: newTaskDue || null,
        estimated_hours: newTaskEstHours ? parseFloat(newTaskEstHours) : null,
        description: newTaskDesc || null,
      })
      toast.success('Task created')
      setNewTaskTitle(''); setNewTaskPriority('medium'); setNewTaskAssignee('')
      setNewTaskDue(''); setNewTaskEstHours(''); setNewTaskDesc('')
      setShowAddTask(false)
      fetchTasks()
    } catch { toast.error('Failed to create task') } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', view === 'kanban' && 'h-[calc(100vh-theme(spacing.16))]')}>
      <PageHeader
        title="Tasks"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
              {VIEW_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <Button key={opt.value} variant="ghost" size="icon"
                    className={cn('h-7 w-7 p-0 rounded-md cursor-pointer', view === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    onClick={() => setView(opt.value)} title={opt.label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                )
              })}
            </div>
            <Button size="sm" className="h-9 rounded-lg px-4 gap-1.5 shadow-sm font-semibold text-[13px]" onClick={() => setShowAddTask(true)}>
              <Plus className="h-3.5 w-3.5" />New Task
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <TaskFilterBar
        search={search}
        onSearchChange={setSearch}
        priority={filterPriority}
        onPriorityChange={setFilterPriority}
        assignee={filterAssignee}
        onAssigneeChange={setFilterAssignee}
        milestoneId={filterMilestone}
        onMilestoneChange={setFilterMilestone}
        milestones={milestones}
        members={members}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      {/* Table View */}
      {view === 'table' && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Task</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assignee</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Est. Hours</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Progress</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground text-[13px]">
                      No tasks found.
                    </td>
                  </tr>
                )}
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => { setSelectedTask(t); setTaskPanelOpen(true) }}
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-medium">{t.title}</div>
                      {t.description && (
                        <div className="text-[11px] text-muted-foreground/70 truncate max-w-xs mt-0.5">{t.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{t.assignee_name ?? '---'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md capitalize font-semibold ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3.5 text-muted-foreground">{t.due_date ? format(new Date(t.due_date), 'MMM d, yyyy') : '---'}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-medium">{t.estimated_hours ?? '---'}h</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${t.progress ?? 0}%` }} />
                        </div>
                        <span className="text-[11px] tabular-nums">{t.progress ?? 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Card View */}
      {view === 'card' && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden p-5">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm font-medium text-foreground/80">No tasks found</p>
              <p className="text-xs text-muted-foreground">Create a new task to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-border/60 bg-card p-4 hover:shadow-md transition-all cursor-pointer" onClick={() => { setSelectedTask(task); setTaskPanelOpen(true) }}>
                  <p className="font-medium text-sm mb-1 line-clamp-2">{task.title}</p>
                  {task.assignee_name && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <User2 className="h-3 w-3" />{task.assignee_name}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mt-auto">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md capitalize font-semibold ${PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                      {task.priority}
                    </span>
                    <StatusBadge status={task.status} />
                  </div>
                  {task.due_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2.5">
                      <Calendar className="h-3 w-3" />{format(new Date(task.due_date), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <TaskKanbanBoard
          tasks={filteredTasks}
          onDrop={handleDrop}
          onTaskClick={(t) => { setSelectedTask(t); setTaskPanelOpen(true) }}
        />
      )}

      {/* Add Task Dialog */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Add a new task to this project.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <Label className="text-[13px]">Title *</Label>
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Task title" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[13px]">Priority</Label>
                <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[13px]">Due Date</Label>
                <Input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[13px]">Assigned To</Label>
                {members.length > 0 ? (
                  <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => <SelectItem key={String(m.user_id)} value={String(m.user_id)}>{m.user_name || `User ${m.user_id}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input type="number" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} placeholder="User ID" className="mt-1" />
                )}
              </div>
              <div>
                <Label className="text-[13px]">Est. Hours</Label>
                <Input type="number" step="0.5" value={newTaskEstHours} onChange={(e) => setNewTaskEstHours(e.target.value)} placeholder="0" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-[13px]">Description</Label>
              <Textarea value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} placeholder="Optional description" rows={2} className="mt-1 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTask(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAddTask} disabled={submitting || !newTaskTitle.trim()}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDetailPanel
        task={selectedTask}
        open={taskPanelOpen}
        onClose={() => { setTaskPanelOpen(false); setSelectedTask(null) }}
        projectId={projectId}
        onUpdate={fetchTasks}
        members={members}
      />
    </div>
  )
}
