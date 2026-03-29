'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  List,
  LayoutGrid,
  KanbanSquare,
  CircleDot,
  Clock,
  Search as SearchIcon,
  CheckCircle2,
  Calendar,
  User,
  Plus,
} from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Task {
  id: string
  title: string
  description?: string
  project_id: string
  status: string
  priority: string
  assignee_name: string
  due_date: string
}

type ViewMode = 'table' | 'card' | 'kanban'

const KANBAN_COLUMNS = [
  { key: 'todo', label: 'To Do', icon: CircleDot, color: 'slate' },
  { key: 'in_progress', label: 'In Progress', icon: Clock, color: 'blue' },
  { key: 'review', label: 'Review', icon: SearchIcon, color: 'orange' },
  { key: 'done', label: 'Done', icon: CheckCircle2, color: 'green' },
] as const

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const COLUMN_HEADER_COLORS: Record<string, string> = {
  slate:
    'bg-slate-50/60 border-slate-200/60 dark:bg-slate-900/30 dark:border-slate-700/40',
  blue:
    'bg-blue-50/60 border-blue-200/60 dark:bg-blue-900/20 dark:border-blue-700/40',
  orange:
    'bg-orange-50/60 border-orange-200/60 dark:bg-orange-900/20 dark:border-orange-700/40',
  green:
    'bg-green-50/60 border-green-200/60 dark:bg-green-900/20 dark:border-green-700/40',
}

const COLUMN_COUNT_BADGE_COLORS: Record<string, string> = {
  slate: 'bg-slate-200/70 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  blue: 'bg-blue-200/70 text-blue-700 dark:bg-blue-700 dark:text-blue-300',
  orange:
    'bg-orange-200/70 text-orange-700 dark:bg-orange-700 dark:text-orange-300',
  green:
    'bg-green-200/70 text-green-700 dark:bg-green-700 dark:text-green-300',
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold capitalize',
        PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low
      )}
    >
      {priority}
    </span>
  )
}

