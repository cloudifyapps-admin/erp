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

interface Product {
  id: string
  name: string
  sku: string
  type: string
  price: number
  currency: string
  unit: string
  status: string
  category: string
}

export default function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
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
  const type = searchParams.get('type') ?? ''
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/inventory/products', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(type && { type }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Product>(raw)
      setProducts(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, type, sortBy, sortDirection])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const columns: ServerColumnDef<Product>[] = [
    {
      id: 'sku',
      header: 'SKU',
      cell: (row) => <span className="font-mono text-muted-foreground">{row.sku}</span>,
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (row) =>
        row.category || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <span className="capitalize">{row.type?.replace(/_/g, ' ')}</span>
      ),
      meta: {
        filterType: 'select',
        filterKey: 'type',
        filterPlaceholder: 'All Types',
        filterOptions: [
          { value: 'finished_good', label: 'Finished Good' },
          { value: 'raw_material', label: 'Raw Material' },
          { value: 'service', label: 'Service' },
          { value: 'consumable', label: 'Consumable' },
        ],
      },
    },
    {
      id: 'price',
      header: 'Price',
      cell: (row) => (
        <span className="tabular-nums">
          {row.price?.toLocaleString()} {row.currency}
        </span>
      ),
    },
    {
      id: 'unit',
      header: 'Unit',
      cell: (row) =>
        row.unit || <span className="text-muted-foreground">—</span>,
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
        title="Products"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Products' }]}
        createHref="/inventory/products/new"
        createLabel="New Product"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Products"
        columns={columns}
        data={products}
        pagination={pagination}
        loading={loading}
        editBasePath="/inventory/products"
        deleteEndpoint="/inventory/products"
        onDelete={fetchProducts}
        emptyMessage="No products found"
        emptyDescription="Create your first product to get started."
        searchPlaceholder="Search products..."
        storageKey="inventory-products"
      />
    </div>
  )
}
