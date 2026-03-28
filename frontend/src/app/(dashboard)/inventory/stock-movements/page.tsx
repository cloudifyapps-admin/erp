'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDownCircle, ArrowUpCircle, ArrowRightLeft } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'

const MOVEMENT_ICONS: Record<string, React.ReactNode> = {
  in: <ArrowDownCircle className="h-4 w-4 text-green-500" />,
  out: <ArrowUpCircle className="h-4 w-4 text-red-500" />,
  transfer: <ArrowRightLeft className="h-4 w-4 text-blue-500" />,
  adjustment: <ArrowRightLeft className="h-4 w-4 text-orange-500" />,
}

const MOVEMENT_LABELS: Record<string, string> = {
  in: 'Stock In',
  out: 'Stock Out',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
}

interface StockMovement {
  id: string
  reference: string
  product_name: string
  product_sku: string
  warehouse_name: string
  movement_type: 'in' | 'out' | 'transfer' | 'adjustment'
  quantity: number
  unit: string
  reason: string
  created_by: string
  created_at: string
}

export default function StockMovementsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [movements, setMovements] = useState<StockMovement[]>([])
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
  const movementType = searchParams.get('movement_type') ?? ''
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/inventory/stock-movements', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(movementType && { movement_type: movementType }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<StockMovement>(raw)
      setMovements(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load stock movements')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, movementType, sortBy, sortDirection])

  useEffect(() => {
    fetchMovements()
  }, [fetchMovements])

  const columns: ServerColumnDef<StockMovement>[] = [
    {
      id: 'reference',
      header: 'Reference',
      cell: (row) => <span className="font-medium">{row.reference}</span>,
    },
    {
      id: 'product',
      header: 'Product',
      enableSorting: false,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.product_name}</span>
          <span className="text-xs text-muted-foreground">{row.product_sku}</span>
        </div>
      ),
    },
    {
      id: 'warehouse_name',
      header: 'Warehouse',
    },
    {
      id: 'movement_type',
      header: 'Type',
      enableSorting: false,
      cell: (row) => (
        <div className="flex items-center gap-2">
          {MOVEMENT_ICONS[row.movement_type]}
          <span>{MOVEMENT_LABELS[row.movement_type] ?? row.movement_type}</span>
        </div>
      ),
      meta: {
        filterType: 'select',
        filterKey: 'movement_type',
        filterPlaceholder: 'All Types',
        filterOptions: [
          { value: 'in', label: 'Stock In' },
          { value: 'out', label: 'Stock Out' },
          { value: 'transfer', label: 'Transfer' },
          { value: 'adjustment', label: 'Adjustment' },
        ],
      },
    },
    {
      id: 'quantity',
      header: 'Quantity',
      enableSorting: false,
      cell: (row) => {
        const isPositive = row.movement_type === 'in'
        const isNegative = row.movement_type === 'out'
        return (
          <span
            className={`tabular-nums font-medium ${
              isPositive
                ? 'text-green-600'
                : isNegative
                  ? 'text-red-600'
                  : ''
            }`}
          >
            {isPositive ? '+' : isNegative ? '-' : ''}
            {row.quantity?.toLocaleString()} {row.unit}
          </span>
        )
      },
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (row) =>
        row.reason || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'created_by',
      header: 'Created By',
      enableSorting: false,
      cell: (row) =>
        row.created_by || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'created_at',
      header: 'Date',
      cell: (row) =>
        row.created_at
          ? new Date(row.created_at).toLocaleDateString() +
            ' ' +
            new Date(row.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : <span className="text-muted-foreground">—</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock Movements"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Movements' }]}
      />
      <AdvancedDataTable
        title="Stock Movements"
        columns={columns}
        data={movements}
        pagination={pagination}
        loading={loading}
        emptyMessage="No stock movements found"
        emptyDescription="Stock movements will appear here as inventory changes occur."
        searchPlaceholder="Search movements..."
        storageKey="inventory-stock-movements"
      />
    </div>
  )
}
