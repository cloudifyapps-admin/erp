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

interface StockAdjustment {
  id: string
  reference: string
  warehouse_name: string
  reason: string
  adjusted_by: string
  total_items: number
  status: string
  notes: string
  created_at: string
}

export default function StockAdjustmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
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

  const fetchAdjustments = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/inventory/stock-adjustments', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<StockAdjustment>(raw)
      setAdjustments(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load stock adjustments')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchAdjustments()
  }, [fetchAdjustments])

  const columns: ServerColumnDef<StockAdjustment>[] = [
    {
      id: 'reference',
      header: 'Reference',
      cell: (row) => <span className="font-medium">{row.reference}</span>,
    },
    {
      id: 'warehouse_name',
      header: 'Warehouse',
    },
    {
      id: 'reason',
      header: 'Reason',
    },
    {
      id: 'total_items',
      header: 'Items',
      cell: (row) => (
        <span className="tabular-nums">{row.total_items?.toLocaleString()}</span>
      ),
    },
    {
      id: 'adjusted_by',
      header: 'Adjusted By',
      enableSorting: false,
      cell: (row) =>
        row.adjusted_by || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'created_at',
      header: 'Date',
      cell: (row) =>
        row.created_at
          ? new Date(row.created_at).toLocaleDateString()
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
          { value: 'posted', label: 'Posted' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock Adjustments"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Adjustments' }]}
        createHref="/inventory/stock-adjustments/new"
        createLabel="New Adjustment"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Stock Adjustments"
        columns={columns}
        data={adjustments}
        pagination={pagination}
        loading={loading}
        editBasePath="/inventory/stock-adjustments"
        deleteEndpoint="/inventory/stock-adjustments"
        onDelete={fetchAdjustments}
        emptyMessage="No stock adjustments found"
        emptyDescription="Create your first stock adjustment to get started."
        searchPlaceholder="Search adjustments..."
        storageKey="inventory-stock-adjustments"
      />
    </div>
  )
}
