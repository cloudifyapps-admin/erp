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

interface Opportunity {
  id: string
  name: string
  customer_name?: string
  stage: string
  probability: number
  expected_revenue: number
  currency: string
  close_date: string
  assigned_to_name?: string
  status: string
  created_at: string
}

interface PaginatedResponse {
  items: Opportunity[]
  count: number
  page: number
  per_page: number
  pages: number
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  qualification: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  proposal: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  negotiation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  closed_won: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  closed_lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

function StageBadge({ stage }: { stage: string }) {
  const cls =
    STAGE_COLORS[stage?.toLowerCase()] ??
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  const label = stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

export default function OpportunitiesPage() {
  const searchParams = useSearchParams()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    total_pages: 1,
  })

  const page = Number(searchParams.get('page') ?? 1)
  const search = searchParams.get('search') ?? ''
  const stage = searchParams.get('stage') ?? ''

  const fetchOpportunities = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/opportunities', {
        params: {
          page,
          per_page: 25,
          ...(search && { search }),
          ...(stage && { stage }),
        },
      })
      const normalized = normalizePaginated<Opportunity>(raw)
      setOpportunities(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        total_pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }, [page, search, stage])

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  const columns: ColumnDef<Opportunity>[] = [
    {
      key: 'name',
      header: 'Opportunity',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'customer_name',
      header: 'Customer',
      cell: (row) =>
        row.customer_name || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (row) => <StageBadge stage={row.stage} />,
    },
    {
      key: 'probability',
      header: 'Probability',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${row.probability ?? 0}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{row.probability ?? 0}%</span>
        </div>
      ),
    },
    {
      key: 'expected_revenue',
      header: 'Expected Revenue',
      cell: (row) => (
        <span>
          {row.currency || 'USD'}{' '}
          {Number(row.expected_revenue ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'close_date',
      header: 'Close Date',
      cell: (row) =>
        row.close_date ? (
          new Date(row.close_date).toLocaleDateString()
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
        title="Opportunities"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Opportunities' }]}
        createHref="/crm/opportunities/new"
        createLabel="New Opportunity"
        createIcon={Plus}
      />
      <FilterBar
        searchPlaceholder="Search opportunities..."
        filters={[
          {
            key: 'stage',
            placeholder: 'All Stages',
            options: [
              { value: 'prospecting', label: 'Prospecting' },
              { value: 'qualification', label: 'Qualification' },
              { value: 'proposal', label: 'Proposal' },
              { value: 'negotiation', label: 'Negotiation' },
              { value: 'closed_won', label: 'Closed Won' },
              { value: 'closed_lost', label: 'Closed Lost' },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={opportunities}
        pagination={pagination}
        loading={loading}
        editBasePath="/crm/opportunities"
        deleteEndpoint="/crm/opportunities"
        onDelete={fetchOpportunities}
        emptyMessage="No opportunities found"
        emptyDescription="Create your first opportunity to start tracking your pipeline."
      />
    </div>
  )
}
