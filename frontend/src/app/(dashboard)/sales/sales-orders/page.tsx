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

interface SalesOrder {
  id: string
  number: string
  customer_name?: string
  status: string
  subtotal: number
  total: number
  currency: string
  order_date: string
  delivery_date?: string
  created_at: string
}

export default function SalesOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<SalesOrder[]>([])
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
      const { data: raw } = await api.get('/sales/sales-orders', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<SalesOrder>(raw)
      setOrders(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load sales orders')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const columns: ServerColumnDef<SalesOrder>[] = [
    {
      id: 'number',
      header: 'Order No.',
      cell: (row) => (
        <span className="font-bold font-mono">{row.number}</span>
      ),
    },
    {
      id: 'customer_name',
      header: 'Customer',
      cell: (row) =>
        row.customer_name || <span className="text-muted-foreground">—</span>,
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
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'processing', label: 'Processing' },
          { value: 'shipped', label: 'Shipped' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
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
      id: 'delivery_date',
      header: 'Delivery Date',
      cell: (row) =>
        row.delivery_date
          ? new Date(row.delivery_date).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'total',
      header: 'Total',
      cell: (row) => (
        <span className="tabular-nums font-semibold">
          {Number(row.total ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}{' '}
          {row.currency}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sales Orders"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Sales Orders' }]}
        createHref="/sales/sales-orders/new"
        createLabel="New Order"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Sales Orders"
        columns={columns}
        data={orders}
        pagination={pagination}
        loading={loading}
        editBasePath="/sales/sales-orders"
        deleteEndpoint="/sales/sales-orders"
        onDelete={fetchOrders}
        emptyMessage="No sales orders found"
        emptyDescription="Create your first sales order to get started."
        searchPlaceholder="Search sales orders..."
        storageKey="sales-orders"
      />
    </div>
  )
}
