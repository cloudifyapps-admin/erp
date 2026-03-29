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

interface PipelineStage {
  stage: string
  count: number
  value: number
}

interface PipelineSummary {
  by_stage: PipelineStage[]
  total_pipeline: number
  weighted_pipeline: number
  avg_deal_size: number
  open_deals: number
  won_count: number
  won_value: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function PipelineReportPage() {
  const [data, setData] = useState<PipelineSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/analytics/pipeline-summary', {
        params: {
          ...(dateFrom && { date_from: dateFrom }),
          ...(dateTo && { date_to: dateTo }),
        },
      })
      setData(raw)
    } catch {
      toast.error('Failed to load pipeline report')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const chartData = data?.by_stage?.map((s) => ({
    name: s.stage.replace(/_/g, ' '),
    value: s.value,
    count: s.count,
  })) ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pipeline Report"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Reports', href: '/crm/reports' },
          { label: 'Pipeline Report' },
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

      {/* Summary Stats */}
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
              <p className="text-xs font-medium text-muted-foreground">Total Pipeline</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(data.total_pipeline)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{data.open_deals} opportunities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Weighted Value</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(data.weighted_pipeline)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Avg Deal Size</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(data.avg_deal_size)}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline by Stage</CardTitle>
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
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    name === 'value' ? 'Total Value' : 'Weighted Value',
                  ]}
                />
                <Bar dataKey="value" name="Total Value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="count" name="Deals" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No pipeline data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stage Breakdown</CardTitle>
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
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Stage</th>
                    <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Deals</th>
                    <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Total Value</th>
                    <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Weighted</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Avg Deal Size</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.by_stage?.map((stage) => (
                    <tr key={stage.stage} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 capitalize">{stage.stage.replace(/_/g, ' ')}</td>
                      <td className="py-2.5 pr-4 text-right">{stage.count}</td>
                      <td className="py-2.5 pr-4 text-right">{formatCurrency(stage.value)}</td>
                      <td className="py-2.5 pr-4 text-right">{formatCurrency(stage.count > 0 ? stage.value * 0.5 : 0)}</td>
                      <td className="py-2.5 text-right">{formatCurrency(stage.count > 0 ? stage.value / stage.count : 0)}</td>
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
