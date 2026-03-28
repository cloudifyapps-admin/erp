'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'

interface TimeLog {
  id: string
  description: string
  task_id: string
  start_time: string
  end_time: string
  duration_minutes: number
  user_name: string
}

export default function TimeLogsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    pages: 1,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: projRaw } = await api.get('/projects', { params: { page_size: 100 } })
      const projects = normalizePaginated<{ id: string }>(projRaw).items

      const allLogs: TimeLog[] = []
      for (const proj of projects) {
        try {
          const { data: logRaw } = await api.get(`/projects/${proj.id}/time-logs`, {
            params: { page_size: 100 },
          })
          allLogs.push(...normalizePaginated<TimeLog>(logRaw).items)
        } catch { /* skip */ }
      }

      setLogs(allLogs)
      setPagination({
        page: 1,
        per_page: 25,
        total: allLogs.length,
        pages: Math.ceil(allLogs.length / 25),
      })
    } catch {
      toast.error('Failed to load time logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const columns: ServerColumnDef<TimeLog>[] = [
    {
      id: 'description',
      header: 'Description',
      cell: (row) =>
        row.description || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'user_name',
      header: 'User',
      cell: (row) =>
        row.user_name || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'start_time',
      header: 'Start',
      cell: (row) =>
        row.start_time
          ? new Date(row.start_time).toLocaleString()
          : '—',
    },
    {
      id: 'end_time',
      header: 'End',
      cell: (row) =>
        row.end_time
          ? new Date(row.end_time).toLocaleString()
          : '—',
    },
    {
      id: 'duration_minutes',
      header: 'Duration',
      cell: (row) => {
        const hrs = Math.floor((row.duration_minutes ?? 0) / 60)
        const mins = (row.duration_minutes ?? 0) % 60
        return <span className="tabular-nums">{hrs}h {mins}m</span>
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Time Logs"
        breadcrumbs={[{ label: 'Projects' }, { label: 'Time Logs' }]}
      />
      <AdvancedDataTable
        title="Time Logs"
        columns={columns}
        data={logs}
        pagination={pagination}
        loading={loading}
        emptyMessage="No time logs found"
        emptyDescription="Time logs will appear here once tracked."
        searchPlaceholder="Search time logs..."
        storageKey="projects-time-logs"
      />
    </div>
  )
}
