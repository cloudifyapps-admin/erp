'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Plus, Loader2, List, LayoutGrid, KanbanSquare,
  Calendar, User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TaskDetailPanel,
  TaskKanbanBoard,
  TaskFilterBar,
  type Task,
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setViewState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tasks-view-mode')
      if (saved === 'table' || saved === 'card' || saved === 'kanban') return saved
    }
    return 'table'
  })
  const setView = (v: ViewMode) => {
    setViewState(v)
    localStorage.setItem('tasks-view-mode', v)
  }

  // New task dialog state
  const [showNewTask, setShowNewTask] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [newTaskProject, setNewTaskProject] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('medium')
  const [newTaskStatus, setNewTaskStatus] = useState('todo')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [newTaskEstHours, setNewTaskEstHours] = useState('')

  // Task detail panel state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskPanelOpen, setTaskPanelOpen] = useState(false)
  const [panelMembers, setPanelMembers] = useState<ProjectMember[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')

  const [pagination, setPagination] = useState({
    page: 1, per_page: 25, total: 0, pages: 1,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: projRaw } = await api.get('/projects', { params: { page_size: 100 } })
      const projectsList = normalizePaginated<{ id: string; name: string }>(projRaw).items
      const projectMap = new Map(projectsList.map((p) => [String(p.id), p.name]))
      setProjects(projectsList.map((p) => ({ id: String(p.id), name: p.name })))

      const allTasks: Task[] = []
      const results = await Promise.allSettled(
        projectsList.map(async (proj) => {
          const { data: taskRaw } = await api.get(`/projects/${proj.id}/tasks`, { params: { page_size: 200 } })
          return normalizePaginated<Task>(taskRaw).items.map((t) => ({
            ...t,
            project_id: String(proj.id),
            project_name: projectMap.get(String(proj.id)) ?? `Project #${proj.id}`,
          }))
        })
      )
      for (const r of results) {
        if (r.status === 'fulfilled') allTasks.push(...r.value)
      }

      setTasks(allTasks)
      setPagination({
        page: 1, per_page: 25, total: allTasks.length,
        pages: Math.ceil(allTasks.length / 25),
      })
    } catch { toast.error('Failed to load tasks') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch members for selected task's project (for assignee dropdown in panel)
  useEffect(() => {
    if (!selectedTask?.project_id) { setPanelMembers([]); return }
    let cancelled = false
    const fetchPanelMembers = async () => {
      try {
        const { data } = await api.get(`/projects/${selectedTask.project_id}/members`, { params: { page_size: 100 } })
        const items = Array.isArray(data) ? data : (data.data || data.items || data.results || [])
        if (!cancelled) setPanelMembers(items)
      } catch { if (!cancelled) setPanelMembers([]) }
    }
    fetchPanelMembers()
    return () => { cancelled = true }
  }, [selectedTask?.project_id])

  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/projects', { params: { page_size: 100 } })
      setProjects(normalizePaginated<Project>(data).items)
    } catch {}
  }, [])

  useEffect(() => {
    if (!newTaskProject) { setMembers([]); setNewTaskAssignee(''); return }
    let cancelled = false
    const fetchMembers = async () => {
      try {
        const { data } = await api.get(`/projects/${newTaskProject}/members`)
        const items = Array.isArray(data) ? data : normalizePaginated<ProjectMember>(data).items
        if (!cancelled) setMembers(items)
      } catch { if (!cancelled) setMembers([]) }
    }
    fetchMembers()
    return () => { cancelled = true }
  }, [newTaskProject])

  const handleOpenNewTask = () => { fetchProjects(); setShowNewTask(true) }

  const resetNewTaskForm = () => {
    setNewTaskProject(''); setNewTaskTitle(''); setNewTaskPriority('medium')
    setNewTaskStatus('todo'); setNewTaskDue(''); setNewTaskAssignee(''); setNewTaskEstHours('')
    setMembers([])
  }

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskProject) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${newTaskProject}/tasks`, {
        title: newTaskTitle, priority: newTaskPriority, status: newTaskStatus,
        assigned_to: newTaskAssignee ? parseInt(newTaskAssignee) : null,
        due_date: newTaskDue || null,
        estimated_hours: newTaskEstHours ? parseFloat(newTaskEstHours) : null,
      })
      toast.success('Task created'); resetNewTaskForm(); setShowNewTask(false); fetchData()
    } catch { toast.error('Failed to create task') } finally { setSubmitting(false) }
  }

  // Client-side search + priority filter
  const filteredTasks = useMemo(() => {
    let result = tasks
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.assignee_name?.toLowerCase().includes(q) ||
          t.project_name?.toLowerCase().includes(q)
      )
    }
    if (filterPriority !== 'all') {
      result = result.filter((t) => t.priority === filterPriority)
    }
    return result
  }, [tasks, search, filterPriority])

  const activeFilterCount = [
    filterPriority !== 'all' ? 1 : 0,
    search.trim() ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const clearFilters = () => {
    setSearch('')
    setFilterPriority('all')
  }

  // Kanban drag-and-drop
  const handleDrop = async (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => String(t.id) === taskId)
    if (!task || task.status === newStatus) return

    setTasks((prev) => prev.map((t) => (String(t.id) === taskId ? { ...t, status: newStatus } : t)))
    try {
      await api.patch(`/projects/${task.project_id}/tasks/${task.id}/status`, { status: newStatus })
    } catch {
      setTasks((prev) => prev.map((t) => (String(t.id) === taskId ? { ...t, status: task.status } : t)))
      toast.error('Failed to update task status')
    }
  }

  // Table columns
  const columns: ServerColumnDef<Task>[] = [
    {
      id: 'title', header: 'Task',
      cell: (row) => (
        <button
          className="font-medium text-foreground hover:text-primary hover:underline transition-colors text-left"
          onClick={(e) => { e.stopPropagation(); setSelectedTask(row); setTaskPanelOpen(true) }}
        >
          {row.title}
        </button>
      ),
    },
    {
      id: 'project_name', header: 'Project',
      cell: (row) => (
        <Link href={`/projects/${row.project_id}`} className="text-primary hover:underline transition-colors text-[13px]" onClick={(e) => e.stopPropagation()}>
          {row.project_name || `Project #${row.project_id}`}
        </Link>
      ),
    },
    {
      id: 'priority', header: 'Priority',
      cell: (row) => (
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold capitalize', PRIORITY_COLORS[row.priority] ?? PRIORITY_COLORS.low)}>
          {row.priority}
        </span>
      ),
    },
    {
      id: 'status', header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
      meta: {
        filterType: 'select', filterKey: 'status', filterPlaceholder: 'All Statuses',
        filterOptions: [
          { value: 'todo', label: 'To Do' }, { value: 'in_progress', label: 'In Progress' },
          { value: 'review', label: 'Review' }, { value: 'done', label: 'Done' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
    {
      id: 'assignee_name', header: 'Assignee', enableSorting: false,
      cell: (row) => row.assignee_name || <span className="text-muted-foreground">&mdash;</span>,
    },
    {
      id: 'due_date', header: 'Due Date',
      cell: (row) => row.due_date ? new Date(row.due_date).toLocaleDateString() : '\u2014',
    },
  ]

  return (
    <div className={cn('flex flex-col gap-4', view === 'kanban' && 'h-[calc(100vh-theme(spacing.16))]')}>
      <PageHeader
        title="Tasks"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Tasks' }]}
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
            <Button size="sm" className="h-9 rounded-lg px-4 gap-1.5 shadow-sm font-semibold text-[13px]" onClick={handleOpenNewTask}>
              <Plus className="h-3.5 w-3.5" />New Task
            </Button>
          </div>
        }
      />

      {/* Filter Bar (shown for card and kanban views — table has its own search) */}
      {view !== 'table' && (
        <TaskFilterBar
          search={search}
          onSearchChange={setSearch}
          priority={filterPriority}
          onPriorityChange={setFilterPriority}
          activeFilterCount={activeFilterCount}
          onClearFilters={clearFilters}
        />
      )}

      {/* Table view */}
      {view === 'table' && (
        <AdvancedDataTable
          title="Tasks" columns={columns} data={filteredTasks} pagination={pagination} loading={loading}
          onRowClick={(row) => { setSelectedTask(row); setTaskPanelOpen(true) }} emptyMessage="No tasks found"
          emptyDescription="Tasks will appear here once projects have tasks."
          searchPlaceholder="Search tasks..." storageKey="projects-tasks"
        />
      )}

      {/* Card view */}
      {view === 'card' && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden p-5">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card p-4 animate-pulse">
                  <div className="h-4 w-3/4 rounded bg-muted-foreground/10 mb-3" />
                  <div className="h-3 w-1/2 rounded bg-muted-foreground/8 mb-2" />
                  <div className="h-3 w-1/3 rounded bg-muted-foreground/8" />
                </div>
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm font-medium text-foreground/80 mt-1">No tasks found</p>
              <p className="text-xs text-muted-foreground">Tasks will appear here once projects have tasks.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-border/60 bg-card p-4 hover:shadow-md transition-all cursor-pointer" onClick={() => { setSelectedTask(task); setTaskPanelOpen(true) }}>
                  <p className="font-medium text-sm mb-1 line-clamp-2">{task.title}</p>
                  {task.project_name && <p className="text-[11px] text-primary mb-2 truncate">{task.project_name}</p>}
                  {task.assignee_name && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <User className="h-3 w-3" />{task.assignee_name}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mt-auto">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold capitalize', PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.low)}>
                      {task.priority}
                    </span>
                    <StatusBadge status={task.status} />
                  </div>
                  {task.due_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2.5">
                      <Calendar className="h-3 w-3" />{new Date(task.due_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kanban view */}
      {view === 'kanban' && (
        <TaskKanbanBoard
          tasks={filteredTasks}
          onDrop={handleDrop}
          onTaskClick={(t) => { setSelectedTask(t); setTaskPanelOpen(true) }}
          showProject
        />
      )}

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={(open) => { setShowNewTask(open); if (!open) resetNewTaskForm() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Create a new task and assign it to a project.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <Label className="text-[13px]">Project *</Label>
              <Select value={newTaskProject} onValueChange={setNewTaskProject}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
                <Label className="text-[13px]">Status</Label>
                <Select value={newTaskStatus} onValueChange={setNewTaskStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[13px]">Due Date</Label>
                <Input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[13px]">Est. Hours</Label>
                <Input type="number" step="0.5" value={newTaskEstHours} onChange={(e) => setNewTaskEstHours(e.target.value)} placeholder="0" className="mt-1" />
              </div>
            </div>
            {newTaskProject && members.length > 0 && (
              <div>
                <Label className="text-[13px]">Assigned To</Label>
                <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => <SelectItem key={String(m.user_id)} value={String(m.user_id)}>{m.user_name || `User ${m.user_id}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewTask(false); resetNewTaskForm() }} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={submitting || !newTaskTitle.trim() || !newTaskProject}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={taskPanelOpen}
        onClose={() => { setTaskPanelOpen(false); setSelectedTask(null) }}
        projectId={selectedTask?.project_id ?? ''}
        onUpdate={fetchData}
        showProject
        members={panelMembers}
      />
    </div>
  )
}