export default function TasksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [draggingOver, setDraggingOver] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    pages: 1,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: projRaw } = await api.get('/projects', {
        params: { page_size: 100 },
      })
      const projects = normalizePaginated<{ id: string; name: string }>(
        projRaw
      ).items

      const allTasks: Task[] = []
      for (const proj of projects) {
        try {
          const { data: taskRaw } = await api.get(
            `/projects/${proj.id}/tasks`,
            {
              params: { page_size: 200 },
            }
          )
          const items = normalizePaginated<Task>(taskRaw).items
          allTasks.push(...items)
        } catch {
          /* skip */
        }
      }

      setTasks(allTasks)
      setPagination({
        page: 1,
        per_page: 25,
        total: allTasks.length,
        pages: Math.ceil(allTasks.length / 25),
      })
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Kanban drag-and-drop handlers ---

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDraggingOver(columnKey)
  }

  const handleDragLeave = () => {
    setDraggingOver(null)
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    setDraggingOver(null)

    const taskId = e.dataTransfer.getData('text/plain')
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    )

    try {
      await api.patch(`/projects/${task.project_id}/tasks/${task.id}`, {
        status: newStatus,
      })
    } catch {
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: task.status } : t
        )
      )
      toast.error('Failed to update task status')
    }
  }

  // --- Table columns ---

  const columns: ServerColumnDef<Task>[] = [
    {
      id: 'title',
      header: 'Task',
      cell: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (row) => <PriorityBadge priority={row.priority} />,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
      meta: {
        filterType: 'select',
        filterKey: 'status',
        filterPlaceholder: 'All Statuses',
        filterOptions: [
          { value: 'todo', label: 'To Do' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'review', label: 'Review' },
          { value: 'done', label: 'Done' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
    {
      id: 'assignee_name',
      header: 'Assignee',
      enableSorting: false,
      cell: (row) =>
        row.assignee_name || (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: (row) =>
        row.due_date
          ? new Date(row.due_date).toLocaleDateString()
          : '\u2014',
    },
  ]

  // --- View toggle buttons ---

  const viewOptions: { value: ViewMode; icon: typeof List; label: string }[] = [
    { value: 'table', icon: List, label: 'Table view' },
    { value: 'card', icon: LayoutGrid, label: 'Card view' },
    { value: 'kanban', icon: KanbanSquare, label: 'Kanban view' },
  ]

  // --- Render ---

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tasks"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Tasks' }]}
        actions={
          <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
            {viewOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <Button
                  key={opt.value}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7 p-0 rounded-md cursor-pointer',
                    view === opt.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setView(opt.value)}
                  title={opt.label}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              )
            })}
          </div>
          <Button
            size="sm"
            className="h-9 rounded-lg px-4 gap-1.5 shadow-sm font-semibold text-[13px]"
            onClick={() => router.push('/projects')}
          >
            <Plus className="h-3.5 w-3.5" />
            New Task
          </Button>
          </div>
        }
      />

      {/* Table view */}
      {view === 'table' && (
        <AdvancedDataTable
          title="Tasks"
          columns={columns}
          data={tasks}
          pagination={pagination}
          loading={loading}
          emptyMessage="No tasks found"
          emptyDescription="Tasks will appear here once projects have tasks."
          searchPlaceholder="Search tasks..."
          storageKey="projects-tasks"
        />
      )}

      {/* Card view */}
      {view === 'card' && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden p-5">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border/60 bg-card p-4 animate-pulse"
                    >
                      <div className="h-4 w-3/4 rounded bg-muted-foreground/10 mb-3" />
                      <div className="h-3 w-1/2 rounded bg-muted-foreground/8 mb-2" />
                      <div className="h-3 w-1/3 rounded bg-muted-foreground/8" />
                    </div>
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                    <SearchIcon className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground/80 mt-1">
                    No tasks found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tasks will appear here once projects have tasks.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-border/60 bg-card p-4 hover:shadow-md transition-all cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/projects/${task.project_id}/tasks/${task.id}/edit`
                        )
                      }
                    >
                      <p className="font-medium text-sm mb-2 line-clamp-2">
                        {task.title}
                      </p>
                      {task.assignee_name && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                          <User className="h-3 w-3" />
                          {task.assignee_name}
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap mt-auto">
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                      </div>
                      {task.due_date && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2.5">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.due_date).toLocaleDateString()}
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
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden p-5">
              {loading ? (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {KANBAN_COLUMNS.map((col) => (
                    <div
                      key={col.key}
                      className="min-w-[280px] flex-1 rounded-xl border border-border/40 animate-pulse"
                    >
                      <div className="p-3.5">
                        <div className="h-4 w-24 rounded bg-muted-foreground/10 mb-4" />
                        <div className="space-y-3">
                          {Array.from({ length: 2 }).map((_, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-border/60 p-3.5"
                            >
                              <div className="h-3.5 w-3/4 rounded bg-muted-foreground/10 mb-2" />
                              <div className="h-3 w-1/2 rounded bg-muted-foreground/8" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {KANBAN_COLUMNS.map((col) => {
                    const Icon = col.icon
                    const columnTasks = tasks.filter(
                      (t) => t.status === col.key
                    )
                    return (
                      <div
                        key={col.key}
                        className={cn(
                          'min-w-[280px] flex-1 rounded-xl border border-border/40 flex flex-col transition-colors',
                          draggingOver === col.key &&
                            'border-primary/40 bg-primary/[0.02]'
                        )}
                        onDragOver={(e) => handleDragOver(e, col.key)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.key)}
                      >
                        {/* Column header */}
                        <div
                          className={cn(
                            'flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl border-b',
                            COLUMN_HEADER_COLORS[col.color]
                          )}
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            {col.label}
                          </span>
                          <span
                            className={cn(
                              'ml-auto inline-flex items-center justify-center h-5 min-w-5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                              COLUMN_COUNT_BADGE_COLORS[col.color]
                            )}
                          >
                            {columnTasks.length}
                          </span>
                        </div>

                        {/* Column body */}
                        <div className="flex-1 p-2.5 space-y-2.5 min-h-[120px]">
                          {columnTasks.length === 0 ? (
                            <div className="flex items-center justify-center h-full min-h-[80px] text-xs text-muted-foreground">
                              No tasks
                            </div>
                          ) : (
                            columnTasks.map((task) => (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={(e) =>
                                  handleDragStart(e, task.id)
                                }
                                className="rounded-lg border border-border/60 bg-card p-3.5 shadow-xs cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
                              >
                                <p className="text-sm font-medium mb-1.5 line-clamp-2">
                                  {task.title}
                                </p>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <PriorityBadge priority={task.priority} />
                                  {task.due_date && (
                                    <span className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(
                                        task.due_date
                                      ).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                {task.assignee_name && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                                    <User className="h-3 w-3" />
                                    {task.assignee_name}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
        </div>
      )}
    </div>
  )
}
