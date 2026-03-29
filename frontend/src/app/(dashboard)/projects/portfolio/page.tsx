'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search as SearchIcon,
  ArrowUpDown,
  Loader2,
  FolderKanban,
  DollarSign,
  ListChecks,
  Filter,
} from 'lucide-react'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  health: string
  progress: number
  priority: string
  budget_planned: number
  budget_actual: number
  task_total: number
  task_completed: number
  start_date?: string
  end_date?: string
  manager_name?: string
}

type SortKey = 'name' | 'health' | 'progress' | 'budget'

/* ── Health & Priority helpers ─────────────────────────────────────── */

const HEALTH_STYLES: Record<string, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const HEALTH_LABELS: Record<string, string> = {
  green: 'On Track',
  yellow: 'At Risk',
  red: 'Off Track',
}

const HEALTH_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2 }

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function PortfolioPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<PortfolioProject[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterHealth, setFilterHealth] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/projects/analytics/portfolio-summary')
      const items = Array.isArray(raw) ? raw : raw.data ?? raw.items ?? []
      setProjects(items)
    } catch {
      toast.error('Failed to load portfolio data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter & sort
  const filtered = projects
    .filter((p) => {
      if (search) {
        const q = search.toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false
      }
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      if (filterPriority !== 'all' && p.priority !== filterPriority) return false
      if (filterHealth !== 'all' && p.health !== filterHealth) return false
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'health':
          cmp = (HEALTH_ORDER[a.health] ?? 2) - (HEALTH_ORDER[b.health] ?? 2)
          break
        case 'progress':
          cmp = (a.progress ?? 0) - (b.progress ?? 0)
          break
        case 'budget':
          cmp = (a.budget_actual ?? 0) - (b.budget_actual ?? 0)
          break
      }
      return sortAsc ? cmp : -cmp
    })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Portfolio"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Portfolio' }]}
      />

      {/* Filters & Sort */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="pl-9 h-9"
          />
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterHealth} onValueChange={setFilterHealth}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            <SelectItem value="green">On Track</SelectItem>
            <SelectItem value="yellow">At Risk</SelectItem>
            <SelectItem value="red">Off Track</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1">
          {(['name', 'health', 'progress', 'budget'] as SortKey[]).map((key) => (
            <Button
              key={key}
              variant={sortKey === key ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1 capitalize"
              onClick={() => handleSort(key)}
            >
              {key}
              {sortKey === key && (
                <ArrowUpDown className="h-3 w-3" />
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Project cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-5 animate-pulse">
              <div className="h-5 w-3/4 rounded bg-muted-foreground/10 mb-3" />
              <div className="h-3 w-full rounded bg-muted-foreground/8 mb-2" />
              <div className="h-2 w-full rounded bg-muted-foreground/5 mb-4" />
              <div className="h-3 w-1/2 rounded bg-muted-foreground/8" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-12 flex flex-col items-center justify-center gap-3">
          <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center">
            <FolderKanban className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-foreground/80">No projects found</p>
          <p className="text-xs text-muted-foreground">
            Adjust your filters or create new projects.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((project) => {
            const budgetPct =
              project.budget_planned > 0
                ? Math.round((project.budget_actual / project.budget_planned) * 100)
                : 0
            const taskPct =
              project.task_total > 0
                ? Math.round((project.task_completed / project.task_total) * 100)
                : 0

            return (
              <div
                key={project.id}
                className="group rounded-xl border border-border/60 bg-card p-5 hover:shadow-md transition-all cursor-pointer flex flex-col"
                onClick={() => router.push(`/projects/${project.id}/edit`)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">{project.code}</span>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[0.6rem] font-semibold shrink-0 ml-2',
                      HEALTH_STYLES[project.health] ?? HEALTH_STYLES.green
                    )}
                  >
                    {HEALTH_LABELS[project.health] ?? 'On Track'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Progress</span>
                    <span className="text-xs font-semibold tabular-nums">
                      {project.progress ?? 0}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, project.progress ?? 0)}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <ListChecks className="h-3 w-3" />
                    <span className="tabular-nums">
                      {project.task_completed ?? 0}/{project.task_total ?? 0}
                    </span>
                  </div>
                  {project.budget_planned > 0 && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      <span className="tabular-nums">{budgetPct}% used</span>
                    </div>
                  )}
                </div>

                {/* Bottom badges */}
                <div className="flex items-center gap-2 mt-auto flex-wrap">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[0.6rem] font-semibold capitalize',
                      PRIORITY_COLORS[project.priority] ?? PRIORITY_COLORS.medium
                    )}
                  >
                    {project.priority}
                  </span>
                  <Badge variant="secondary" className="text-[0.6rem] capitalize">
                    {project.status?.replace('_', ' ')}
                  </Badge>
                  {project.manager_name && (
                    <span className="text-[0.6rem] text-muted-foreground ml-auto truncate max-w-[80px]">
                      {project.manager_name}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
