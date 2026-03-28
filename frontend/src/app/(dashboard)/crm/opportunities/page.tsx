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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
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
  const stage = searchParams.get('stage') ?? ''
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  const fetchOpportunities = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/opportunities', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(stage && { stage }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Opportunity>(raw)
      setOpportunities(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, stage, sortBy, sortDirection])

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  const columns: ServerColumnDef<Opportunity>[] = [
    {
      id: 'name',
      header: 'Opportunity',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: 'customer_name',
      header: 'Customer',
      enableSorting: false,
      cell: (row) =>
        row.customer_name || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'stage',
      header: 'Stage',
      cell: (row) => <StageBadge stage={row.stage} />,
      meta: {
        filterType: 'select',
        filterKey: 'stage',
        filterPlaceholder: 'All Stages',
        filterOptions: [
          { value: 'prospecting', label: 'Prospecting' },
          { value: 'qualification', label: 'Qualification' },
          { value: 'proposal', label: 'Proposal' },
          { value: 'negotiation', label: 'Negotiation' },
          { value: 'closed_won', label: 'Closed Won' },
          { value: 'closed_lost', label: 'Closed Lost' },
        ],
      },
    },
    {
      id: 'probability',
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
      id: 'expected_revenue',
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
      id: 'close_date',
      header: 'Close Date',
      cell: (row) =>
        row.close_date ? (
          new Date(row.close_date).toLocaleDateString()
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Opportunities"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Opportunities' }]}
        createHref="/crm/opportunities/new"
        createLabel="New Opportunity"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Opportunities"
        columns={columns}
        data={opportunities}
        pagination={pagination}
        loading={loading}
        editBasePath="/crm/opportunities"
        deleteEndpoint="/crm/opportunities"
        onDelete={fetchOpportunities}
        emptyMessage="No opportunities found"
        emptyDescription="Create your first opportunity to start tracking your pipeline."
        searchPlaceholder="Search opportunities..."
        storageKey="crm-opportunities"
      />
    </div>
  )
}
