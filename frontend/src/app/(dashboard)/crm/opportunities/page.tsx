'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, List, LayoutGrid, KanbanSquare, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
  type BulkAction,
} from '@/components/shared/advanced-data-table'
import { Button } from '@/components/ui/button'

interface Opportunity {
  id: string
  code: string
  title: string
  customer_id?: number
  customer_name?: string
  stage: string
  probability: number
  expected_amount: number
  weighted_amount: number
  currency_id?: number
  expected_close_date: string
  assigned_to?: number
  assigned_to_name?: string
  created_at: string
}

type ViewMode = 'table' | 'card' | 'kanban'

const STAGES = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  qualification: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  proposal: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  negotiation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  closed_won: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  closed_lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const STAGE_COLUMN_BG: Record<string, string> = {
  prospecting: 'bg-gray-50/50 dark:bg-gray-900/20',
  qualification: 'bg-blue-50/50 dark:bg-blue-950/20',
  proposal: 'bg-indigo-50/50 dark:bg-indigo-950/20',
  negotiation: 'bg-orange-50/50 dark:bg-orange-950/20',
  closed_won: 'bg-green-50/50 dark:bg-green-950/20',
  closed_lost: 'bg-red-50/50 dark:bg-red-950/20',
}

const STAGE_TEXT_COLOR: Record<string, string> = {
  prospecting: 'text-gray-600 dark:text-gray-400',
  qualification: 'text-blue-600 dark:text-blue-400',
  proposal: 'text-indigo-600 dark:text-indigo-400',
  negotiation: 'text-orange-600 dark:text-orange-400',
  closed_won: 'text-green-600 dark:text-green-400',
  closed_lost: 'text-red-600 dark:text-red-400',
}

