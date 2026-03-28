'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, FileText, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

interface PayrollRun {
  id: string
  period_label: string
  month: number
  year: number
  total_employees: number
  total_gross: number
  total_net: number
  currency: string
  status: string
  processed_by: string
  processed_at: string
}

export default function PayrollPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingSlips, setGeneratingSlips] = useState<string | null>(null)
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

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/hr/payroll-runs', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<PayrollRun>(raw)
      setRuns(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load payroll runs')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  const handleGenerateSlips = async (id: string) => {
    setGeneratingSlips(id)
    try {
      await api.post(`/hr/payroll-runs/${id}/generate-slips`)
      toast.success('Pay slips generated successfully')
      fetchRuns()
    } catch {
      toast.error('Failed to generate pay slips')
    } finally {
      setGeneratingSlips(null)
    }
  }

  const columns: ServerColumnDef<PayrollRun>[] = [
    {
      id: 'period_label',
      header: 'Period',
      cell: (row) => <span className="font-medium">{row.period_label}</span>,
    },
    {
      id: 'total_employees',
      header: 'Employees',
      cell: (row) => (
        <span className="tabular-nums">{row.total_employees?.toLocaleString()}</span>
      ),
    },
    {
      id: 'total_gross',
      header: 'Gross Total',
      cell: (row) => (
        <span className="tabular-nums">
          {row.currency ?? ''} {row.total_gross?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      id: 'total_net',
      header: 'Net Total',
      cell: (row) => (
        <span className="tabular-nums font-semibold">
          {row.currency ?? ''} {row.total_net?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      id: 'processed_by',
      header: 'Processed By',
      enableSorting: false,
      cell: (row) =>
        row.processed_by || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'processed_at',
      header: 'Date',
      cell: (row) =>
        row.processed_at
          ? new Date(row.processed_at).toLocaleDateString()
          : '—',
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
          { value: 'processing', label: 'Processing' },
          { value: 'processed', label: 'Processed' },
          { value: 'paid', label: 'Paid' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Payroll"
        breadcrumbs={[{ label: 'HR' }, { label: 'Payroll' }]}
        createHref="/hr/payroll/new"
        createLabel="New Run"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Payroll"
        columns={columns}
        data={runs}
        pagination={pagination}
        loading={loading}
        onDelete={fetchRuns}
        emptyMessage="No payroll runs found"
        emptyDescription="Create your first payroll run to get started."
        searchPlaceholder="Search payroll..."
        storageKey="hr-payroll"
        additionalActions={(row) =>
          row.status === 'processed' ? (
            <DropdownMenuItem
              onClick={() => handleGenerateSlips(row.id)}
              disabled={generatingSlips === row.id}
            >
              {generatingSlips === row.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Generate Slips
            </DropdownMenuItem>
          ) : undefined
        }
      />
    </div>
  )
}
