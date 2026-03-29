'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Activity,
  TrendingUp,
  DollarSign,
  Milestone,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Loader2,
} from 'lucide-react'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────────────────── */

interface PortfolioProject {
  id: string
  name: string
  code: string
  status: string
  health: string // green | yellow | red
  progress: number
  budget_planned: number
  budget_actual: number
  task_total: number
  task_completed: number
}

interface TimeReport {
  user_name: string
  project_name: string
  hours: number
}

interface MilestoneEntry {
  id: string
  name: string
  project_name: string
  due_date: string
  completed_date?: string
  status: string // on_time | delayed | upcoming
}

interface TaskTrend {
  date: string
  total: number
  completed: number
  remaining: number
}

/* ── Health badge ──────────────────────────────────────────────────── */

const HEALTH_STYLES: Record<string, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

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

/* ── Simple Bar Chart (CSS) ────────────────────────────────────────── */

function BarChart({
  data,
  maxValue,
  label,
  sublabel,
  valueA,
  valueB,
}: {
  data: { label: string; a: number; b: number }[]
  maxValue: number
  label: string
  sublabel: string
  valueA: string
  valueB: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-1">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
          {valueA}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-primary/30" />
          {valueB}
        </div>
      </div>
      {data.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium truncate max-w-[200px]">{item.label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              ${item.a.toLocaleString()} / ${item.b.toLocaleString()}
            </span>
          </div>
          <div className="relative h-5 rounded-md bg-muted/40 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-md bg-primary/30 transition-all"
              style={{ width: `${maxValue > 0 ? (item.b / maxValue) * 100 : 0}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-md bg-primary transition-all"
              style={{ width: `${maxValue > 0 ? (item.a / maxValue) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Simple Line Chart (SVG) ───────────────────────────────────────── */

function LineChart({
  data,
  lines,
  colors,
}: {
  data: { label: string; values: Record<string, number> }[]
  lines: string[]
  colors: string[]
}) {
  if (data.length === 0) return null

  const allValues = data.flatMap((d) => lines.map((l) => d.values[l] ?? 0))
  const maxVal = Math.max(...allValues, 1)
  const width = 600
  const height = 200
  const padding = { top: 10, right: 10, bottom: 30, left: 40 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const getX = (i: number) => padding.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2)
  const getY = (v: number) => padding.top + chartH - (v / maxVal) * chartH

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[400px]">
        {/* Grid lines */}
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

        {/* Lines */}
        {lines.map((lineKey, li) => {
          const points = data.map((d, i) => `${getX(i)},${getY(d.values[lineKey] ?? 0)}`)
          return (
            <polyline
              key={lineKey}
              fill="none"
              stroke={colors[li]}
              strokeWidth="2"
              strokeLinejoin="round"
              points={points.join(' ')}
            />
          )
        })}

        {/* X axis labels */}
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

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 justify-center">
        {lines.map((lineKey, li) => (
          <div key={lineKey} className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[li] }} />
            {lineKey.replace('_', ' ')}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [portfolioProjects, setPortfolioProjects] = useState<PortfolioProject[]>([])
  const [timeReports, setTimeReports] = useState<TimeReport[]>([])
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([])
  const [taskTrends, setTaskTrends] = useState<TaskTrend[]>([])
  const [timeGroupBy, setTimeGroupBy] = useState<'user' | 'project'>('user')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        api.get('/projects/analytics/portfolio-summary'),
        api.get('/projects/analytics/time-reports'),
        api.get('/projects/analytics/milestone-tracking'),
        api.get('/projects/analytics/task-trends'),
      ])

      if (results[0].status === 'fulfilled') {
        const raw = results[0].value.data
        setPortfolioProjects(Array.isArray(raw) ? raw : raw.data ?? raw.items ?? [])
      }
      if (results[1].status === 'fulfilled') {
        const raw = results[1].value.data
        setTimeReports(Array.isArray(raw) ? raw : raw.data ?? raw.items ?? [])
      }
      if (results[2].status === 'fulfilled') {
        const raw = results[2].value.data
        setMilestones(Array.isArray(raw) ? raw : raw.data ?? raw.items ?? [])
      }
      if (results[3].status === 'fulfilled') {
        const raw = results[3].value.data
        setTaskTrends(Array.isArray(raw) ? raw : raw.data ?? raw.items ?? [])
      }
    } catch {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Derived stats
  const totalProjects = portfolioProjects.length
  const greenCount = portfolioProjects.filter((p) => p.health === 'green').length
  const yellowCount = portfolioProjects.filter((p) => p.health === 'yellow').length
  const redCount = portfolioProjects.filter((p) => p.health === 'red').length
  const avgProgress =
    totalProjects > 0
      ? Math.round(portfolioProjects.reduce((s, p) => s + (p.progress ?? 0), 0) / totalProjects)
      : 0

  const totalBudgetPlanned = portfolioProjects.reduce((s, p) => s + (p.budget_planned ?? 0), 0)
  const totalBudgetActual = portfolioProjects.reduce((s, p) => s + (p.budget_actual ?? 0), 0)

  const onTimeMilestones = milestones.filter((m) => m.status === 'on_time').length
  const delayedMilestones = milestones.filter((m) => m.status === 'delayed').length

  // Budget variance chart data
  const budgetData = portfolioProjects
    .filter((p) => (p.budget_planned ?? 0) > 0 || (p.budget_actual ?? 0) > 0)
    .map((p) => ({
      label: p.name,
      a: p.budget_actual ?? 0,
      b: p.budget_planned ?? 0,
    }))
  const budgetMax = Math.max(...budgetData.map((d) => Math.max(d.a, d.b)), 1)

  // Time reports grouped
  const timeGrouped = (() => {
    const map = new Map<string, number>()
    timeReports.forEach((r) => {
      const key = timeGroupBy === 'user' ? r.user_name : r.project_name
      map.set(key, (map.get(key) ?? 0) + r.hours)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  })()
  const maxHours = Math.max(...timeGrouped.map((r) => r[1]), 1)

  // Task trends chart data
  const trendData = taskTrends.map((t) => ({
    label: t.date ? new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
    values: { completed: t.completed, remaining: t.remaining },
  }))

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Project Analytics"
          breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Analytics' }]}
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Project Analytics"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Analytics' }]}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Total Projects</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{totalProjects}</p>
          <p className="text-xs text-muted-foreground mt-1">Avg {avgProgress}% complete</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Health Status</span>
          </div>
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

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <DollarSign className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Budget Overview</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">${totalBudgetActual.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            of ${totalBudgetPlanned.toLocaleString()} planned
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
              <Milestone className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Milestones</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
              {onTimeMilestones} On Time
            </Badge>
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
              {delayedMilestones} Delayed
            </Badge>
          </div>
        </div>
      </div>

      {/* Portfolio Health */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border/40 px-6 py-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Portfolio Health
          </h2>
        </div>
        <div className="p-6">
          {portfolioProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No project data available</p>
          ) : (
            <div className="space-y-3">
              {portfolioProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-4 py-2 border-b border-border/20 last:border-0"
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
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {project.task_completed ?? 0}/{project.task_total ?? 0} tasks
                  </div>
                  <HealthBadge health={project.health ?? 'green'} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Variance */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/40 px-6 py-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Budget Variance
            </h2>
          </div>
          <div className="p-6">
            {budgetData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No budget data available</p>
            ) : (
              <BarChart
                data={budgetData}
                maxValue={budgetMax}
                label="Budget"
                sublabel="per project"
                valueA="Actual"
                valueB="Planned"
              />
            )}
          </div>
        </div>

        {/* Time Reports */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Time Reports
            </h2>
            <Select value={timeGroupBy} onValueChange={(v) => setTimeGroupBy(v as 'user' | 'project')}>
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">By User</SelectItem>
                <SelectItem value="project">By Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-6">
            {timeGrouped.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No time data available</p>
            ) : (
              <div className="space-y-3">
                {timeGrouped.map(([name, hours]) => (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate max-w-[200px]">{name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {hours.toFixed(1)} hrs
                      </span>
                    </div>
                    <div className="h-4 rounded-md bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-md bg-blue-500 transition-all"
                        style={{ width: `${(hours / maxHours) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Milestone Tracking */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/40 px-6 py-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Milestone className="h-4 w-4 text-muted-foreground" />
              Milestone Tracking
            </h2>
          </div>
          <div className="p-6">
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No milestones available</p>
            ) : (
              <div className="space-y-2">
                {milestones.slice(0, 10).map((ms) => (
                  <div
                    key={ms.id}
                    className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0"
                  >
                    <div
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full shrink-0',
                        ms.status === 'on_time'
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                          : ms.status === 'delayed'
                            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      )}
                    >
                      {ms.status === 'on_time' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : ms.status === 'delayed' ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ms.name}</p>
                      <p className="text-xs text-muted-foreground">{ms.project_name}</p>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {ms.due_date ? new Date(ms.due_date).toLocaleDateString() : '\u2014'}
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs capitalize',
                        ms.status === 'delayed' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {ms.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
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
              <p className="text-sm text-muted-foreground text-center py-8">No trend data available</p>
            ) : (
              <LineChart
                data={trendData}
                lines={['remaining', 'completed']}
                colors={['hsl(var(--primary))', 'hsl(142, 76%, 36%)']}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
