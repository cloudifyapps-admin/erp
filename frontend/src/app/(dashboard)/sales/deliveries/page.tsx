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

export default function DeliveriesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
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

  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/sales/deliveries', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Delivery>(raw)
      setDeliveries(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load deliveries')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchDeliveries()
  }, [fetchDeliveries])

  const columns: ServerColumnDef<Delivery>[] = [
    {
      id: 'number',
      header: 'Delivery No.',
      cell: (row) => (
        <span className="font-bold font-mono">{row.number}</span>
      ),
    },
    {
      id: 'sales_order_number',
      header: 'Sales Order',
      enableSorting: false,
      cell: (row) =>
        row.sales_order_number ? (
          <span className="font-mono text-xs">{row.sales_order_number}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
          { value: 'pending', label: 'Pending' },
          { value: 'processing', label: 'Processing' },
          { value: 'shipped', label: 'Shipped' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
    {
      id: 'scheduled_date',
      header: 'Scheduled Date',
      cell: (row) => {
        if (!row.scheduled_date) return <span className="text-muted-foreground">—</span>
        const isOverdue =
          new Date(row.scheduled_date) < new Date() && row.status !== 'delivered'
        return (
          <span className={isOverdue ? 'text-orange-600' : ''}>
            {new Date(row.scheduled_date).toLocaleDateString()}
          </span>
        )
      },
    },
    {
      id: 'delivered_date',
      header: 'Delivered Date',
      cell: (row) =>
        row.delivered_date
          ? new Date(row.delivered_date).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'carrier',
      header: 'Carrier',
      enableSorting: false,
      cell: (row) =>
        row.carrier || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'tracking_number',
      header: 'Tracking No.',
      enableSorting: false,
      cell: (row) =>
        row.tracking_number ? (
          <span className="font-mono text-xs">{row.tracking_number}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Deliveries"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Deliveries' }]}
        createHref="/sales/deliveries/new"
        createLabel="New Delivery"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Deliveries"
        columns={columns}
        data={deliveries}
        pagination={pagination}
        loading={loading}
        editBasePath="/sales/deliveries"
        deleteEndpoint="/sales/deliveries"
        onDelete={fetchDeliveries}
        emptyMessage="No deliveries found"
        emptyDescription="Create your first delivery to get started."
        searchPlaceholder="Search deliveries..."
        storageKey="sales-deliveries"
      />
    </div>
  )
}
