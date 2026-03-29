'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  FolderKanban,
  Activity,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Flag,
  Clock,
  TrendingUp,
  ListTodo,
  Loader2,
  ArrowRight,
  CalendarDays,
} from 'lucide-react'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* ── Types ──────────────────────────────────────────────────────────── */

interface PortfolioProject {
  id: string
  name: string
  code: string
  status: string
  health: string
  progress: number
  budget_planned: number
  budget_actual: number
  task_total: number
  task_completed: number
}

interface MyTask {
  id: string
  title: string
  project_id: string
  project_name?: string
  status: string
  priority: string
  assignee_name: string
  due_date: string
}

interface MilestoneEntry {
  id: string
  name: string
  project_name: string
  due_date: string
  completed_date?: string
  status: string
}

interface BudgetVariance {
  project_name: string
  budget_planned: number
  budget_actual: number
  variance: number
  variance_pct: number
}

interface TaskTrend {
  date: string
  total: number
  completed: number
  remaining: number
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '$0'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '\u2014'
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const HEALTH_STYLES: Record<string, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const STATUS_STYLES: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  review: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

/* ── Health Badge ───────────────────────────────────────────────────── */

function HealthBadge({ health }: { health: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold capitalize',
        HEALTH_STYLES[health] ?? HEALTH_STYLES.green
      )}
    >
      {health === 'green' ? 'On Track' : health === 'yellow' ? 'At Risk' : 'Off Track'}
    </span>
  )
}

/* ── Simple SVG Line Chart ──────────────────────────────────────────── */

function TrendLineChart({
  data,
}: {
  data: { label: string; completed: number; remaining: number }[]
}) {
  if (data.length === 0) return null

  const allValues = data.flatMap((d) => [d.completed, d.remaining])
  const maxVal = Math.max(...allValues, 1)
  const width = 600
  const height = 180
  const padding = { top: 10, right: 10, bottom: 30, left: 40 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const getX = (i: number) =>
    padding.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2)
  const getY = (v: number) => padding.top + chartH - (v / maxVal) * chartH

  const completedPoints = data.map((d, i) => `${getX(i)},${getY(d.completed)}`).join(' ')
  const remainingPoints = data.map((d, i) => `${getX(i)},${getY(d.remaining)}`).join(' ')

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[350px]">
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padding.top + chartH * (1 - frac)
          return (
            <g key={frac}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                className="stroke-border/40"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[9px]"
              >
                {Math.round(maxVal * frac)}
              </text>
            </g>
          )
        })}

        <polyline
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinejoin="round"
          points={remainingPoints}
        />
        <polyline
          fill="none"
          stroke="hsl(142, 76%, 36%)"
          strokeWidth="2"
          strokeLinejoin="round"
          points={completedPoints}
        />

        {data.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={height - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[8px]"
          >
            {d.label}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
          Completed
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary))' }} />
          Remaining
        </div>
      </div>
    </div>
  )
}

/* ── Main Dashboard ─────────────────────────────────────────────────── */

