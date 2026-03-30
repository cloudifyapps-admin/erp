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

interface AttendanceRecord {
  id: string
  employee_id: string
  employee_name: string
  department_name: string
  date: string
  check_in: string
  check_out: string
  working_hours: number
  status: string
}

export default function AttendancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
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

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/hr/attendance', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<AttendanceRecord>(raw)
      setRecords(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load attendance records')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const columns: ServerColumnDef<AttendanceRecord>[] = [
    {
      id: 'employee_id',
      header: 'ID',
      cell: (row) => <span className="font-mono text-xs">{row.employee_id}</span>,
    },
    {
      id: 'employee_name',
      header: 'Employee',
      enableSorting: false,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.employee_name}</div>
          <div className="text-xs text-muted-foreground">{row.department_name}</div>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      cell: (row) => new Date(row.date).toLocaleDateString(),
    },
    {
      id: 'check_in',
      header: 'Check In',
      cell: (row) =>
        row.check_in
          ? row.check_in.substring(0, 5)
          : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'check_out',
      header: 'Check Out',
      cell: (row) =>
        row.check_out
          ? row.check_out.substring(0, 5)
          : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'working_hours',
      header: 'Hours',
      cell: (row) => (
        <span className="tabular-nums">
          {row.working_hours != null ? `${row.working_hours}h` : '—'}
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
          { value: 'present', label: 'Present' },
          { value: 'absent', label: 'Absent' },
          { value: 'late', label: 'Late' },
          { value: 'half_day', label: 'Half Day' },
          { value: 'on_leave', label: 'On Leave' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attendance"
        breadcrumbs={[{ label: 'HR' }, { label: 'Attendance' }]}
      />
      <AdvancedDataTable
        title="Attendance"
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        emptyMessage="No attendance records found"
        emptyDescription="Attendance records will appear here once logged."
        searchPlaceholder="Search attendance..."
        storageKey="hr-attendance"
      />
    </div>
  )
}
