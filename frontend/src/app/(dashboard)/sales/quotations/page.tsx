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

interface Quotation {
  id: string
  number: string
  customer_name?: string
  status: string
  subtotal: number
  tax_total: number
  total: number
  currency: string
  valid_until: string
  created_at: string
}

export default function QuotationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [quotations, setQuotations] = useState<Quotation[]>([])
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

  const fetchQuotations = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/sales/quotations', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Quotation>(raw)
      setQuotations(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load quotations')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchQuotations()
  }, [fetchQuotations])

  const columns: ServerColumnDef<Quotation>[] = [
    {
      id: 'number',
      header: 'Number',
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
          { value: 'sent', label: 'Sent' },
          { value: 'accepted', label: 'Accepted' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'expired', label: 'Expired' },
          { value: 'converted', label: 'Converted' },
        ],
      },
    },
    {
      id: 'subtotal',
      header: 'Subtotal',
      cell: (row) => (
        <span className="tabular-nums">
          {Number(row.subtotal ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}{' '}
          {row.currency}
        </span>
      ),
    },
    {
      id: 'tax_total',
      header: 'Tax',
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {Number(row.tax_total ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}{' '}
          {row.currency}
        </span>
      ),
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
    {
      id: 'valid_until',
      header: 'Valid Until',
      cell: (row) => {
        if (!row.valid_until) return <span className="text-muted-foreground">—</span>
        const isExpired = new Date(row.valid_until) < new Date()
        return (
          <span className={isExpired ? 'text-orange-600' : ''}>
            {new Date(row.valid_until).toLocaleDateString()}
          </span>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Quotations"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Quotations' }]}
        createHref="/sales/quotations/new"
        createLabel="New Quotation"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Quotations"
        columns={columns}
        data={quotations}
        pagination={pagination}
        loading={loading}
        editBasePath="/sales/quotations"
        deleteEndpoint="/sales/quotations"
        onDelete={fetchQuotations}
        emptyMessage="No quotations found"
        emptyDescription="Create your first quotation to get started."
        searchPlaceholder="Search quotations..."
        storageKey="sales-quotations"
      />
    </div>
  )
}