export default function ProjectsDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [portfolio, setPortfolio] = useState<PortfolioProject[]>([])
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([])
  const [budgetVariance, setBudgetVariance] = useState<BudgetVariance[]>([])
  const [taskTrends, setTaskTrends] = useState<TaskTrend[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        api.get('/projects/analytics/portfolio-summary'),
        api.get('/projects/my-tasks', { params: { page: 1, page_size: 8 } }),
        api.get('/projects/analytics/milestone-tracking'),
        api.get('/projects/analytics/budget-variance'),
        api.get('/projects/analytics/task-trends'),
      ])

      if (results[0].status === 'fulfilled') {
        const raw = results[0].value.data
        const items = Array.isArray(raw) ? raw : raw.data ?? raw.items ?? []
        const healthMap: Record<string, string> = { on_track: 'green', at_risk: 'yellow', off_track: 'red' }
        setPortfolio(items.map((p: Record<string, unknown>) => ({
          id: String(p.id ?? ''),
          name: (p.name as string) ?? '',
          code: (p.code as string) ?? '',
          status: (p.status as string) ?? '',
          health: healthMap[(p.overall_health as string) ?? ''] ?? (p.health as string) ?? 'green',
          progress: (p.progress as number) ?? 0,
          budget_planned: (p.budget_planned as number) ?? (p.budget as number) ?? 0,
          budget_actual: (p.budget_actual as number) ?? (p.actual_cost as number) ?? 0,
          task_total: (p.task_total as number) ?? (p.total_tasks as number) ?? 0,
          task_completed: (p.task_completed as number) ?? (p.completed_tasks as number) ?? 0,
        })))
      }
      if (results[1].status === 'fulfilled') {
        const raw = results[1].value.data
        setMyTasks(Array.isArray(raw) ? raw : raw.data ?? raw.items ?? [])
      }
      if (results[2].status === 'fulfilled') {
        const raw = results[2].value.data
        const items = Array.isArray(raw) ? raw : raw.data ?? raw.items ?? []
        setMilestones(items.map((m: Record<string, unknown>) => ({
          id: String(m.id ?? ''),
          name: (m.name as string) ?? (m.title as string) ?? '',
          project_name: (m.project_name as string) ?? '',
          due_date: (m.due_date as string) ?? '',
          completed_date: (m.completed_date as string) ?? (m.completed_at as string) ?? undefined,
          status: (m.status_detail as string) ?? (m.status as string) ?? '',
        })))
      }
      if (results[3].status === 'fulfilled') {
        const raw = results[3].value.data
        const items = Array.isArray(raw) ? raw : raw.data ?? raw.items ?? []
        setBudgetVariance(items.map((b: Record<string, unknown>) => ({
          project_name: (b.project_name as string) ?? '',
          budget_planned: (b.budget_planned as number) ?? (b.budget as number) ?? 0,
          budget_actual: (b.budget_actual as number) ?? (b.actual as number) ?? 0,
          variance: (b.variance as number) ?? 0,
          variance_pct: (b.variance_pct as number) ?? (b.variance_percent as number) ?? 0,
        })))
      }
      if (results[4].status === 'fulfilled') {
        const raw = results[4].value.data
        const items = Array.isArray(raw) ? raw : raw.data ?? raw.items ?? []
        setTaskTrends(items.map((t: Record<string, unknown>) => ({
          date: t.date as string,
          total: (t.total as number) ?? (t.total_open as number) ?? 0,
          completed: (t.completed as number) ?? (t.total_completed as number) ?? 0,
          remaining: (t.remaining as number) ?? (t.total_open as number) ?? 0,
        })))
      }
    } catch {
      toast.error('Failed to load projects dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Derived stats ──────────────────────────────────────────────────

  const totalProjects = portfolio.length
  const activeProjects = portfolio.filter(
    (p) => p.status === 'active' || p.status === 'in_progress'
  ).length
  const completedProjects = portfolio.filter(
    (p) => p.status === 'completed' || p.status === 'done'
  ).length
  const overBudgetCount = portfolio.filter(
    (p) => (p.budget_actual ?? 0) > (p.budget_planned ?? 0) && (p.budget_planned ?? 0) > 0
  ).length

  const greenCount = portfolio.filter((p) => p.health === 'green').length
  const yellowCount = portfolio.filter((p) => p.health === 'yellow').length
  const redCount = portfolio.filter((p) => p.health === 'red').length

  const totalBudgetPlanned = portfolio.reduce((s, p) => s + (p.budget_planned ?? 0), 0)
  const totalBudgetActual = portfolio.reduce((s, p) => s + (p.budget_actual ?? 0), 0)

  const upcomingMilestones = milestones
    .filter((m) => m.status === 'upcoming' || (!m.completed_date && m.due_date))
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 8)

  const trendData = taskTrends.map((t) => ({
    label: t.date
      ? new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '',
    completed: t.completed,
    remaining: t.remaining,
  }))

  // Budget variance for display
  const budgetItems =
    budgetVariance.length > 0
      ? budgetVariance
      : portfolio
          .filter((p) => (p.budget_planned ?? 0) > 0 || (p.budget_actual ?? 0) > 0)
          .map((p) => ({
            project_name: p.name,
            budget_planned: p.budget_planned ?? 0,
            budget_actual: p.budget_actual ?? 0,
            variance: (p.budget_actual ?? 0) - (p.budget_planned ?? 0),
            variance_pct:
              (p.budget_planned ?? 0) > 0
                ? (((p.budget_actual ?? 0) - (p.budget_planned ?? 0)) / (p.budget_planned ?? 0)) *
                  100
                : 0,
          }))

  const budgetMaxValue = Math.max(
    ...budgetItems.map((b) => Math.max(b.budget_planned, b.budget_actual)),
    1
  )

  // ── Loading state ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Dashboard"
          breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Dashboard' }]}
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Dashboard' }]}
      />

      {/* ── Row 1: Summary Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderKanban className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Total Projects</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{totalProjects}</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Activity className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Active Projects</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{activeProjects}</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Completed</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{completedProjects}</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Over Budget</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{overBudgetCount}</p>
        </div>
      </div>

      {/* ── Row 2: My Tasks + Upcoming Milestones ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              My Recent Tasks
            </h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
              <Link href="/projects/my-tasks">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          <div className="p-4">
            {myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No tasks assigned to you
              </p>
            ) : (
              <div className="space-y-1">
                {myTasks.slice(0, 8).map((task) => (
                  <Link
                    key={task.id}
                    href={`/projects/${task.project_id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {task.title}
                      </p>
                      {task.project_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {task.project_name}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold capitalize',
                        STATUS_STYLES[task.status] ?? STATUS_STYLES.todo
                      )}
                    >
                      {task.status?.replace('_', ' ')}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold capitalize',
                        PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium
                      )}
                    >
                      {task.priority}
                    </span>
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {formatDate(task.due_date)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Milestones */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Flag className="h-4 w-4 text-muted-foreground" />
              Upcoming Milestones
            </h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
              <Link href="/projects/milestones">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          <div className="p-4">
            {upcomingMilestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No upcoming milestones
              </p>
            ) : (
              <div className="space-y-1">
                {upcomingMilestones.map((ms) => {
                  const days = daysUntil(ms.due_date)
                  const isOverdue = days < 0
                  const isUrgent = days >= 0 && days <= 3

                  return (
                    <div
                      key={ms.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full shrink-0',
                          isOverdue
                            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            : isUrgent
                              ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        )}
                      >
                        {isOverdue ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <CalendarDays className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ms.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{ms.project_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {formatDate(ms.due_date)}
                        </p>
                        <p
                          className={cn(
                            'text-[0.65rem] font-medium',
                            isOverdue
                              ? 'text-red-600'
                              : isUrgent
                                ? 'text-yellow-600'
                                : 'text-muted-foreground'
                          )}
                        >
                          {isOverdue
                            ? `${Math.abs(days)}d overdue`
                            : days === 0
                              ? 'Due today'
                              : `${days}d remaining`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Portfolio Health ────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Portfolio Health Overview
          </h2>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
              {greenCount} On Track
            </Badge>
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
              {yellowCount} At Risk
            </Badge>
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
              {redCount} Off Track
            </Badge>
          </div>
        </div>
        <div className="p-6">
          {portfolio.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No project data available
            </p>
          ) : (
            <div className="space-y-3">
              {portfolio.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-4 py-2.5 border-b border-border/20 last:border-0 hover:bg-accent/30 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{project.name}</span>
                      <span className="text-xs text-muted-foreground">{project.code}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 max-w-[200px] h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, project.progress ?? 0)}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                        {project.progress ?? 0}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {project.task_completed ?? 0}/{project.task_total ?? 0} tasks
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatCurrency(project.budget_actual ?? 0)} /{' '}
                    {formatCurrency(project.budget_planned ?? 0)}
                  </div>
                  <HealthBadge health={project.health ?? 'green'} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Budget Variance + Task Trends ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Variance */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Budget Overview
            </h2>
            <div className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(totalBudgetActual)} of {formatCurrency(totalBudgetPlanned)}
            </div>
          </div>
          <div className="p-6">
            {budgetItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No budget data available
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
                    Actual
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-primary/30" />
                    Planned
                  </div>
                </div>
                {budgetItems.slice(0, 8).map((item) => {
                  const isOverBudget = item.budget_actual > item.budget_planned && item.budget_planned > 0

                  return (
                    <div key={item.project_name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate max-w-[200px]">
                          {item.project_name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatCurrency(item.budget_actual)} / {formatCurrency(item.budget_planned)}
                          </span>
                          {isOverBudget && (
                            <span className="text-[0.65rem] font-medium text-red-600">
                              +{Math.abs(item.variance_pct).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative h-5 rounded-md bg-muted/40 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-md bg-primary/30 transition-all"
                          style={{
                            width: `${budgetMaxValue > 0 ? (item.budget_planned / budgetMaxValue) * 100 : 0}%`,
                          }}
                        />
                        <div
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-md transition-all',
                            isOverBudget ? 'bg-red-500' : 'bg-primary'
                          )}
                          style={{
                            width: `${budgetMaxValue > 0 ? (item.budget_actual / budgetMaxValue) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Task Trends */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/40 px-6 py-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Task Trends (Burn-down)
            </h2>
          </div>
          <div className="p-6">
            {trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No trend data available
              </p>
            ) : (
              <TrendLineChart data={trendData} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
