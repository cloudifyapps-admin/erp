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

interface PurchaseOrder {
  id: string
  number: string
  vendor_name: string
  total_amount: number
  currency: string
  status: string
  order_date: string
  expected_delivery: string
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
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

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/purchase/purchase-orders', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<PurchaseOrder>(raw)
      setOrders(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const columns: ServerColumnDef<PurchaseOrder>[] = [
    {
      id: 'number',
      header: 'PO Number',
      cell: (row) => (
        <span className="font-mono font-bold">{row.number}</span>
      ),
    },
    {
      id: 'vendor_name',
      header: 'Vendor',
    },
    {
      id: 'order_date',
      header: 'Order Date',
      cell: (row) =>
        row.order_date
          ? new Date(row.order_date).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'expected_delivery',
      header: 'Expected Delivery',
      cell: (row) =>
        row.expected_delivery
          ? new Date(row.expected_delivery).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'total_amount',
      header: 'Total Amount',
      cell: (row) => (
        <span className="tabular-nums font-medium">
          {row.currency} {Number(row.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          { value: 'draft', label: 'Draft' },
          { value: 'sent', label: 'Sent' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'received', label: 'Received' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Purchase Orders"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Purchase Orders' }]}
        createHref="/purchase/purchase-orders/new"
        createLabel="New PO"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Purchase Orders"
        columns={columns}
        data={orders}
        pagination={pagination}
        loading={loading}
        editBasePath="/purchase/purchase-orders"
        deleteEndpoint="/purchase/purchase-orders"
        onDelete={fetchOrders}
        emptyMessage="No purchase orders found"
        emptyDescription="Create your first purchase order to get started."
        searchPlaceholder="Search purchase orders..."
        storageKey="purchase-orders"
      />
    </div>
  )
}
