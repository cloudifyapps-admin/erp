'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ActivityByType {
  type: string
  count: number
}

interface ActivityByUser {
  user_id: number
  count: number
}

interface ActivityMetrics {
  total: number
  overdue: number
  by_type: ActivityByType[]
  by_user: ActivityByUser[]
}

export default function ActivityReportPage() {
  const [data, setData] = useState<ActivityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/analytics/activity-metrics', {
        params: {
          ...(dateFrom && { date_from: dateFrom }),
          ...(dateTo && { date_to: dateTo }),
        },
      })
      setData(raw)
    } catch {
      toast.error('Failed to load activity report')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const chartData = data?.by_type?.map((t) => ({
    name: t.type.replace(/_/g, ' '),
    count: t.count,
  })) ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activity Report"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Reports', href: '/crm/reports' },
          { label: 'Activity Report' },
        ]}
      />

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm ring-1 ring-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm ring-1 ring-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-7 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Total Activities</p>
              <p className="mt-1 text-xl font-bold">{data.total.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Overdue</p>
              <p className="mt-1 text-xl font-bold text-destructive">{data.overdue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Activities by Type</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  className="capitalize"
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [Number(value).toLocaleString(), 'Count']}
                />
                <Bar dataKey="count" name="Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No activity data available.</p>
          )}
        </CardContent>
      </Card>

      {/* User Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity by User</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">User ID</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.by_user?.map((row) => (
                    <tr key={row.user_id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4">{row.user_id}</td>
                      <td className="py-2.5 text-right">{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
