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

interface GoodsReceipt {
  id: string
  number: string
  po_number: string
  vendor_name: string
  received_by: string
  received_date: string
  warehouse: string
  status: string
}

export default function GoodsReceiptsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([])
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

  const fetchReceipts = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/purchase/goods-receipts', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<GoodsReceipt>(raw)
      setReceipts(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load goods receipts')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchReceipts()
  }, [fetchReceipts])

  const columns: ServerColumnDef<GoodsReceipt>[] = [
    {
      id: 'number',
      header: 'GR Number',
    },
    {
      id: 'po_number',
      header: 'PO Number',
    },
    {
      id: 'vendor_name',
      header: 'Vendor',
    },
    {
      id: 'warehouse',
      header: 'Warehouse',
    },
    {
      id: 'received_by',
      header: 'Received By',
      enableSorting: false,
    },
    {
      id: 'received_date',
      header: 'Received Date',
      cell: (row) =>
        row.received_date
          ? new Date(row.received_date).toLocaleDateString()
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
          { value: 'received', label: 'Received' },
          { value: 'partial', label: 'Partial' },
          { value: 'closed', label: 'Closed' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Goods Receipts"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Goods Receipts' }]}
        createHref="/purchase/goods-receipts/new"
        createLabel="New Receipt"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Goods Receipts"
        columns={columns}
        data={receipts}
        pagination={pagination}
        loading={loading}
        editBasePath="/purchase/goods-receipts"
        deleteEndpoint="/purchase/goods-receipts"
        onDelete={fetchReceipts}
        emptyMessage="No goods receipts found"
        emptyDescription="Create your first goods receipt to get started."
        searchPlaceholder="Search goods receipts..."
        storageKey="purchase-goods-receipts"
      />
    </div>
  )
}
