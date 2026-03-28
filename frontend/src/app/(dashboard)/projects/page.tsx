'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { StatusBadge } from '@/components/shared/status-badge'

interface Project {
  id: string
  name: string
  code: string
  status: string
  progress: number
  manager_name: string
  client_name: string
  start_date: string
  end_date: string
}

export default function ProjectsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    pages: 1,
  })

  const page = Number(searchParams.get('page') ?? 1)
  const perPage = Number(searchParams.get('per_page') ?? 25)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/projects', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Project>(raw)
      setProjects(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const columns: ServerColumnDef<Project>[] = [
    {
      id: 'name',
      header: 'Project',
      cell: (row) => (
        <div>
          <span className="font-medium">{row.name}</span>
          <span className="block text-xs text-muted-foreground">{row.code}</span>
        </div>
      ),
    },
    {
      id: 'client_name',
      header: 'Client',
      cell: (row) =>
        row.client_name || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'manager_name',
      header: 'Manager',
      enableSorting: false,
      cell: (row) =>
        row.manager_name || <span className="text-muted-foreground">—</span>,
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
    {
      id: 'start_date',
      header: 'Start',
      cell: (row) =>
        row.start_date
          ? new Date(row.start_date).toLocaleDateString()
          : '—',
    },
    {
      id: 'end_date',
      header: 'Due',
      cell: (row) =>
        row.end_date
          ? new Date(row.end_date).toLocaleDateString()
          : '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
      meta: {
        filterType: 'select',
        filterKey: 'status',
        filterPlaceholder: 'All Statuses',
        filterOptions: [
          { value: 'planning', label: 'Planning' },
          { value: 'active', label: 'Active' },
          { value: 'on_hold', label: 'On Hold' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Projects"
        breadcrumbs={[{ label: 'Projects' }]}
        createHref="/projects/new"
        createLabel="New Project"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Projects"
        columns={columns}
        data={projects}
        pagination={pagination}
        loading={loading}
        editBasePath="/projects"
        deleteEndpoint="/projects"
        onDelete={fetchData}
        emptyMessage="No projects found"
        emptyDescription="Create your first project to get started."
        searchPlaceholder="Search projects..."
        storageKey="projects"
      />
    </div>
  )
}
