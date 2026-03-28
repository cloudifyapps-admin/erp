'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Warehouse as WarehouseIcon } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { StatusBadge } from '@/components/shared/status-badge'

interface WarehouseItem {
  id: string
  name: string
  code: string
  address: string
  city: string
  country: string
  manager: string
  capacity: number
  status: string
}

export default function WarehousesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
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
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  const fetchWarehouses = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/inventory/warehouses', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<WarehouseItem>(raw)
      setWarehouses(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load warehouses')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, sortBy, sortDirection])

  useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  const columns: ServerColumnDef<WarehouseItem>[] = [
    {
      id: 'name',
      header: 'Warehouse',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">{row.name}</span>
            <span className="text-xs text-muted-foreground">{row.code}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      enableSorting: false,
      cell: (row) => {
        const parts = [row.city, row.country].filter(Boolean)
        return parts.length > 0 ? (
          <span>{parts.join(', ')}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      id: 'manager',
      header: 'Manager',
      enableSorting: false,
      cell: (row) =>
        row.manager || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'capacity',
      header: 'Capacity',
      cell: (row) => (
        <span className="tabular-nums">
          {row.capacity?.toLocaleString() ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Warehouses"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Warehouses' }]}
        createHref="/inventory/warehouses/new"
        createLabel="New Warehouse"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Warehouses"
        columns={columns}
        data={warehouses}
        pagination={pagination}
        loading={loading}
        editBasePath="/inventory/warehouses"
        deleteEndpoint="/inventory/warehouses"
        onDelete={fetchWarehouses}
        emptyMessage="No warehouses found"
        emptyDescription="Create your first warehouse to get started."
        searchPlaceholder="Search warehouses..."
        storageKey="inventory-warehouses"
      />
    </div>
  )
}
