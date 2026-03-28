'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, CheckCircle2, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface ExpenseClaim {
  id: string
  claim_number: string
  employee_name: string
  department_name: string
  title: string
  category: string
  total_amount: number
  currency: string
  expense_date: string
  status: string
  submitted_at: string
}

export default function ExpenseClaimsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [claims, setClaims] = useState<ExpenseClaim[]>([])
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

  const fetchClaims = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/hr/expense-claims', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<ExpenseClaim>(raw)
      setClaims(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load expense claims')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchClaims()
  }, [fetchClaims])

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/hr/expense-claims/${id}/approve`)
      toast.success('Expense claim approved')
      fetchClaims()
    } catch {
      toast.error('Failed to approve expense claim')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await api.post(`/hr/expense-claims/${id}/reject`)
      toast.success('Expense claim rejected')
      fetchClaims()
    } catch {
      toast.error('Failed to reject expense claim')
    }
  }

  const columns: ServerColumnDef<ExpenseClaim>[] = [
    {
      id: 'claim_number',
      header: 'Claim #',
      cell: (row) => <span className="font-mono text-xs">{row.claim_number}</span>,
    },
    {
      id: 'employee_name',
      header: 'Employee',
      enableSorting: false,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.employee_name}</div>
          <div className="text-xs text-muted-foreground">{row.department_name}</div>
        </div>
      ),
    },
    {
      id: 'title',
      header: 'Title',
      cell: (row) => row.title || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (row) => (
        <span className="capitalize">{row.category?.replace(/_/g, ' ') ?? '—'}</span>
      ),
    },
    {
      id: 'total_amount',
      header: 'Amount',
      cell: (row) => (
        <span className="tabular-nums font-medium">
          {row.currency ?? ''} {row.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      id: 'expense_date',
      header: 'Date',
      cell: (row) =>
        row.expense_date ? new Date(row.expense_date).toLocaleDateString() : '—',
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
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'paid', label: 'Paid' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Expense Claims"
        breadcrumbs={[{ label: 'HR' }, { label: 'Expense Claims' }]}
        createHref="/hr/expense-claims/new"
        createLabel="New Claim"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Expense Claims"
        columns={columns}
        data={claims}
        pagination={pagination}
        loading={loading}
        editBasePath="/hr/expense-claims"
        onDelete={fetchClaims}
        emptyMessage="No expense claims found"
        emptyDescription="Create your first expense claim to get started."
        searchPlaceholder="Search expense claims..."
        storageKey="hr-expense-claims"
        additionalActions={(row) =>
          row.status === 'pending' ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleApprove(row.id)}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleReject(row.id)}>
                <XCircle className="mr-2 h-4 w-4 text-destructive" /> Reject
              </DropdownMenuItem>
            </>
          ) : undefined
        }
      />
    </div>
  )
}
