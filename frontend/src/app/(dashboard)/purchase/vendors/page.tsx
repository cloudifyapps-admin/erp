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

interface Vendor {
  id: string
  name: string
  code: string
  email: string
  phone: string
  status: string
}

export default function VendorsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [vendors, setVendors] = useState<Vendor[]>([])
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

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/purchase/vendors', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Vendor>(raw)
      setVendors(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load vendors')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchVendors()
  }, [fetchVendors])

  const columns: ServerColumnDef<Vendor>[] = [
    {
      id: 'code',
      header: 'Code',
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: 'email',
      header: 'Email',
    },
    {
      id: 'phone',
      header: 'Phone',
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
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Vendors"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Vendors' }]}
        createHref="/purchase/vendors/new"
        createLabel="New Vendor"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Vendors"
        columns={columns}
        data={vendors}
        pagination={pagination}
        loading={loading}
        editBasePath="/purchase/vendors"
        deleteEndpoint="/purchase/vendors"
        onDelete={fetchVendors}
        emptyMessage="No vendors found"
        emptyDescription="Create your first vendor to get started."
        searchPlaceholder="Search vendors..."
        storageKey="purchase-vendors"
      />
    </div>
  )
}
