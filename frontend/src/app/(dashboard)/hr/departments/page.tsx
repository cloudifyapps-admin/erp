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

interface Department {
  id: string
  name: string
  code: string
  head_name: string
  parent_name: string
  employee_count: number
  status: string
}

export default function DepartmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [departments, setDepartments] = useState<Department[]>([])
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
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  const fetchDepartments = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/hr/departments', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Department>(raw)
      setDepartments(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load departments')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, sortBy, sortDirection])

  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  const columns: ServerColumnDef<Department>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (row) => <span className="font-mono text-xs">{row.code}</span>,
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: 'parent_name',
      header: 'Parent',
      enableSorting: false,
      cell: (row) =>
        row.parent_name || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'head_name',
      header: 'Head',
      enableSorting: false,
      cell: (row) =>
        row.head_name || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'employee_count',
      header: 'Employees',
      cell: (row) => (
        <span className="tabular-nums">{row.employee_count?.toLocaleString()}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Departments"
        breadcrumbs={[{ label: 'HR' }, { label: 'Departments' }]}
        createHref="/hr/departments/new"
        createLabel="New Department"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Departments"
        columns={columns}
        data={departments}
        pagination={pagination}
        loading={loading}
        editBasePath="/hr/departments"
        deleteEndpoint="/hr/departments"
        onDelete={fetchDepartments}
        emptyMessage="No departments found"
        emptyDescription="Create your first department to get started."
        searchPlaceholder="Search departments..."
        storageKey="hr-departments"
      />
    </div>
  )
}
