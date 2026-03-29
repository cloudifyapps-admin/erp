'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Users,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────────────────── */

interface UserAllocation {
  user_id: string
  user_name: string
  email: string
  total_allocation: number // percentage 0-200+
  projects: {
    project_id: string
    project_name: string
    allocation: number
    start_date: string
    end_date: string
  }[]
  daily_allocations?: Record<string, number> // date string -> allocation %
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function getWeekDates(offset: number): Date[] {
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay() + 1 + offset * 7) // Monday
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d)
  }
  return dates
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
}

function formatDateKey(d: Date) {
  return d.toISOString().split('T')[0]
}

function getAllocationColor(pct: number): string {
  if (pct === 0) return 'bg-muted/30'
  if (pct <= 50) return 'bg-green-100 dark:bg-green-900/20'
  if (pct <= 80) return 'bg-blue-100 dark:bg-blue-900/20'
  if (pct <= 100) return 'bg-yellow-100 dark:bg-yellow-900/20'
  return 'bg-red-100 dark:bg-red-900/20'
}

function getAllocationTextColor(pct: number): string {
  if (pct === 0) return 'text-muted-foreground/40'
  if (pct <= 50) return 'text-green-700 dark:text-green-400'
  if (pct <= 80) return 'text-blue-700 dark:text-blue-400'
  if (pct <= 100) return 'text-yellow-700 dark:text-yellow-400'
  return 'text-red-700 dark:text-red-400'
}

function getBarColor(pct: number): string {
  if (pct <= 80) return 'bg-primary'
  if (pct <= 100) return 'bg-yellow-500'
  return 'bg-red-500'
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function ResourcePlannerPage() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserAllocation[]>([])
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDates = getWeekDates(weekOffset)
  const weekLabel = `${weekDates[0].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} - ${weekDates[6].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = formatDateKey(weekDates[0])
      const endDate = formatDateKey(weekDates[6])
      const { data: raw } = await api.get('/projects/resource-utilization', {
        params: { start_date: startDate, end_date: endDate },
      })
      const rawItems = Array.isArray(raw) ? raw : raw.data ?? raw.items ?? []
      // Transform API response to match expected UserAllocation shape
      const items = rawItems.map((u: Record<string, unknown>) => ({
        user_id: u.user_id,
        user_name: u.user_name ?? 'Unknown',
        email: '',
        total_allocation: u.total_allocation_percent ?? u.total_allocation ?? 0,
        projects: ((u.allocations ?? u.projects ?? []) as Record<string, unknown>[]).map((a) => ({
          project_id: a.project_id,
          project_name: a.project_name ?? `Project ${a.project_id}`,
          allocation: a.allocation_percent ?? a.allocation ?? 0,
          start_date: a.start_date ?? '',
          end_date: a.end_date ?? '',
        })),
      }))
      setUsers(items)
    } catch {
      toast.error('Failed to load resource data')
    } finally {
      setLoading(false)
    }
  }, [weekOffset])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const overAllocatedCount = users.filter((u) => u.total_allocation > 100).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resource Planner"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Resource Planner' }]}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Team Members</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{users.length}</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Over-allocated</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{overAllocatedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {overAllocatedCount === 0 ? 'No issues' : 'Needs attention'}
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Week View</span>
                <span className="text-sm font-semibold">{weekLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekOffset((w) => w - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setWeekOffset(0)}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekOffset((w) => w + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Workload bars */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border/40 px-6 py-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Workload Overview
          </h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No resource data available
            </p>
          ) : (
            <div className="space-y-4">
              {users
                .sort((a, b) => b.total_allocation - a.total_allocation)
                .map((user) => (
                  <div key={user.user_id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                          {user.user_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium">{user.user_name}</span>
                        {user.total_allocation > 100 && (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0">
                            Over-allocated
                          </Badge>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs font-semibold tabular-nums',
                          user.total_allocation > 100
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                        )}
                      >
                        {user.total_allocation}%
                      </span>
                    </div>
                    <div className="h-5 rounded-md bg-muted/40 overflow-hidden relative">
                      <div
                        className={cn('h-full rounded-md transition-all', getBarColor(user.total_allocation))}
                        style={{ width: `${Math.min(100, user.total_allocation)}%` }}
                      />
                      {user.total_allocation > 100 && (
                        <div className="absolute inset-0 flex items-center justify-end pr-2">
                          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                            {user.total_allocation}%
                          </span>
                        </div>
                      )}
                    </div>
                    {user.projects.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap pl-9">
                        {user.projects.map((p) => (
                          <span
                            key={p.project_id}
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5"
                          >
                            {p.project_name}{' '}
                            <span className="font-semibold">{p.allocation}%</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Allocation Heatmap */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border/40 px-6 py-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Allocation Heatmap
          </h2>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-muted/30 border border-border/40" />
              0%
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-green-100 dark:bg-green-900/20 border border-border/40" />
              1-50%
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-blue-100 dark:bg-blue-900/20 border border-border/40" />
              51-80%
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-yellow-100 dark:bg-yellow-900/20 border border-border/40" />
              81-100%
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-red-100 dark:bg-red-900/20 border border-border/40" />
              &gt;100%
            </div>
          </div>
        </div>
        <div className="p-6 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No resource data available
            </p>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 w-[180px]">
                    Team Member
                  </th>
                  {weekDates.map((d) => (
                    <th
                      key={formatDateKey(d)}
                      className={cn(
                        'text-center text-xs font-medium text-muted-foreground pb-3 px-1',
                        d.getDay() === 0 || d.getDay() === 6 ? 'opacity-50' : ''
                      )}
                    >
                      {formatDate(d)}
                    </th>
                  ))}
                  <th className="text-center text-xs font-medium text-muted-foreground pb-3 pl-3 w-[60px]">
                    Avg
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const dailyValues = weekDates.map((d) => {
                    const key = formatDateKey(d)
                    return user.daily_allocations?.[key] ?? Math.round(user.total_allocation / 5)
                  })
                  const avg = Math.round(
                    dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
                  )

                  return (
                    <tr key={user.user_id} className="border-t border-border/20">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase shrink-0">
                            {user.user_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                          <span className="text-xs font-medium truncate">{user.user_name}</span>
                        </div>
                      </td>
                      {weekDates.map((d, di) => {
                        const pct = dailyValues[di]
                        return (
                          <td key={formatDateKey(d)} className="py-2 px-1">
                            <div
                              className={cn(
                                'flex items-center justify-center h-8 rounded-md text-[11px] font-semibold tabular-nums transition-colors',
                                getAllocationColor(pct),
                                getAllocationTextColor(pct)
                              )}
                            >
                              {pct > 0 ? `${pct}%` : '\u2014'}
                            </div>
                          </td>
                        )
                      })}
                      <td className="py-2 pl-3">
                        <div
                          className={cn(
                            'flex items-center justify-center h-8 rounded-md text-[11px] font-bold tabular-nums',
                            getAllocationTextColor(avg)
                          )}
                        >
                          {avg}%
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
