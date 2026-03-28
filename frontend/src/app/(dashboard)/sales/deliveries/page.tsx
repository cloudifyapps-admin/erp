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

interface Delivery {
  id: string
  number: string
  sales_order_number?: string
  customer_name?: string
  status: string
  scheduled_date?: string
  delivered_date?: string
  carrier?: string
  tracking_number?: string
  created_at: string
}

interface PaginatedResponse {
  items: Delivery[]
  count: number
  page: number
  per_page: number
  pages: number
}

export default function DeliveriesPage() {
  const searchParams = useSearchParams()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
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

  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/sales/deliveries', {
        params: {
          page,
          per_page: 25,
          ...(search && { search }),
          ...(status && { status }),
        },
      })
      const normalized = normalizePaginated<Delivery>(raw)
      setDeliveries(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        total_pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load deliveries')
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    fetchDeliveries()
  }, [fetchDeliveries])

  const columns: ColumnDef<Delivery>[] = [
    {
      key: 'number',
      header: 'Delivery No.',
      cell: (row) => (
        <span className="font-mono text-sm font-medium">{row.number}</span>
      ),
    },
    {
      key: 'sales_order_number',
      header: 'Sales Order',
      cell: (row) =>
        row.sales_order_number ? (
          <span className="font-mono text-xs">{row.sales_order_number}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
      key: 'scheduled_date',
      header: 'Scheduled',
      cell: (row) =>
        row.scheduled_date ? (
          <span
            className={
              !row.delivered_date && new Date(row.scheduled_date) < new Date()
                ? 'text-orange-600'
                : ''
            }
          >
            {new Date(row.scheduled_date).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'delivered_date',
      header: 'Delivered',
      cell: (row) =>
        row.delivered_date
          ? new Date(row.delivered_date).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'carrier',
      header: 'Carrier',
      cell: (row) => row.carrier || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'tracking_number',
      header: 'Tracking',
      cell: (row) =>
        row.tracking_number ? (
          <span className="font-mono text-xs">{row.tracking_number}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Deliveries"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Deliveries' }]}
        createHref="/sales/deliveries/new"
        createLabel="New Delivery"
        createIcon={Plus}
      />
      <FilterBar
        searchPlaceholder="Search deliveries..."
        filters={[
          {
            key: 'status',
            placeholder: 'All Statuses',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'shipped', label: 'Shipped' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={deliveries}
        pagination={pagination}
        loading={loading}
        editBasePath="/sales/deliveries"
        deleteEndpoint="/sales/deliveries"
        onDelete={fetchDeliveries}
        emptyMessage="No deliveries found"
        emptyDescription="Deliveries are created from confirmed sales orders."
      />
    </div>
  )
}
