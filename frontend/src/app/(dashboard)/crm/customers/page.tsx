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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<Customer[]>([])
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

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/customers', {
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
      const normalized = normalizePaginated<Customer>(raw)
      setCustomers(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, type, sortBy, sortDirection])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const columns: ServerColumnDef<Customer>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => <TypeBadge type={row.type} />,
      meta: {
        filterType: 'select',
        filterKey: 'type',
        filterPlaceholder: 'All Types',
        filterOptions: [
          { value: 'individual', label: 'Individual' },
          { value: 'company', label: 'Company' },
          { value: 'government', label: 'Government' },
        ],
      },
    },
    {
      id: 'email',
      header: 'Email',
      cell: (row) => row.email || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'phone',
      header: 'Phone',
      cell: (row) => row.phone || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'credit_limit',
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
          { value: 'archived', label: 'Archived' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Customers"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Customers' }]}
        createHref="/crm/customers/new"
        createLabel="New Customer"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Customers"
        columns={columns}
        data={customers}
        pagination={pagination}
        loading={loading}
        editBasePath="/crm/customers"
        deleteEndpoint="/crm/customers"
        onDelete={fetchCustomers}
        emptyMessage="No customers found"
        emptyDescription="Create your first customer to get started."
        searchPlaceholder="Search customers..."
        storageKey="crm-customers"
      />
    </div>
  )
}
