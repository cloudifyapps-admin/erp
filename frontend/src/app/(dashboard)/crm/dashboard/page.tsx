'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  DollarSign,
  Target,
  Briefcase,
  Trophy,
  TrendingUp,
  CalendarDays,
} from 'lucide-react'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────

interface PipelineSummary {
  total_pipeline: number
  weighted_pipeline: number
  open_deals: number
  won_count: number
  won_value: number
  avg_deal_size: number
  by_stage: { stage: string; count: number; value: number }[]
}

interface ConversionFunnel {
  total_leads: number
  by_status: Record<string, number>
  conversion_rate: number
  qualification_rate: number
}

interface LeadSourceAnalysis {
  sources: { source: string; count: number; converted: number; conversion_rate: number }[]
}

interface SalesForecast {
  forecast: { month: string; expected_revenue: number; weighted_revenue: number }[]
}

interface ActivityMetrics {
  total: number
  by_type: { type: string; count: number }[]
  by_user: { user_id: number; count: number }[]
  overdue: number
}

interface TopPerformer {
  user_id: number
  name: string
  email: string
  won_deals: number
  revenue: number
}

interface WinLossAnalysis {
  won: number
  lost: number
  total: number
  win_rate: number
  loss_reasons: { lost_reason_id: number; count: number }[]
}

// ── Helpers ────────────────────────────────────────────────────────────

const CHART_COLORS = [
  'var(--color-chart-1, oklch(0.646 0.222 41.116))',
  'var(--color-chart-2, oklch(0.6 0.118 184.704))',
  'var(--color-chart-3, oklch(0.398 0.07 227.392))',
  'var(--color-chart-4, oklch(0.828 0.189 84.429))',
  'var(--color-chart-5, oklch(0.769 0.188 70.08))',
  'var(--color-chart-6, oklch(0.627 0.265 303.9))',
]

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

function formatCurrency(value: number | undefined | null): string {
  if (value == null) return '$0'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function formatNumber(value: number | undefined | null): string {
  if (value == null) return '0'
  return new Intl.NumberFormat().format(value)
}

function getDefaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - 3)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

