'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type ColumnDef } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { FilterBar } from '@/components/shared/filter-bar'

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

interface PaginatedResponse {
  items: SalesOrder[]
  count: number
  page: number
  per_page: number
  pages: number
}

export default function SalesOrdersPage() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    total_pages: 1,
  })

  const page = Number(searchParams.get('page') ?? 1)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/sales/sales-orders', {
        params: {
          page,
          per_page: 25,
          ...(search && { search }),
          ...(status && { status }),
        },
      })
      const normalized = normalizePaginated<SalesOrder>(raw)
      setOrders(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        total_pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load sales orders')
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const columns: ColumnDef<SalesOrder>[] = [
    {
      key: 'number',
      header: 'Order No.',
      cell: (row) => (
        <span className="font-mono text-sm font-medium">{row.number}</span>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      cell: (row) =>
        row.customer_name || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'order_date',
      header: 'Order Date',
      cell: (row) =>
        row.order_date
          ? new Date(row.order_date).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'delivery_date',
      header: 'Delivery Date',
      cell: (row) =>
        row.delivery_date
          ? new Date(row.delivery_date).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'total',
      header: 'Total',
      cell: (row) => (
        <span className="tabular-nums font-semibold">
          {row.currency || 'USD'}{' '}
          {Number(row.total ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Sales Orders"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Sales Orders' }]}
        createHref="/sales/sales-orders/new"
        createLabel="New Order"
        createIcon={Plus}
      />
      <FilterBar
        searchPlaceholder="Search sales orders..."
        filters={[
          {
            key: 'status',
            placeholder: 'All Statuses',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'processing', label: 'Processing' },
              { value: 'shipped', label: 'Shipped' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={orders}
        pagination={pagination}
        loading={loading}
        editBasePath="/sales/sales-orders"
        deleteEndpoint="/sales/sales-orders"
        onDelete={fetchOrders}
        emptyMessage="No sales orders found"
        emptyDescription="Convert a quotation or create a new sales order."
      />
    </div>
  )
}
