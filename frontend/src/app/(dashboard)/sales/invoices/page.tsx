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

interface Invoice {
  id: string
  number: string
  type: string
  customer_name?: string
  status: string
  subtotal: number
  tax_total: number
  total: number
  paid_amount: number
  due_amount: number
  currency: string
  issue_date: string
  due_date?: string
  created_at: string
}

const TYPE_COLORS: Record<string, string> = {
  tax: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  proforma: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  credit_note: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

function InvoiceTypeBadge({ type }: { type: string }) {
  const cls =
    TYPE_COLORS[type?.toLowerCase()] ??
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  const label = type
    ?.replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Invoice'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

export default function InvoicesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [invoices, setInvoices] = useState<Invoice[]>([])
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
  const type = searchParams.get('type') ?? ''
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/sales/invoices', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(type && { type }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Invoice>(raw)
      setInvoices(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, type, sortBy, sortDirection])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const columns: ServerColumnDef<Invoice>[] = [
    {
      id: 'number',
      header: 'Invoice No.',
      cell: (row) => (
        <span className="font-bold font-mono">{row.number}</span>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => <InvoiceTypeBadge type={row.type} />,
      meta: {
        filterType: 'select',
        filterKey: 'type',
        filterPlaceholder: 'All Types',
        filterOptions: [
          { value: 'tax', label: 'Tax' },
          { value: 'proforma', label: 'Proforma' },
          { value: 'credit_note', label: 'Credit Note' },
        ],
      },
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
          { value: 'paid', label: 'Paid' },
          { value: 'partial', label: 'Partial' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
    {
      id: 'issue_date',
      header: 'Issue Date',
      cell: (row) =>
        row.issue_date
          ? new Date(row.issue_date).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: (row) => {
        if (!row.due_date) return <span className="text-muted-foreground">—</span>
        const isOverdue =
          new Date(row.due_date) < new Date() && row.status !== 'paid'
        return (
          <span className={isOverdue ? 'text-orange-600 font-medium' : ''}>
            {new Date(row.due_date).toLocaleDateString()}
          </span>
        )
      },
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
      id: 'due_amount',
      header: 'Due Amount',
      cell: (row) => {
        const due = Number(row.due_amount ?? 0)
        return (
          <span
            className={`tabular-nums ${due > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
          >
            {due.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
            {row.currency}
          </span>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Invoices"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Invoices' }]}
        createHref="/sales/invoices/new"
        createLabel="New Invoice"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Invoices"
        columns={columns}
        data={invoices}
        pagination={pagination}
        loading={loading}
        editBasePath="/sales/invoices"
        deleteEndpoint="/sales/invoices"
        onDelete={fetchInvoices}
        emptyMessage="No invoices found"
        emptyDescription="Create your first invoice to get started."
        searchPlaceholder="Search invoices..."
        storageKey="sales-invoices"
      />
    </div>
  )
}
