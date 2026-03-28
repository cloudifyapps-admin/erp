'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, CheckCircle2, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface LeaveRequest {
  id: string
  employee_name: string
  employee_id: string
  department_name: string
  leave_type: string
  start_date: string
  end_date: string
  days: number
  reason: string
  status: string
  applied_on: string
}

export default function LeaveRequestsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
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

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/hr/leave-requests', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<LeaveRequest>(raw)
      setRequests(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load leave requests')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/hr/leave-requests/${id}/approve`)
      toast.success('Leave request approved')
      fetchRequests()
    } catch {
      toast.error('Failed to approve leave request')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await api.post(`/hr/leave-requests/${id}/reject`)
      toast.success('Leave request rejected')
      fetchRequests()
    } catch {
      toast.error('Failed to reject leave request')
    }
  }

  const columns: ServerColumnDef<LeaveRequest>[] = [
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
      id: 'leave_type',
      header: 'Leave Type',
      cell: (row) => (
        <span className="capitalize">{row.leave_type?.replace(/_/g, ' ')}</span>
      ),
    },
    {
      id: 'start_date',
      header: 'Dates',
      cell: (row) => (
        <span className="text-sm">
          {new Date(row.start_date).toLocaleDateString()} – {new Date(row.end_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'days',
      header: 'Days',
      cell: (row) => <span className="tabular-nums">{row.days}</span>,
    },
    {
      id: 'reason',
      header: 'Reason',
      enableSorting: false,
      cell: (row) => (
        <span className="text-muted-foreground truncate max-w-[200px] inline-block">
          {row.reason || '—'}
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
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Leave Requests"
        breadcrumbs={[{ label: 'HR' }, { label: 'Leave Requests' }]}
        createHref="/hr/leave-requests/new"
        createLabel="New Request"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Leave Requests"
        columns={columns}
        data={requests}
        pagination={pagination}
        loading={loading}
        editBasePath="/hr/leave-requests"
        onDelete={fetchRequests}
        emptyMessage="No leave requests found"
        emptyDescription="Leave requests will appear here."
        searchPlaceholder="Search leave requests..."
        storageKey="hr-leave-requests"
        additionalActions={(row) =>
          row.status === 'pending' ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleApprove(row.id)}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleReject(row.id)}>
                <XCircle className="mr-2 h-4 w-4 text-destructive" /> Reject
              </DropdownMenuItem>
            </>
          ) : undefined
        }
      />
    </div>
  )
}
