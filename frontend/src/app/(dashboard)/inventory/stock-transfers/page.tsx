'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { StatusBadge } from '@/components/shared/status-badge'

interface StockTransfer {
  id: string
  reference: string
  source_warehouse: string
  destination_warehouse: string
  total_items: number
  transferred_by: string
  transfer_date: string
  status: string
  notes: string
}

export default function StockTransfersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
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

  const fetchTransfers = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/inventory/stock-transfers', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<StockTransfer>(raw)
      setTransfers(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load stock transfers')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers])

  const columns: ServerColumnDef<StockTransfer>[] = [
    {
      id: 'reference',
      header: 'Reference',
      cell: (row) => <span className="font-medium">{row.reference}</span>,
    },
    {
      id: 'route',
      header: 'Route',
      enableSorting: false,
      cell: (row) => (
        <div className="flex items-center gap-2 text-sm">
          <span>{row.source_warehouse}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{row.destination_warehouse}</span>
        </div>
      ),
    },
    {
      id: 'total_items',
      header: 'Items',
      cell: (row) => (
        <span className="tabular-nums">{row.total_items?.toLocaleString()}</span>
      ),
    },
    {
      id: 'transferred_by',
      header: 'Transferred By',
      enableSorting: false,
      cell: (row) =>
        row.transferred_by || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'transfer_date',
      header: 'Date',
      cell: (row) =>
        row.transfer_date
          ? new Date(row.transfer_date).toLocaleDateString()
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
          { value: 'in_transit', label: 'In Transit' },
          { value: 'received', label: 'Received' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock Transfers"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Transfers' }]}
        createHref="/inventory/stock-transfers/new"
        createLabel="New Transfer"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Stock Transfers"
        columns={columns}
        data={transfers}
        pagination={pagination}
        loading={loading}
        editBasePath="/inventory/stock-transfers"
        deleteEndpoint="/inventory/stock-transfers"
        onDelete={fetchTransfers}
        emptyMessage="No stock transfers found"
        emptyDescription="Create your first stock transfer to get started."
        searchPlaceholder="Search transfers..."
        storageKey="inventory-stock-transfers"
      />
    </div>
  )
}
