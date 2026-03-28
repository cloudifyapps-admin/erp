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

interface Customer {
  id: string
  code: string
  name: string
  email: string
  phone: string
  type: string
  status: string
  credit_limit: number
  currency: string
  created_at: string
}

interface PaginatedResponse {
  items: Customer[]
  count: number
  page: number
  per_page: number
  pages: number
}

const TYPE_COLORS: Record<string, string> = {
  individual: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  company: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  government: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

function TypeBadge({ type }: { type: string }) {
  const cls =
    TYPE_COLORS[type?.toLowerCase()] ??
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {type}
    </span>
  )
}

export default function CustomersPage() {
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<Customer[]>([])
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

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/customers', {
        params: {
          page,
          per_page: 25,
          ...(search && { search }),
          ...(status && { status }),
          ...(type && { type }),
        },
      })
      const normalized = normalizePaginated<Customer>(raw)
      setCustomers(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        total_pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [page, search, status, type])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const columns: ColumnDef<Customer>[] = [
    {
      key: 'code',
      header: 'Code',
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => <TypeBadge type={row.type} />,
    },
    {
      key: 'email',
      header: 'Email',
      cell: (row) => row.email || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (row) => row.phone || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'credit_limit',
      header: 'Credit Limit',
      cell: (row) =>
        row.credit_limit != null ? (
          <span>
            {row.currency || 'USD'}{' '}
            {Number(row.credit_limit).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Customers"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Customers' }]}
        createHref="/crm/customers/new"
        createLabel="New Customer"
        createIcon={Plus}
      />
      <FilterBar
        searchPlaceholder="Search customers..."
        filters={[
          {
            key: 'type',
            placeholder: 'All Types',
            options: [
              { value: 'individual', label: 'Individual' },
              { value: 'company', label: 'Company' },
              { value: 'government', label: 'Government' },
            ],
          },
          {
            key: 'status',
            placeholder: 'All Statuses',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'archived', label: 'Archived' },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={customers}
        pagination={pagination}
        loading={loading}
        editBasePath="/crm/customers"
        deleteEndpoint="/crm/customers"
        onDelete={fetchCustomers}
        emptyMessage="No customers found"
        emptyDescription="Create your first customer to get started."
      />
    </div>
  )
}