// ── Loading Skeleton ───────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="mt-2 h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Chart rows */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export default function CRMDashboardPage() {
  const defaultRange = getDefaultDateRange()
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null)
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null)
  const [leadSources, setLeadSources] = useState<LeadSourceAnalysis | null>(null)
  const [forecast, setForecast] = useState<SalesForecast | null>(null)
  const [activities, setActivities] = useState<ActivityMetrics | null>(null)
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([])
  const [winLoss, setWinLoss] = useState<WinLossAnalysis | null>(null)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = {
      ...(dateFrom && { date_from: dateFrom }),
      ...(dateTo && { date_to: dateTo }),
    }

    try {
      const [
        pipelineRes,
        funnelRes,
        leadSourceRes,
        forecastRes,
        activityRes,
        performersRes,
        winLossRes,
      ] = await Promise.all([
        api.get('/crm/analytics/pipeline-summary', { params }),
        api.get('/crm/analytics/conversion-funnel', { params }),
        api.get('/crm/analytics/lead-source-analysis', { params }),
        api.get('/crm/analytics/sales-forecast', { params: { ...params, months: 6 } }),
        api.get('/crm/analytics/activity-metrics', { params }),
        api.get('/crm/analytics/top-performers', { params: { ...params, limit: 5 } }),
        api.get('/crm/analytics/win-loss-analysis', { params }),
      ])

      setPipeline(pipelineRes.data)
      setFunnel(funnelRes.data)
      setLeadSources(leadSourceRes.data)
      setForecast(forecastRes.data)
      setActivities(activityRes.data)
      setTopPerformers(
        Array.isArray(performersRes.data)
          ? performersRes.data
          : performersRes.data?.performers ?? performersRes.data?.items ?? []
      )
      setWinLoss(winLossRes.data)
    } catch {
      setError('Failed to load dashboard data. Please try again.')
      toast.error('Failed to load CRM dashboard data')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // ── Date filter bar ──────────────────────────────────────────────────

  const dateFilter = (
    <div className="flex items-center gap-2">
      <CalendarDays className="h-4 w-4 text-muted-foreground" />
      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        className="h-9 w-36 text-[13px]"
      />
      <span className="text-muted-foreground text-[13px]">to</span>
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        className="h-9 w-36 text-[13px]"
      />
      <Button variant="outline" size="sm" className="h-9" onClick={fetchDashboardData}>
        Apply
      </Button>
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────

  if (error && !loading && !pipeline) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="CRM Dashboard"
          breadcrumbs={[{ label: 'CRM' }, { label: 'Dashboard' }]}
          actions={dateFilter}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchDashboardData}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="CRM Dashboard"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Dashboard' }]}
        actions={dateFilter}
      />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          {/* ── Row 1: KPI Stat Cards ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              title="Total Pipeline"
              value={formatCurrency(pipeline?.total_pipeline ?? 0)}
              icon={DollarSign}
              description="All open opportunities"
            />
            <StatCard
              title="Weighted Pipeline"
              value={formatCurrency(pipeline?.weighted_pipeline ?? 0)}
              icon={Target}
              description="Probability-weighted"
            />
            <StatCard
              title="Open Deals"
              value={formatNumber(pipeline?.open_deals ?? 0)}
              icon={Briefcase}
              description="Active opportunities"
            />
            <StatCard
              title="Won Deals"
              value={formatNumber(pipeline?.won_count ?? 0)}
              icon={Trophy}
              description="Closed won"
            />
            <StatCard
              title="Conversion Rate"
              value={`${(funnel?.conversion_rate ?? 0).toFixed(1)}%`}
              icon={TrendingUp}
              description="Lead to deal"
            />
          </div>

          {/* ── Row 2: Pipeline by Stage + Sales Forecast ─────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Pipeline by Stage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Pipeline by Stage</CardTitle>
              </CardHeader>
              <CardContent>
                {pipeline?.by_stage && pipeline.by_stage.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={pipeline.by_stage}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => formatCurrency(v)}
                        className="text-xs"
                      />
                      <YAxis
                        dataKey="stage"
                        type="category"
                        width={100}
                        className="text-xs"
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value)), 'Value']}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="value" fill="var(--color-chart-1, #3b82f6)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                    No pipeline data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sales Forecast */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Sales Forecast (6 Months)</CardTitle>
              </CardHeader>
              <CardContent>
                {forecast?.forecast && forecast.forecast.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={forecast.forecast}
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => formatCurrency(v)} className="text-xs" />
                      <Tooltip
                        formatter={(value, name) => [
                          formatCurrency(Number(value)),
                          name === 'expected_revenue' ? 'Expected' : 'Weighted',
                        ]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="expected_revenue"
                        stroke="var(--color-chart-1, #3b82f6)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Expected"
                      />
                      <Line
                        type="monotone"
                        dataKey="weighted_revenue"
                        stroke="var(--color-chart-2, #10b981)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        strokeDasharray="5 5"
                        name="Weighted"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                    No forecast data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Row 3: Lead Sources + Activity by Type ────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Lead Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {leadSources?.sources && leadSources.sources.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={leadSources.sources}
                        dataKey="count"
                        nameKey="source"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={false}
                      >
                        {leadSources.sources.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [Number(value), String(name)]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                    No lead source data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity by Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Activity by Type</CardTitle>
              </CardHeader>
              <CardContent>
                {activities?.by_type && activities.by_type.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={activities.by_type}
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="type"
                        className="text-xs"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" fill="var(--color-chart-2, #10b981)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                    No activity data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Row 4: Top Performers + Win/Loss Stats ────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                {topPerformers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Rank</th>
                          <th className="pb-2 pr-4 font-medium">Name</th>
                          <th className="pb-2 pr-4 font-medium text-right">Deals Won</th>
                          <th className="pb-2 font-medium text-right">Total Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topPerformers.map((performer, index) => (
                          <tr key={performer.user_id} className="border-b last:border-0">
                            <td className="py-2.5 pr-4 tabular-nums">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 font-medium">{performer.name}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">
                              {performer.won_deals}
                            </td>
                            <td className="py-2.5 text-right tabular-nums font-medium">
                              {formatCurrency(performer.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                    No performer data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Win/Loss Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Win/Loss Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {winLoss ? (
                  <div className="space-y-4">
                    {/* Win/Loss ratio bar */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-green-600">
                          Won: {winLoss.won} ({winLoss.win_rate.toFixed(1)}%)
                        </span>
                        <span className="font-medium text-red-600">
                          Lost: {winLoss.lost} ({(100 - winLoss.win_rate).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-l-full bg-green-500 transition-all"
                          style={{
                            width: `${winLoss.win_rate}%`,
                          }}
                        />
                        <div
                          className="h-full rounded-r-full bg-red-400 transition-all"
                          style={{
                            width: `${(100 - winLoss.win_rate)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                        <p className="text-xs text-muted-foreground">Total Won</p>
                        <p className="text-lg font-bold text-green-600 tabular-nums">
                          {winLoss.won}
                        </p>
                      </div>
                      <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
                        <p className="text-xs text-muted-foreground">Total Lost</p>
                        <p className="text-lg font-bold text-red-600 tabular-nums">
                          {winLoss.lost}
                        </p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                        <p className="text-lg font-bold text-green-600 tabular-nums">
                          {winLoss.win_rate.toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
                        <p className="text-xs text-muted-foreground">Total Closed</p>
                        <p className="text-lg font-bold text-muted-foreground tabular-nums">
                          {winLoss.total}
                        </p>
                      </div>
                    </div>

                    {/* Loss reasons */}
                    {winLoss.loss_reasons && winLoss.loss_reasons.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Top Loss Reasons
                        </p>
                        <div className="space-y-1.5">
                          {winLoss.loss_reasons.slice(0, 5).map((reason, idx) => (
                            <div key={reason.lost_reason_id ?? idx} className="flex items-center justify-between text-sm">
                              <span className="capitalize">Reason #{reason.lost_reason_id}</span>
                              <span className="tabular-nums text-muted-foreground">{reason.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                    No win/loss data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
