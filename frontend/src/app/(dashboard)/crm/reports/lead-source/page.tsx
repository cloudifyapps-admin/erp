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

interface LeadSource {
  source: string
  count: number
  converted: number
  conversion_rate: number
}

interface LeadSourceAnalysis {
  sources: LeadSource[]
}


export default function LeadSourceReportPage() {
  const [data, setData] = useState<LeadSourceAnalysis | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/analytics/lead-source-analysis')
      setData(raw)
    } catch {
      toast.error('Failed to load lead source report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const sources = data?.sources ?? []

  const totalSources = sources.length

  const bestSource = sources.reduce<LeadSource | null>(
    (best, s) => (best === null || s.conversion_rate > best.conversion_rate ? s : best),
    null,
  )

  const avgConversionRate =
    sources.length > 0
      ? sources.reduce((sum, s) => sum + s.conversion_rate, 0) / sources.length
      : 0

  const chartData = sources.map((s) => ({
    name: s.source.replace(/_/g, ' '),
    value: s.count,
  })) ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lead Source Analysis"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Reports', href: '/crm/reports' },
          { label: 'Lead Source Analysis' },
        ]}
      />

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
              <p className="text-xs font-medium text-muted-foreground">Total Sources</p>
              <p className="mt-1 text-xl font-bold">{totalSources}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Best Converting Source</p>
              <p className="mt-1 text-xl font-bold capitalize">
                {bestSource ? bestSource.source.replace(/_/g, ' ') : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Avg Conversion Rate</p>
              <p className="mt-1 text-xl font-bold">{avgConversionRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Source Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <Tooltip
                  formatter={(value) => [Number(value).toLocaleString(), 'Leads']}
                />
                <Bar dataKey="value" name="Leads" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No lead source data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle>Source Breakdown</CardTitle>
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
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Source</th>
                    <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Count</th>
                    <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Converted</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.sources?.map((source) => (
                    <tr key={source.source} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 capitalize">{source.source.replace(/_/g, ' ')}</td>
                      <td className="py-2.5 pr-4 text-right">{source.count.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right">{source.converted.toLocaleString()}</td>
                      <td className="py-2.5 text-right">{source.conversion_rate.toFixed(1)}%</td>
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
