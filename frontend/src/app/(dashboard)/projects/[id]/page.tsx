'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Circle,
  Calendar,
  User2,
  DollarSign,
  GripVertical,
  Target,
  Timer,
  Pencil,
  LayoutDashboard,
  KanbanSquare,
  ListChecks,
  Flag,
  ClipboardList,
} from 'lucide-react'

/* ── Types ──────────────────────────────────────────────────────────── */

interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority: string
  assignee_name: string
  due_date: string
  estimated_hours: number
}

interface Milestone {
  id: string
  title: string
  due_date: string
  status: string
  progress: number
}

interface TimeLog {
  id: string
  task_title: string
  user_name: string
  hours: number
  description: string
  logged_at: string
}

interface Project {
  id: string
  name: string
  code: string
  description: string
  status: string
  priority: string
  progress: number
  manager_name: string
  client_name: string
  start_date: string
  end_date: string
  budget: number
  currency: string
  total_tasks: number
  completed_tasks: number
  total_hours: number
}

/* ── Constants ──────────────────────────────────────────────────────── */

const KANBAN_COLUMNS: {
  key: Task['status']
  label: string
  icon: React.ReactNode
  color: string
  bg: string
}[] = [
  { key: 'todo', label: 'To Do', icon: <Circle className="size-4" />, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-900/30' },
  { key: 'in_progress', label: 'In Progress', icon: <Clock className="size-4" />, color: 'text-blue-600', bg: 'bg-blue-50/60 dark:bg-blue-900/20' },
  { key: 'review', label: 'Review', icon: <AlertCircle className="size-4" />, color: 'text-orange-600', bg: 'bg-orange-50/60 dark:bg-orange-900/20' },
  { key: 'done', label: 'Done', icon: <CheckCircle2 className="size-4" />, color: 'text-green-600', bg: 'bg-green-50/60 dark:bg-green-900/20' },
]

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

/* ── Stat Card ──────────────────────────────────────────────────────── */

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted/60">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
        <p className="text-[15px] font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  )
}

/* ── Detail Row ─────────────────────────────────────────────────────── */

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-4 py-2.5 border-b border-border/30 last:border-b-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-medium">{children}</span>
    </div>
  )
}

/* ── Kanban Card ────────────────────────────────────────────────────── */

