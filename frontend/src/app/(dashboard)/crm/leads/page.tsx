'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Sparkles, ArrowRightCircle, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
  type BulkAction,
} from '@/components/shared/advanced-data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'

interface Lead {
  id: string
  title: string
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
  source: string
  status: string
  lead_score: number
  assigned_to_name?: string
  converted_at?: string
  converted_to_contact_id?: number
  converted_to_customer_id?: number
  converted_to_opportunity_id?: number
  created_at: string
}

interface LookupOption {
  value: string
  label: string
}

function ScoreBadge({ score }: { score: number }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>
  const cls =
    score >= 60
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : score >= 30
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  const label = score >= 60 ? 'Hot' : score >= 30 ? 'Warm' : 'Cold'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      <Sparkles className="h-3 w-3" />
      {score}
      <span className="font-medium">({label})</span>
    </span>
  )
}

export default function LeadsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceOptions, setSourceOptions] = useState<LookupOption[]>([])
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
  const source = searchParams.get('source') ?? ''
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  // Fetch lookup options for filters
  useEffect(() => {
    api.get('/settings/master-data/lead-sources').then(({ data }) => {
      const items = data?.data ?? data?.items ?? data ?? []
      setSourceOptions(
        items.map((i: { name: string; slug?: string }) => ({
          value: i.slug ?? i.name.toLowerCase().replace(/\s+/g, '-'),
          label: i.name,
        }))
      )
    }).catch(() => {})
  }, [])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/leads', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(source && { source }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Lead>(raw)
      setLeads(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, source, sortBy, sortDirection])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const columns: ServerColumnDef<Lead>[] = [
    {
      id: 'title',
      header: 'Lead',
      cell: (row) => (
        <div>
          <span className="font-medium">
            {row.title || `${row.first_name} ${row.last_name}`}
          </span>
          {row.company && (
            <p className="text-xs text-muted-foreground mt-0.5">{row.company}</p>
          )}
        </div>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      cell: (row) => (
        <span className="text-muted-foreground text-sm">{row.email || '—'}</span>
      ),
    },
    {
      id: 'lead_score',
      header: 'Score',
      cell: (row) => <ScoreBadge score={row.lead_score} />,
    },
    {
      id: 'source',
      header: 'Source',
      cell: (row) =>
        row.source ? (
          <span className="capitalize text-sm">{row.source.replace(/[-_]/g, ' ')}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      meta: {
        filterType: 'select',
        filterKey: 'source',
        filterPlaceholder: 'All Sources',
        filterOptions: sourceOptions,
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={row.status} />
          {row.status === 'converted' && (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          )}
        </div>
      ),
      meta: {
        filterType: 'select',
        filterKey: 'status',
        filterPlaceholder: 'All Statuses',
        filterOptions: [
          { value: 'new', label: 'New' },
          { value: 'contacted', label: 'Contacted' },
          { value: 'nurturing', label: 'Nurturing' },
          { value: 'qualified', label: 'Qualified' },
          { value: 'converted', label: 'Converted' },
          { value: 'lost', label: 'Lost' },
          { value: 'unqualified', label: 'Unqualified' },
        ],
      },
    },
    {
      id: 'assigned_to_name',
      header: 'Assigned To',
      enableSorting: false,
      cell: (row) =>
        row.assigned_to_name || (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: (row) =>
        row.status !== 'converted' ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs font-medium text-primary hover:text-primary"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/crm/leads/${row.id}/convert`)
            }}
          >
            <ArrowRightCircle className="h-3.5 w-3.5" />
            Convert
          </Button>
        ) : (
          <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Converted
          </span>
        ),
    },
  ]

  const bulkActions: BulkAction[] = useMemo(
    () => [
      {
        label: 'Delete Selected',
        icon: <Trash2 className="h-3.5 w-3.5" />,
        variant: 'destructive',
        onClick: async (ids) => {
          if (!confirm(`Delete ${ids.length} lead(s)?`)) return
          try {
            await api.post('/crm/leads/bulk-delete', { ids })
            toast.success(`${ids.length} lead(s) deleted`)
            fetchLeads()
          } catch {
            toast.error('Failed to delete leads')
          }
        },
      },
    ],
    [fetchLeads]
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Leads"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Leads' }]}
        createHref="/crm/leads/new"
        createLabel="New Lead"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Leads"
        columns={columns}
        data={leads}
        pagination={pagination}
        loading={loading}
        editBasePath="/crm/leads"
        deleteEndpoint="/crm/leads"
        onDelete={fetchLeads}
        emptyMessage="No leads found"
        emptyDescription="Create your first lead to get started."
        searchPlaceholder="Search leads..."
        storageKey="crm-leads"
        enableSelection
        bulkActions={bulkActions}
      />
    </div>
  )
}
