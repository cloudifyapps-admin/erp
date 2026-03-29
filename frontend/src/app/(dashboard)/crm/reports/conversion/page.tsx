'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatusCount {
  status: string
  count: number
}

interface ConversionFunnel {
  by_status: Record<string, number>
  total_leads: number
  conversion_rate: number
  qualification_rate: number
}

export default function ConversionFunnelPage() {
  const [data, setData] = useState<ConversionFunnel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: raw } = await api.get('/crm/analytics/conversion-funnel')
        setData(raw)
      } catch {
        toast.error('Failed to load conversion funnel')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const statuses: StatusCount[] = data?.by_status
    ? Object.entries(data.by_status).map(([status, count]) => ({ status, count }))
    : []

  const maxCount = statuses.reduce((max, s) => Math.max(max, s.count), 0) || 1

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conversion Funnel"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Reports', href: '/crm/reports' },
          { label: 'Conversion Funnel' },
        ]}
      />

      {/* Key Metrics */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-7 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Total Leads</p>
              <p className="mt-1 text-xl font-bold">{data.total_leads}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Conversion Rate</p>
              <p className="mt-1 text-xl font-bold text-green-600">
                {data.conversion_rate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">Qualification Rate</p>
              <p className="mt-1 text-xl font-bold text-blue-600">
                {data.qualification_rate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : statuses.length > 0 ? (
            <div className="space-y-3">
              {statuses.map((s) => {
                const pct = maxCount > 0 ? (s.count / maxCount) * 100 : 0
                const totalPct = data && data.total_leads > 0 ? (s.count / data.total_leads) * 100 : 0
                return (
                  <div key={s.status} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-right text-sm font-medium capitalize">
                      {s.status.replace(/_/g, ' ')}
                    </span>
                    <div className="relative flex h-9 flex-1 items-center overflow-hidden rounded-md bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md bg-primary/80 transition-all"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                      <span className="relative z-10 px-3 text-xs font-semibold">
                        {s.count} ({totalPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No funnel data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leads by Status</CardTitle>
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
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Count</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((s) => (
                    <tr key={s.status} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 capitalize">{s.status.replace(/_/g, ' ')}</td>
                      <td className="py-2.5 pr-4 text-right">{s.count}</td>
                      <td className="py-2.5 text-right">
                        {data && data.total_leads > 0
                          ? ((s.count / data.total_leads) * 100).toFixed(1)
                          : '0.0'}
                        %
                      </td>
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
