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

interface PurchaseRequest {
  id: string
  number: string
  title: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: string
  requested_by: string
  department: string
  required_by: string
  created_at: string
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

export default function PurchaseRequestsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
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
  const priority = searchParams.get('priority') ?? ''
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/purchase/purchase-requests', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(priority && { priority }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<PurchaseRequest>(raw)
      setRequests(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load purchase requests')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, priority, sortBy, sortDirection])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const columns: ServerColumnDef<PurchaseRequest>[] = [
    {
      id: 'number',
      header: 'PR Number',
    },
    {
      id: 'title',
      header: 'Title',
    },
    {
      id: 'priority',
      header: 'Priority',
      enableSorting: false,
      cell: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[row.priority] ?? ''}`}
        >
          {row.priority}
        </span>
      ),
      meta: {
        filterType: 'select',
        filterKey: 'priority',
        filterPlaceholder: 'All Priorities',
        filterOptions: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' },
        ],
      },
    },
    {
      id: 'requested_by',
      header: 'Requested By',
      enableSorting: false,
    },
    {
      id: 'department',
      header: 'Department',
      enableSorting: false,
    },
    {
      id: 'required_by',
      header: 'Required By',
      cell: (row) =>
        row.required_by
          ? new Date(row.required_by).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
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
          { value: 'draft', label: 'Draft' },
          { value: 'pending_approval', label: 'Pending Approval' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'ordered', label: 'Ordered' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Purchase Requests"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Purchase Requests' }]}
        createHref="/purchase/purchase-requests/new"
        createLabel="New Request"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Purchase Requests"
        columns={columns}
        data={requests}
        pagination={pagination}
        loading={loading}
        editBasePath="/purchase/purchase-requests"
        deleteEndpoint="/purchase/purchase-requests"
        onDelete={fetchRequests}
        emptyMessage="No purchase requests found"
        emptyDescription="Create your first purchase request to get started."
        searchPlaceholder="Search purchase requests..."
        storageKey="purchase-requests"
      />
    </div>
  )
}
