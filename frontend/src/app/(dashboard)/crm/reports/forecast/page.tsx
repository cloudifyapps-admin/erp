'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ForecastMonth {
  month: string
  expected_revenue: number
  weighted_revenue: number
}

interface SalesForecast {
  forecast: ForecastMonth[]
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function ForecastReportPage() {
  const [data, setData] = useState<SalesForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(6)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/analytics/sales-forecast', {
        params: { months },
      })
      setData(raw)
    } catch {
      toast.error('Failed to load forecast report')
    } finally {
      setLoading(false)
    }
  }, [months])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const forecastRows = data?.forecast ?? []

  const chartData = forecastRows.map((m) => ({
    name: m.month,
    expected: m.expected_revenue,
    weighted: m.weighted_revenue,
  }))

  const totalExpected = forecastRows.reduce((sum, m) => sum + m.expected_revenue, 0)
  const totalWeighted = forecastRows.reduce((sum, m) => sum + m.weighted_revenue, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales Forecast"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Reports', href: '/crm/reports' },
          { label: 'Sales Forecast' },
        ]}
      />

      {/* Months Filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Forecast Period (months)</label>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="h-9 rounded-lg border bg-background px-3 text-sm ring-1 ring-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={9}>9 months</option>
            <option value={12}>12 months</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-7 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Total Expected</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(totalExpected)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Total Weighted</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(totalWeighted)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Months Covered</p>
              <p className="mt-1 text-xl font-bold">{forecastRows.length}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    name === 'expected' ? 'Expected Revenue' : 'Weighted Revenue',
                  ]}
                />
                <Legend
                  formatter={(value: string) =>
                    value === 'expected' ? 'Expected Revenue' : 'Weighted Revenue'
                  }
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  name="expected"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="weighted"
                  name="weighted"
                  stroke="#93c5fd"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No forecast data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
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
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Month</th>
                    <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Expected Revenue</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Weighted Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastRows.map((m) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="py-2.5 pr-4">{m.month}</td>
                      <td className="py-2.5 pr-4 text-right">{formatCurrency(m.expected_revenue)}</td>
                      <td className="py-2.5 text-right">{formatCurrency(m.weighted_revenue)}</td>
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
