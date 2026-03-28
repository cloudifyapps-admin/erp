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

interface Ticket {
  id: string
  number: string
  title: string
  priority: string
  status: string
  category: string
  assignee_name: string
  requester_name: string
  created_at: string
  updated_at: string
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-slate-100', text: 'text-slate-700' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  critical: { bg: 'bg-red-100', text: 'text-red-700' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
}

export default function TicketsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tickets, setTickets] = useState<Ticket[]>([])
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

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/tickets', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Ticket>(raw)
      setTickets(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const columns: ServerColumnDef<Ticket>[] = [
    {
      id: 'number',
      header: '#',
      cell: (row) => (
        <span className="font-mono font-medium text-primary">{row.number}</span>
      ),
    },
    {
      id: 'title',
      header: 'Title',
      cell: (row) => (
        <span className="font-medium truncate max-w-xs block">{row.title}</span>
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (row) => {
        const style = PRIORITY_STYLES[row.priority] ?? { bg: 'bg-gray-100', text: 'text-gray-700' }
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${style.bg} ${style.text}`}>
            {row.priority}
          </span>
        )
      },
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
          { value: 'open', label: 'Open' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'pending', label: 'Pending' },
          { value: 'resolved', label: 'Resolved' },
          { value: 'closed', label: 'Closed' },
        ],
      },
    },
    {
      id: 'category',
      header: 'Category',
      cell: (row) => (
        <span className="capitalize">{row.category?.replace('_', ' ') ?? '—'}</span>
      ),
    },
    {
      id: 'assignee_name',
      header: 'Assignee',
      enableSorting: false,
      cell: (row) =>
        row.assignee_name || <span className="text-muted-foreground">Unassigned</span>,
    },
    {
      id: 'requester_name',
      header: 'Requester',
      cell: (row) =>
        row.requester_name || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'created_at',
      header: 'Created',
      cell: (row) =>
        row.created_at
          ? new Date(row.created_at).toLocaleDateString()
          : '—',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tickets"
        breadcrumbs={[{ label: 'Support' }, { label: 'Tickets' }]}
        createHref="/tickets/new"
        createLabel="New Ticket"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Tickets"
        columns={columns}
        data={tickets}
        pagination={pagination}
        loading={loading}
        editBasePath="/tickets"
        deleteEndpoint="/tickets"
        onDelete={fetchData}
        emptyMessage="No tickets found"
        emptyDescription="Create your first ticket to get started."
        searchPlaceholder="Search tickets..."
        storageKey="tickets"
      />
    </div>
  )
}
