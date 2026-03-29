'use client'

import { useState, useEffect, useCallback, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { format, differenceInDays, isPast } from 'date-fns'
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Circle,
  Calendar,
  DollarSign,
  Target,
  Timer,
  Pencil,
  Columns3,
  ListChecks,
  Flag,
  Users,
  Layers,
  MessageSquare,
  Paperclip,
  ShieldAlert,
  AlertTriangle,
  GitPullRequest,
  FileText,
  Loader2,
  GanttChart as GanttChartIcon,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ──────────────────────────────────────────────────────────── */

interface Task {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority: string
  assignee_name: string
  due_date: string
  estimated_hours: number
  description: string
}

interface Milestone {
  id: number
  title: string
  due_date: string
  status: string
  progress: number
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
  actual_cost: number
  currency: string
  total_tasks: number
  completed_tasks: number
  total_hours: number
  billable_hours: number
  billing_rate: number
  category: string
  tags: string[]
}

/* ── Constants ──────────────────────────────────────────────────────── */

const STATUS_COLUMNS: {
  key: Task['status']
  label: string
  icon: typeof Circle
  dotColor: string
}[] = [
  { key: 'todo', label: 'To Do', icon: Circle, dotColor: 'bg-slate-400' },
  { key: 'in_progress', label: 'In Progress', icon: Clock, dotColor: 'bg-blue-500' },
  { key: 'review', label: 'Review', icon: AlertCircle, dotColor: 'bg-orange-500' },
  { key: 'done', label: 'Done', icon: CheckCircle2, dotColor: 'bg-green-500' },
]

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

const PROJECT_MODULES = [
  { title: 'Kanban', icon: Columns3, route: 'kanban', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
  { title: 'Tasks', icon: ListChecks, route: 'tasks', color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40' },
  { title: 'Gantt', icon: GanttChartIcon, route: 'gantt', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
  { title: 'Milestones', icon: Flag, route: 'milestones', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  { title: 'Time Log', icon: Clock, route: 'time-log', color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40' },
  { title: 'Team', icon: Users, route: 'team', color: 'text-pink-600 bg-pink-50 dark:bg-pink-950/40' },
  { title: 'Phases', icon: Layers, route: 'phases', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
  { title: 'Activity', icon: MessageSquare, route: 'activity', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40' },
  { title: 'Files', icon: Paperclip, route: 'files', color: 'text-slate-600 bg-slate-50 dark:bg-slate-800/40' },
  { title: 'Finance', icon: DollarSign, route: 'finance', color: 'text-green-600 bg-green-50 dark:bg-green-950/40' },
  { title: 'Risks', icon: ShieldAlert, route: 'risks', color: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
  { title: 'Issues', icon: AlertTriangle, route: 'issues', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40' },
  { title: 'Changes', icon: GitPullRequest, route: 'change-requests', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
  { title: 'Reports', icon: FileText, route: 'reports', color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40' },
  { title: 'Meetings', icon: Calendar, route: 'meetings', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
]

function formatCurrency(amount: number, currency: string = '$') {
  return `${currency}${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function getProgressColor(progress: number): string {
  if (progress >= 80) return 'bg-green-500'
  if (progress >= 50) return 'bg-blue-500'
  if (progress >= 25) return 'bg-orange-500'
  return 'bg-slate-400'
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    planning: 'from-slate-500 to-slate-600',
    active: 'from-blue-500 to-blue-600',
    in_progress: 'from-blue-500 to-blue-600',
    on_hold: 'from-orange-500 to-orange-600',
    completed: 'from-green-500 to-green-600',
    cancelled: 'from-red-500 to-red-600',
  }
  return map[status] ?? 'from-slate-500 to-slate-600'
}

/* ── Main Page ──────────────────────────────────────────────────────── */

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])

  // Task creation
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
    } catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/tasks`, { params: { page_size: 200 } })
      setTasks(normalizePaginated<Task>(data).items)
    } catch { /* silent */ }
  }, [projectId])

  const fetchMilestones = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/milestones`, { params: { page_size: 10 } })
      setMilestones(normalizePaginated<Milestone>(data).items)
    } catch { /* silent */ }
  }, [projectId])

  useEffect(() => { fetchProject(); fetchTasks(); fetchMilestones() }, [fetchProject, fetchTasks, fetchMilestones])

  const tasksByStatus = useMemo(() =>
    STATUS_COLUMNS.reduce((acc, col) => {
      acc[col.key] = tasks.filter((t) => t.status === col.key)
      return acc
    }, {} as Record<Task['status'], Task[]>),
    [tasks]
  )

  const recentTasks = useMemo(() => tasks.slice(0, 5), [tasks])
  const upcomingMilestones = useMemo(() =>
    milestones
      .filter((m) => m.status !== 'completed')
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
      .slice(0, 3),
    [milestones]
  )

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
      setNewTaskTitle(''); setNewTaskPriority('medium'); setNewTaskAssignee(''); setNewTaskDue(''); setNewTaskEstHours(''); setNewTaskDesc('')
      setShowAddTask(false); fetchTasks()
    } catch { toast.error('Failed to create task') } finally { setSubmitting(false) }
  }

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Project Not Found" breadcrumbs={[{ label: 'Projects', href: '/projects' }]} />
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-border/60 bg-card">
          <p className="text-muted-foreground text-sm">This project could not be found.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/projects')}>Back to Projects</Button>
        </div>
      </div>
    )
  }

  const totalTasks = project.total_tasks ?? tasks.length
  const completedTasks = project.completed_tasks ?? tasksByStatus.done?.length ?? 0
  const daysRemaining = project.end_date ? differenceInDays(new Date(project.end_date), new Date()) : null
  const isOverdue = project.end_date ? isPast(new Date(project.end_date)) && project.status !== 'completed' : false
  const budgetUsedPct = project.budget && project.actual_cost ? Math.round((project.actual_cost / project.budget) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      {/* ── Breadcrumb + Actions ─────────────────────────────────────── */}
      <PageHeader
        title={project.name}
        breadcrumbs={[{ label: 'Projects', href: '/projects' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-lg px-4 text-[13px] gap-1.5" onClick={() => router.push(`/projects/${projectId}/edit`)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button size="sm" className="h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm gap-1.5" onClick={() => setShowAddTask(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Task
            </Button>
          </div>
        }
      />

      {/* ── Hero Banner ──────────────────────────────────────────────── */}
      <div className={cn(
        'relative rounded-2xl overflow-hidden bg-gradient-to-r text-white p-6 lg:p-8',
        getStatusColor(project.status)
      )}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2MmgtMnYtMnptLTQgOHYtMmgydjJoLTJ6bTIgMHYyaC0ydi0yaDJ6bTItMTJ2Mmgtdjl2LTJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-mono bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded">{project.code}</span>
              <span className="text-[11px] bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded capitalize">{project.status.replace('_', ' ')}</span>
              {project.priority && (
                <span className="text-[11px] bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded capitalize">{project.priority}</span>
              )}
            </div>
            <p className="text-white/80 text-[13px] max-w-xl mt-1 line-clamp-2">
              {project.description || 'No description provided.'}
            </p>
            <div className="flex items-center gap-4 mt-3 text-[12px] text-white/70">
              {project.manager_name && (
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{project.manager_name}</span>
              )}
              {project.start_date && (
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(project.start_date), 'MMM d, yyyy')}</span>
              )}
              {project.client_name && (
                <span className="flex items-center gap-1"><Target className="h-3 w-3" />{project.client_name}</span>
              )}
            </div>
          </div>
          {/* Progress ring */}
          <div className="flex items-center gap-6">
            <div className="relative flex items-center justify-center w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${(project.progress ?? 0) * 2.136} 213.6`} />
              </svg>
              <span className="absolute text-[16px] font-bold">{project.progress ?? 0}%</span>
            </div>
            {daysRemaining !== null && (
              <div className="text-center">
                <p className={cn("text-[22px] font-bold", isOverdue && "text-red-200")}>{isOverdue ? 'Overdue' : daysRemaining}</p>
                <p className="text-[11px] text-white/70">{isOverdue ? `by ${Math.abs(daysRemaining)}d` : 'days left'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Metric Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40"><ListChecks className="h-4 w-4 text-blue-600" /></div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tasks</span>
          </div>
          <p className="text-[22px] font-bold tabular-nums">{completedTasks}<span className="text-[14px] text-muted-foreground font-normal"> / {totalTasks}</span></p>
          <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40"><Timer className="h-4 w-4 text-orange-600" /></div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Hours Logged</span>
          </div>
          <p className="text-[22px] font-bold tabular-nums">{(project.total_hours ?? 0).toLocaleString()}<span className="text-[14px] text-muted-foreground font-normal">h</span></p>
          {project.billable_hours > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">{project.billable_hours}h billable</p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/40"><DollarSign className="h-4 w-4 text-green-600" /></div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Budget</span>
          </div>
          <p className="text-[22px] font-bold tabular-nums">{project.budget ? formatCurrency(project.budget, project.currency ?? '$') : '---'}</p>
          {project.budget > 0 && project.actual_cost > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", budgetUsedPct > 90 ? 'bg-red-500' : 'bg-green-500')} style={{ width: `${Math.min(100, budgetUsedPct)}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">{budgetUsedPct}%</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/40"><BarChart3 className="h-4 w-4 text-violet-600" /></div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Task Breakdown</span>
          </div>
          <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden bg-muted">
            {STATUS_COLUMNS.map((col) => {
              const count = tasksByStatus[col.key]?.length ?? 0
              const pct = totalTasks > 0 ? (count / totalTasks) * 100 : 0
              return pct > 0 ? <div key={col.key} className={cn("h-full transition-all", col.dotColor)} style={{ width: `${pct}%` }} /> : null
            })}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5">
            {STATUS_COLUMNS.map((col) => (
              <div key={col.key} className="flex items-center gap-1.5">
                <div className={cn("h-2 w-2 rounded-full", col.dotColor)} />
                <span className="text-[11px] text-muted-foreground">{col.label}</span>
                <span className="text-[11px] font-semibold ml-auto tabular-nums">{tasksByStatus[col.key]?.length ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Project Modules ────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40">
          <h3 className="text-[13px] font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />Project Modules</h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-5">
          {PROJECT_MODULES.map((mod) => (
            <Link
              key={mod.route}
              href={`/projects/${projectId}/${mod.route}`}
              className="flex flex-col items-center gap-2 py-4 px-2 border-b border-r border-border/20 last:border-r-0 hover:bg-muted/30 transition-all group"
            >
              <div className={cn("p-2 rounded-xl transition-all group-hover:scale-110", mod.color)}>
                <mod.icon className="h-4.5 w-4.5" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">{mod.title}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent Tasks + Details + Milestones ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
        {/* Recent Tasks */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" />Recent Tasks</h3>
            <Link href={`/projects/${projectId}/tasks`} className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/30">
            {recentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <ListChecks className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-[13px] text-muted-foreground">No tasks yet</p>
                <Button size="sm" variant="outline" className="mt-1 text-[12px] h-7" onClick={() => setShowAddTask(true)}>
                  <Plus className="h-3 w-3 mr-1" />Create Task
                </Button>
              </div>
            ) : (
              recentTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${projectId}/tasks`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className={cn("h-2 w-2 rounded-full flex-shrink-0", STATUS_COLUMNS.find(c => c.key === task.status)?.dotColor ?? 'bg-slate-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{task.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {task.assignee_name ?? 'Unassigned'}
                      {task.due_date && ` · Due ${format(new Date(task.due_date), 'MMM d')}`}
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize flex-shrink-0',
                    PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600'
                  )}>
                    {task.priority}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Project Details + Milestones Row ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
        {/* Project Details */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40">
            <h3 className="text-[13px] font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Project Details</h3>
          </div>
          <div className="px-5 py-1">
            {[
              { label: 'Manager', value: project.manager_name },
              { label: 'Client', value: project.client_name },
              { label: 'Category', value: project.category },
              { label: 'Start Date', value: project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : null },
              { label: 'End Date', value: project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : null },
              { label: 'Billing Rate', value: project.billing_rate ? formatCurrency(project.billing_rate, project.currency ?? '$') + '/hr' : null },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-b-0">
                <span className="text-[12px] text-muted-foreground">{item.label}</span>
                <span className="text-[13px] font-medium">{item.value || '---'}</span>
              </div>
            ))}
          </div>
          {project.tags && project.tags.length > 0 && (
            <div className="px-5 py-3 border-t border-border/40 flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Milestones */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold flex items-center gap-2"><Flag className="h-4 w-4 text-primary" />Upcoming Milestones</h3>
            <Link href={`/projects/${projectId}/milestones`} className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/30">
            {upcomingMilestones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Flag className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-[13px] text-muted-foreground">No upcoming milestones</p>
              </div>
            ) : (
              upcomingMilestones.map((ms) => {
                const daysLeft = ms.due_date ? differenceInDays(new Date(ms.due_date), new Date()) : null
                const overdue = daysLeft !== null && daysLeft < 0
                return (
                  <div key={ms.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={cn("p-2 rounded-lg", overdue ? 'bg-red-50 dark:bg-red-950/40' : 'bg-primary/5')}>
                      <Flag className={cn("h-4 w-4", overdue ? 'text-red-500' : 'text-primary')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{ms.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={ms.status} />
                        {ms.due_date && (
                          <span className={cn("text-[11px]", overdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                            {overdue ? `${Math.abs(daysLeft!)}d overdue` : `${daysLeft}d remaining`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-14 text-right">
                      <span className="text-[12px] font-semibold tabular-nums">{ms.progress}%</span>
                      <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
                        <div className={cn("h-full rounded-full", getProgressColor(ms.progress))} style={{ width: `${ms.progress}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Add Task Dialog ──────────────────────────────────────────── */}
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
                <Label className="text-[13px]">Assignee (User ID)</Label>
                <Input type="number" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} placeholder="User ID" className="mt-1" />
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
    </div>
  )
}