function KanbanCard({
  task,
}: {
  task: Task
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task.id)
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      className={`group rounded-lg border border-border/60 bg-card p-3.5 shadow-xs cursor-grab active:cursor-grabbing transition-all ${
        dragging ? 'opacity-40 scale-95' : 'opacity-100'
      } hover:shadow-sm hover:border-border`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium leading-snug">{task.title}</p>
        <GripVertical className="size-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
      </div>
      {task.description && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {task.priority && (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize ${
              PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {task.priority}
          </span>
        )}
        {task.due_date && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="size-2.5" />
            {format(new Date(task.due_date), 'MMM d')}
          </span>
        )}
        {task.assignee_name && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
            <User2 className="size-2.5" />
            {task.assignee_name.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Kanban Column ──────────────────────────────────────────────────── */

function KanbanColumn({
  column,
  tasks,
  onDrop,
}: {
  column: (typeof KANBAN_COLUMNS)[0]
  tasks: Task[]
  onDrop: (taskId: string, status: Task['status']) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`flex flex-col min-w-[280px] flex-1 rounded-xl border border-border/40 ${column.bg} transition-all ${
        dragOver ? 'ring-2 ring-primary/20 border-primary/30' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const taskId = e.dataTransfer.getData('taskId')
        if (taskId) onDrop(taskId, column.key)
      }}
    >
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-border/30 ${column.color}`}>
        {column.icon}
        <span className="text-[13px] font-semibold">{column.label}</span>
        <span className="ml-auto text-[11px] text-muted-foreground bg-background/80 rounded-full px-2 py-0.5 border border-border/50 font-medium">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 p-3 min-h-[100px]">
        {tasks.map((t) => (
          <KanbanCard key={t.id} task={t} />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[12px] text-muted-foreground/50">
            No tasks
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────────────────── */

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}`)
      setProject(data)
    } catch {
      toast.error('Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/tasks`, {
        params: { page_size: 200 },
      })
      setTasks(normalizePaginated(data).items)
    } catch {
      toast.error('Failed to load tasks')
    }
  }, [projectId])

  const fetchMilestones = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/milestones`, {
        params: { page_size: 100 },
      })
      setMilestones(normalizePaginated(data).items)
    } catch {}
  }, [projectId])

  const fetchTimeLogs = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/time-logs`, {
        params: { page_size: 100 },
      })
      setTimeLogs(normalizePaginated(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => {
    fetchProject()
    fetchTasks()
  }, [fetchProject, fetchTasks])

  useEffect(() => {
    if (activeTab === 'milestones') fetchMilestones()
    if (activeTab === 'timelog') fetchTimeLogs()
  }, [activeTab, fetchMilestones, fetchTimeLogs])

  const handleDrop = async (taskId: string, newStatus: Task['status']) => {
    const prevTasks = tasks
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))
    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}`, { status: newStatus })
    } catch {
      setTasks(prevTasks)
      toast.error('Failed to update task')
    }
  }

  /* ── Loading state ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="mb-4">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-64" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    )
  }

  /* ── Not found ──────────────────────────────────────────────────── */
  if (!project) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Project Not Found"
          breadcrumbs={[{ label: 'Projects', href: '/projects' }]}
        />
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-border/60 bg-card">
          <p className="text-muted-foreground text-[14px]">This project could not be found.</p>
          <Button variant="outline" size="sm" className="mt-4 h-9 rounded-lg" onClick={() => router.push('/projects')}>
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  const tasksByStatus = KANBAN_COLUMNS.reduce(
    (acc, col) => {
      acc[col.key] = tasks.filter((t) => t.status === col.key)
      return acc
    },
    {} as Record<Task['status'], Task[]>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <PageHeader
        title={project.name}
        breadcrumbs={[{ label: 'Projects', href: '/projects' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-lg px-4 text-[13px] gap-1.5"
              onClick={() => router.push(`/projects/${projectId}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Task
            </Button>
          </div>
        }
      />

      {/* ── Main Card ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        {/* Project meta bar */}
        <div className="px-6 py-4 border-b border-border/40 flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="font-mono text-[11px] px-2 py-0.5">
            {project.code}
          </Badge>
          <StatusBadge status={project.status} />
          {project.priority && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md capitalize ${
                PRIORITY_COLORS[project.priority] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {project.priority} priority
            </span>
          )}
          {project.client_name && (
            <span className="text-[12px] text-muted-foreground ml-auto">
              Client: <span className="font-medium text-foreground">{project.client_name}</span>
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-border/40 divide-x divide-border/40">
          <StatItem
            icon={<Target className="size-4 text-primary" />}
            label="Progress"
            value={`${project.progress ?? 0}%`}
          />
          <StatItem
            icon={<CheckCircle2 className="size-4 text-green-600" />}
            label="Tasks"
            value={`${project.completed_tasks ?? 0} / ${project.total_tasks ?? 0}`}
          />
          <StatItem
            icon={<Timer className="size-4 text-orange-600" />}
            label="Hours Logged"
            value={`${(project.total_hours ?? 0).toLocaleString()}h`}
          />
          <StatItem
            icon={<DollarSign className="size-4 text-emerald-600" />}
            label="Budget"
            value={
              project.budget
                ? `${project.currency ?? '$'} ${Number(project.budget).toLocaleString()}`
                : '—'
            }
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
          <div className="border-b border-border/40 bg-muted/30 px-6">
            <TabsList variant="line" className="!h-auto gap-2">
              <TabsTrigger
                value="overview"
                className="gap-2 px-4 py-3.5 text-[13px] cursor-pointer data-active:font-semibold"
              >
                <LayoutDashboard className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="kanban"
                className="gap-2 px-4 py-3.5 text-[13px] cursor-pointer data-active:font-semibold"
              >
                <KanbanSquare className="h-4 w-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="gap-2 px-4 py-3.5 text-[13px] cursor-pointer data-active:font-semibold"
              >
                <ListChecks className="h-4 w-4" />
                Tasks
              </TabsTrigger>
              <TabsTrigger
                value="milestones"
                className="gap-2 px-4 py-3.5 text-[13px] cursor-pointer data-active:font-semibold"
              >
                <Flag className="h-4 w-4" />
                Milestones
              </TabsTrigger>
              <TabsTrigger
                value="timelog"
                className="gap-2 px-4 py-3.5 text-[13px] cursor-pointer data-active:font-semibold"
              >
                <ClipboardList className="h-4 w-4" />
                Time Log
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Overview ────────────────────────────────────────────── */}
          <TabsContent value="overview" className="p-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              {/* Left: Description + Details */}
              <div className="flex flex-col gap-6">
                {/* Description */}
                <div>
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
                    Description
                  </h3>
                  <p className="text-[13px] text-foreground/80 leading-relaxed">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                {/* Project Details */}
                <div>
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
                    Details
                  </h3>
                  <div className="rounded-lg border border-border/40 px-5 py-1">
                    <DetailRow label="Manager">{project.manager_name ?? '—'}</DetailRow>
                    <DetailRow label="Priority">
                      <span className="capitalize">{project.priority ?? '—'}</span>
                    </DetailRow>
                    <DetailRow label="Start Date">
                      {project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : '—'}
                    </DetailRow>
                    <DetailRow label="End Date">
                      {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : '—'}
                    </DetailRow>
                    <DetailRow label="Client">{project.client_name ?? '—'}</DetailRow>
                  </div>
                </div>
              </div>

              {/* Right: Progress sidebar */}
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
                    Progress
                  </h3>
                  <div className="rounded-lg border border-border/40 p-5">
                    <div className="flex justify-between text-[13px] mb-2">
                      <span className="text-muted-foreground">Overall</span>
                      <span className="font-semibold">{project.progress ?? 0}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${project.progress ?? 0}%` }}
                      />
                    </div>
                    <div className="mt-5 flex flex-col gap-2.5">
                      {KANBAN_COLUMNS.map((col) => (
                        <div key={col.key} className="flex items-center gap-2.5">
                          <span className={col.color}>{col.icon}</span>
                          <span className="text-[12px] text-muted-foreground flex-1">{col.label}</span>
                          <span className="text-[13px] font-semibold tabular-nums">
                            {tasksByStatus[col.key]?.length ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Kanban ──────────────────────────────────────────────── */}
          <TabsContent value="kanban" className="p-6">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {KANBAN_COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.key}
                  column={col}
                  tasks={tasksByStatus[col.key] ?? []}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          </TabsContent>

          {/* ── Tasks List ──────────────────────────────────────────── */}
          <TabsContent value="tasks" className="p-6">
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
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-muted-foreground text-[13px]">
                        No tasks yet. Click &quot;New Task&quot; to get started.
                      </td>
                    </tr>
                  )}
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-medium">{t.title}</div>
                        {t.description && (
                          <div className="text-[11px] text-muted-foreground/70 truncate max-w-xs mt-0.5">
                            {t.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{t.assignee_name ?? '—'}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md capitalize font-semibold ${
                            PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {t.due_date ? format(new Date(t.due_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-medium">
                        {t.estimated_hours ?? '—'}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Milestones ──────────────────────────────────────────── */}
          <TabsContent value="milestones" className="p-6">
            <div className="flex flex-col gap-3 max-w-3xl">
              {milestones.length === 0 && (
                <div className="py-16 text-center text-[13px] text-muted-foreground rounded-lg border border-dashed border-border/50">
                  No milestones defined yet.
                </div>
              )}
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <Flag className="size-4 text-muted-foreground/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] font-medium">{m.title}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Due: {m.due_date ? format(new Date(m.due_date), 'MMM d, yyyy') : '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-32">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${m.progress ?? 0}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-muted-foreground tabular-nums w-9 text-right font-medium">
                      {m.progress ?? 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Time Log ────────────────────────────────────────────── */}
          <TabsContent value="timelog" className="p-6">
            <div className="rounded-lg border border-border/40 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Task</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Team Member</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Hours</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {timeLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-muted-foreground text-[13px]">
                        No time logs recorded yet.
                      </td>
                    </tr>
                  )}
                  {timeLogs.map((l) => (
                    <tr key={l.id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5 font-medium">{l.task_title}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{l.user_name}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{l.description ?? '—'}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold">{l.hours}h</td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {l.logged_at ? format(new Date(l.logged_at), 'MMM d, yyyy') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
