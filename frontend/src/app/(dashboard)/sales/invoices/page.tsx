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

interface PaginatedResponse {
  items: Invoice[]
  count: number
  page: number
  per_page: number
  pages: number
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
  const searchParams = useSearchParams()
  const [invoices, setInvoices] = useState<Invoice[]>([])
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
  const type = searchParams.get('type') ?? ''

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/sales/invoices', {
        params: {
          page,
          per_page: 25,
          ...(search && { search }),
          ...(status && { status }),
          ...(type && { type }),
        },
      })
      const normalized = normalizePaginated<Invoice>(raw)
      setInvoices(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        total_pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [page, search, status, type])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const columns: ColumnDef<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice No.',
      cell: (row) => (
        <span className="font-mono text-sm font-medium">{row.number}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => <InvoiceTypeBadge type={row.type} />,
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
      key: 'issue_date',
      header: 'Issue Date',
      cell: (row) =>
        row.issue_date
          ? new Date(row.issue_date).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      cell: (row) =>
        row.due_date ? (
          <span
            className={
              row.status !== 'paid' && new Date(row.due_date) < new Date()
                ? 'text-orange-600 font-medium'
                : ''
            }
          >
            {new Date(row.due_date).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
      key: 'due_amount',
      header: 'Due',
      cell: (row) => {
        const due = Number(row.due_amount ?? 0)
        return (
          <span
            className={`tabular-nums ${due > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
          >
            {row.currency || 'USD'}{' '}
            {due.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Invoices"
        breadcrumbs={[{ label: 'Sales' }, { label: 'Invoices' }]}
        createHref="/sales/invoices/new"
        createLabel="New Invoice"
        createIcon={Plus}
      />
      <FilterBar
        searchPlaceholder="Search invoices..."
        filters={[
          {
            key: 'type',
            placeholder: 'All Types',
            options: [
              { value: 'tax', label: 'Tax Invoice' },
              { value: 'proforma', label: 'Proforma' },
              { value: 'credit_note', label: 'Credit Note' },
            ],
          },
          {
            key: 'status',
            placeholder: 'All Statuses',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'paid', label: 'Paid' },
              { value: 'partial', label: 'Partial' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={invoices}
        pagination={pagination}
        loading={loading}
        editBasePath="/sales/invoices"
        deleteEndpoint="/sales/invoices"
        onDelete={fetchInvoices}
        emptyMessage="No invoices found"
        emptyDescription="Create invoices from delivered sales orders or manually."
      />
    </div>
  )
}