function StageBadge({ stage }: { stage: string }) {
  if (!stage) return <span className="text-muted-foreground text-xs">—</span>
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

function formatRevenue(amount: number, currency?: string) {
  return `${currency || 'USD'} ${Number(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setViewState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('opportunities-view-mode')
      if (saved === 'table' || saved === 'card' || saved === 'kanban') return saved
    }
    return 'table'
  })
  const setView = (v: ViewMode) => {
    setViewState(v)
    localStorage.setItem('opportunities-view-mode', v)
  }
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    pages: 1,
  })

  // Kanban-specific state: all opportunities for pipeline view
  const [kanbanOpportunities, setKanbanOpportunities] = useState<Opportunity[]>([])
  const [kanbanLoading, setKanbanLoading] = useState(false)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  const page = Number(searchParams.get('page') ?? 1)
  const perPage = Number(searchParams.get('per_page') ?? 25)
  const search = searchParams.get('search') ?? ''
  const stage = searchParams.get('stage') ?? ''
  const probability = searchParams.get('probability') ?? ''
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
  }, [page, perPage, search, stage, probability, sortBy, sortDirection])

  const fetchAllOpportunities = useCallback(async () => {
    setKanbanLoading(true)
    try {
      const { data: raw } = await api.get('/crm/opportunities', {
        params: { page: 1, per_page: 200 },
      })
      const normalized = normalizePaginated<Opportunity>(raw)
      setKanbanOpportunities(normalized.items)
    } catch {
      toast.error('Failed to load pipeline data')
    } finally {
      setKanbanLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  useEffect(() => {
    if (view === 'kanban') {
      fetchAllOpportunities()
    }
  }, [view, fetchAllOpportunities])

  // Drag and drop handlers for Kanban
  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    e.dataTransfer.setData('text/plain', oppId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stageKey)
  }

  const handleDragLeave = () => {
    setDragOverStage(null)
  }

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault()
    setDragOverStage(null)
    const oppId = e.dataTransfer.getData('text/plain')
    if (!oppId) return

    const opp = kanbanOpportunities.find((o) => o.id === oppId)
    if (!opp || opp.stage === newStage) return

    // Optimistic update
    const previousOpportunities = [...kanbanOpportunities]
    setKanbanOpportunities((prev) =>
      prev.map((o) => (o.id === oppId ? { ...o, stage: newStage } : o))
    )

    try {
      await api.put(`/crm/opportunities/${oppId}`, { stage: newStage })
      toast.success(`Moved to ${STAGE_LABELS[newStage]}`)
      // Also refresh table data in case user switches back
      fetchOpportunities()
    } catch {
      // Revert on error
      setKanbanOpportunities(previousOpportunities)
      toast.error('Failed to update opportunity stage')
    }
  }

  // Data for card and kanban views
  const displayData = view === 'kanban' ? kanbanOpportunities : opportunities
  const totalCount = view === 'kanban' ? kanbanOpportunities.length : pagination.total

  // Kanban grouped data
  const kanbanColumns = STAGES.map((stageKey) => {
    const items = kanbanOpportunities.filter(
      (o) => o.stage?.toLowerCase() === stageKey
    )
    const totalRevenue = items.reduce(
      (sum, o) => sum + Number(o.expected_amount ?? 0),
      0
    )
    return { stage: stageKey, items, totalRevenue }
  })

  const totalPipelineValue = kanbanOpportunities.reduce(
    (sum, o) => sum + Number(o.expected_amount ?? 0),
    0
  )

  const columns: ServerColumnDef<Opportunity>[] = [
    {
      id: 'title',
      header: 'Opportunity',
      cell: (row) => (
        <div>
          <span className="font-medium">{row.title}</span>
          {row.code && <span className="ml-2 text-xs text-muted-foreground">{row.code}</span>}
        </div>
      ),
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
      meta: {
        filterType: 'select',
        filterKey: 'probability',
        filterPlaceholder: 'All Probabilities',
        filterOptions: [
          { value: '0-25', label: 'Low (0-25%)' },
          { value: '26-50', label: 'Medium (26-50%)' },
          { value: '51-75', label: 'High (51-75%)' },
          { value: '76-100', label: 'Very High (76-100%)' },
        ],
      },
    },
    {
      id: 'expected_amount',
      header: 'Expected Amount',
      cell: (row) => (
        <span>
          USD{' '}
          {Number(row.expected_amount ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      id: 'expected_close_date',
      header: 'Close Date',
      cell: (row) =>
        row.expected_close_date ? (
          new Date(row.expected_close_date).toLocaleDateString()
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'assigned_to_name',
      header: 'Assigned To',
      enableSorting: false,
      cell: (row) =>
        row.assigned_to_name || <span className="text-muted-foreground">—</span>,
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
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 p-0 rounded-md cursor-pointer ${view === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setView('table')}
            >
              <List className="h-3.5 w-3.5" />
              <span className="sr-only">Table view</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 p-0 rounded-md cursor-pointer ${view === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setView('card')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="sr-only">Card view</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 p-0 rounded-md cursor-pointer ${view === 'kanban' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setView('kanban')}
            >
              <KanbanSquare className="h-3.5 w-3.5" />
              <span className="sr-only">Kanban view</span>
            </Button>
          </div>
        }
      />

      {/* Table view */}
      {view === 'table' && (
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
          enableSelection
          bulkActions={[
            {
              label: 'Delete Selected',
              icon: <Trash2 className="h-3.5 w-3.5" />,
              variant: 'destructive',
              onClick: async (ids) => {
                if (!confirm(`Delete ${ids.length} opportunity(ies)?`)) return
                try {
                  await api.post('/crm/opportunities/bulk-delete', { ids })
                  toast.success(`${ids.length} opportunity(ies) deleted`)
                  fetchOpportunities()
                } catch {
                  toast.error('Failed to delete opportunities')
                }
              },
            },
          ]}
        />
      )}

      {/* Card view */}
      {view === 'card' && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden p-5">
            {loading && opportunities.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border/60 bg-card p-4 animate-pulse"
                  >
                    <div className="h-4 w-3/4 rounded bg-muted mb-2" />
                    <div className="h-3 w-1/2 rounded bg-muted mb-4" />
                    <div className="h-5 w-20 rounded-full bg-muted mb-3" />
                    <div className="h-1.5 w-full rounded-full bg-muted mb-4" />
                    <div className="flex justify-between">
                      <div className="h-3 w-24 rounded bg-muted" />
                      <div className="h-3 w-16 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : opportunities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                  <LayoutGrid className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground/80">No opportunities found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first opportunity to start tracking your pipeline.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {opportunities.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => router.push(`/crm/opportunities/${row.id}/edit`)}
                    className="rounded-xl border border-border/60 bg-card p-4 hover:shadow-md transition-all cursor-pointer group"
                  >
                    {/* Top: name + customer */}
                    <div className="mb-3">
                      <p className="font-medium text-[14px] truncate group-hover:text-primary transition-colors">
                        {row.title}
                      </p>
                      <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                        {row.customer_name || '—'}
                      </p>
                    </div>

                    {/* Middle: stage badge + probability bar */}
                    <div className="flex items-center gap-2 mb-3">
                      <StageBadge stage={row.stage} />
                      <div className="flex-1 flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${row.probability ?? 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {row.probability ?? 0}%
                        </span>
                      </div>
                    </div>

                    {/* Bottom: revenue + close date */}
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold">
                        {formatRevenue(row.expected_amount, undefined)}
                      </span>
                      <span className="text-muted-foreground">
                        {row.expected_close_date
                          ? new Date(row.expected_close_date).toLocaleDateString()
                          : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden p-4">
            {kanbanLoading && kanbanOpportunities.length === 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {STAGES.map((s) => (
                  <div
                    key={s}
                    className="min-w-[260px] flex-1 rounded-xl border border-border/40 p-3 animate-pulse"
                  >
                    <div className="h-4 w-24 rounded bg-muted mb-3" />
                    <div className="space-y-3">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="rounded-lg border border-border/60 bg-card p-3.5">
                          <div className="h-3.5 w-3/4 rounded bg-muted mb-2" />
                          <div className="h-3 w-1/2 rounded bg-muted mb-3" />
                          <div className="h-4 w-20 rounded bg-muted" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {kanbanColumns.map(({ stage: stageKey, items, totalRevenue }) => (
                  <div
                    key={stageKey}
                    className={`min-w-[260px] flex-1 rounded-xl border border-border/40 ${STAGE_COLUMN_BG[stageKey]} transition-colors ${
                      dragOverStage === stageKey ? 'ring-2 ring-primary/30' : ''
                    }`}
                    onDragOver={(e) => handleDragOver(e, stageKey)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, stageKey)}
                  >
                    {/* Column header */}
                    <div className="px-3 py-2.5 border-b border-border/30">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[13px] font-semibold ${STAGE_TEXT_COLOR[stageKey]}`}>
                          {STAGE_LABELS[stageKey]}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                          {items.length}
                        </span>
                      </div>
                      {totalRevenue > 0 && (
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          USD {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>

                    {/* Column cards */}
                    <div className="p-2 space-y-2 min-h-[100px]">
                      {items.length === 0 ? (
                        <div className="flex items-center justify-center py-8 text-[12px] text-muted-foreground/60">
                          No opportunities
                        </div>
                      ) : (
                        items.map((opp) => (
                          <div
                            key={opp.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, opp.id)}
                            onClick={() => router.push(`/crm/opportunities/${opp.id}/edit`)}
                            className="rounded-lg border border-border/60 bg-card p-3.5 shadow-xs cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
                          >
                            <p className="font-medium text-[13px] truncate mb-0.5">
                              {opp.title}
                            </p>
                            <p className="text-muted-foreground text-[11px] truncate mb-2.5">
                              {opp.customer_name || '—'}
                            </p>
                            <p className="text-[14px] font-bold tabular-nums mb-2">
                              {formatRevenue(opp.expected_amount, undefined)}
                            </p>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="tabular-nums">{opp.probability ?? 0}%</span>
                              <span>
                                {opp.expected_close_date
                                  ? new Date(opp.expected_close_date).toLocaleDateString()
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  )
}
