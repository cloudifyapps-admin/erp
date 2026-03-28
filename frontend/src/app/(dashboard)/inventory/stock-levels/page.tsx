'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'

interface StockLevel {
  id: string
  product_name: string
  product_sku: string
  warehouse_name: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  reorder_point: number
  unit: string
}

export default function StockLevelsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
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

  const fetchStockLevels = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/inventory/stock-levels', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<StockLevel>(raw)
      setStockLevels(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load stock levels')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, sortBy, sortDirection])

  useEffect(() => {
    fetchStockLevels()
  }, [fetchStockLevels])

  const columns: ServerColumnDef<StockLevel>[] = [
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
      id: 'quantity_on_hand',
      header: 'On Hand',
      cell: (row) => (
        <span className="tabular-nums font-medium">
          {row.quantity_on_hand?.toLocaleString()} {row.unit}
        </span>
      ),
    },
    {
      id: 'quantity_reserved',
      header: 'Reserved',
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {row.quantity_reserved?.toLocaleString()} {row.unit}
        </span>
      ),
    },
    {
      id: 'quantity_available',
      header: 'Available',
      cell: (row) => (
        <span className="tabular-nums font-semibold">
          {row.quantity_available?.toLocaleString()} {row.unit}
        </span>
      ),
    },
    {
      id: 'stock_status',
      header: 'Status',
      enableSorting: false,
      cell: (row) => {
        const isLow =
          row.reorder_point != null &&
          row.quantity_available <= row.reorder_point
        return isLow ? (
          <div className="flex items-center gap-1.5 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Low Stock</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">In Stock</span>
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock Levels"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Levels' }]}
      />
      <AdvancedDataTable
        title="Stock Levels"
        columns={columns}
        data={stockLevels}
        pagination={pagination}
        loading={loading}
        emptyMessage="No stock levels found"
        emptyDescription="Stock levels will appear here once products are added to warehouses."
        searchPlaceholder="Search stock levels..."
        storageKey="inventory-stock-levels"
      />
    </div>
  )
}
