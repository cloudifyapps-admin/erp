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

interface Employee {
  id: string
  employee_id: string
  full_name: string
  email: string
  department_name: string
  designation: string
  employment_type: string
  date_of_joining: string
  status: string
}

export default function EmployeesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [employees, setEmployees] = useState<Employee[]>([])
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

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/hr/employees', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Employee>(raw)
      setEmployees(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const columns: ServerColumnDef<Employee>[] = [
    {
      id: 'employee_id',
      header: 'Employee ID',
      cell: (row) => <span className="font-mono text-xs">{row.employee_id}</span>,
    },
    {
      id: 'full_name',
      header: 'Name',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.full_name}</div>
          <div className="text-xs text-muted-foreground">{row.email}</div>
        </div>
      ),
    },
    {
      id: 'department_name',
      header: 'Department',
      cell: (row) =>
        row.department_name || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'designation',
      header: 'Designation',
      cell: (row) =>
        row.designation || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'employment_type',
      header: 'Type',
      cell: (row) => (
        <span className="capitalize">
          {row.employment_type?.replace(/_/g, ' ') ?? '—'}
        </span>
      ),
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
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'on_leave', label: 'On Leave' },
          { value: 'terminated', label: 'Terminated' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Employees"
        breadcrumbs={[{ label: 'HR' }, { label: 'Employees' }]}
        createHref="/hr/employees/new"
        createLabel="New Employee"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Employees"
        columns={columns}
        data={employees}
        pagination={pagination}
        loading={loading}
        editBasePath="/hr/employees"
        deleteEndpoint="/hr/employees"
        onDelete={fetchEmployees}
        emptyMessage="No employees found"
        emptyDescription="Create your first employee to get started."
        searchPlaceholder="Search employees..."
        storageKey="hr-employees"
      />
    </div>
  )
}
