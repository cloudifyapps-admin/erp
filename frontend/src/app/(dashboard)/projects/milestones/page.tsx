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
import { StatusBadge } from '@/components/shared/status-badge'

interface Milestone {
  id: string
  title: string
  due_date: string
  status: string
  progress: number
}

export default function MilestonesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [milestones, setMilestones] = useState<Milestone[]>([])
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

      const allMilestones: Milestone[] = []
      for (const proj of projects) {
        try {
          const { data: msRaw } = await api.get(`/projects/${proj.id}/milestones`, {
            params: { page_size: 100 },
          })
          allMilestones.push(...normalizePaginated<Milestone>(msRaw).items)
        } catch { /* skip */ }
      }

      setMilestones(allMilestones)
      setPagination({
        page: 1,
        per_page: 25,
        total: allMilestones.length,
        pages: Math.ceil(allMilestones.length / 25),
      })
    } catch {
      toast.error('Failed to load milestones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const columns: ServerColumnDef<Milestone>[] = [
    {
      id: 'title',
      header: 'Milestone',
      cell: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: (row) =>
        row.due_date
          ? new Date(row.due_date).toLocaleDateString()
          : '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: 'progress',
      header: 'Progress',
      cell: (row) => (
        <div className="flex items-center gap-2 min-w-[100px]">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, row.progress ?? 0)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
            {row.progress ?? 0}%
          </span>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Milestones"
        breadcrumbs={[{ label: 'Projects' }, { label: 'Milestones' }]}
      />
      <AdvancedDataTable
        title="Milestones"
        columns={columns}
        data={milestones}
        pagination={pagination}
        loading={loading}
        emptyMessage="No milestones found"
        emptyDescription="Milestones will appear here once projects have milestones."
        searchPlaceholder="Search milestones..."
        storageKey="projects-milestones"
      />
    </div>
  )
}
