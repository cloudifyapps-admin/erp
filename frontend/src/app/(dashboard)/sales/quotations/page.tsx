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

interface PaginatedResponse {
  items: Quotation[]
  count: number
  page: number
  per_page: number
  pages: number
}

export default function QuotationsPage() {
  const searchParams = useSearchParams()
  const [quotations, setQuotations] = useState<Quotation[]>([])
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

  const fetchQuotations = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/sales/quotations', {
        params: {
          page,
          per_page: 25,
          ...(search && { search }),
          ...(status && { status }),
        },
      })
      const normalized = normalizePaginated<Quotation>(raw)
      setQuotations(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        total_pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load quotations')
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    fetchQuotations()
  }, [fetchQuotations])

  const columns: ColumnDef<Quotation>[] = [
    {
      key: 'number',
      header: 'Number',
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
      key: 'subtotal',
      header: 'Subtotal',
      cell: (row) => (
        <span className="tabular-nums">
          {row.currency || 'USD'}{' '}
          {Number(row.subtotal ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'tax_total',
      header: 'Tax',
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {row.currency || 'USD'}{' '}
          {Number(row.tax_total ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
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
    {
      key: 'valid_until',
      header: 'Valid Until',
      cell: (row) =>
        row.valid_until ? (
          <span
            className={
              new Date(row.valid_until) < new Date()
                ? 'text-orange-600'
                : 'text-muted-foreground'
            }
          >
            {new Date(row.valid_until).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Quotations"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Quotations' }]}
        createHref="/sales/quotations/new"
        createLabel="New Quotation"
        createIcon={Plus}
      />
      <FilterBar
        searchPlaceholder="Search quotations..."
        filters={[
          {
            key: 'status',
            placeholder: 'All Statuses',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'accepted', label: 'Accepted' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'expired', label: 'Expired' },
              { value: 'converted', label: 'Converted' },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={quotations}
        pagination={pagination}
        loading={loading}
        editBasePath="/sales/quotations"
        deleteEndpoint="/sales/quotations"
        onDelete={fetchQuotations}
        emptyMessage="No quotations found"
        emptyDescription="Create your first quotation to get started."
      />
    </div>
  )
}
