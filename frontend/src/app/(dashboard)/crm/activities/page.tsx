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

interface Activity {
  id: string
  type: string
  subject: string
  description: string
  related_to_type: string
  related_to_id: string
  due_date: string
  status: string
  assigned_to_name: string
  created_at: string
}

export default function ActivitiesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activities, setActivities] = useState<Activity[]>([])
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

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/activities', {
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
      const normalized = normalizePaginated<Activity>(raw)
      setActivities(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load activities')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, type, sortBy, sortDirection])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const columns: ServerColumnDef<Activity>[] = [
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <span className="capitalize text-sm">{row.type?.replace(/_/g, ' ')}</span>
      ),
      meta: {
        filterType: 'select',
        filterKey: 'type',
        filterPlaceholder: 'All Types',
        filterOptions: [
          { value: 'call', label: 'Call' },
          { value: 'email', label: 'Email' },
          { value: 'meeting', label: 'Meeting' },
          { value: 'task', label: 'Task' },
          { value: 'note', label: 'Note' },
          { value: 'follow_up', label: 'Follow Up' },
          { value: 'demo', label: 'Demo' },
        ],
      },
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (row) => row.subject || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: (row) =>
        row.due_date
          ? new Date(row.due_date).toLocaleDateString()
          : <span className="text-muted-foreground">—</span>,
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
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'overdue', label: 'Overdue' },
        ],
      },
    },
    {
      id: 'assigned_to_name',
      header: 'Assigned To',
      enableSorting: false,
      cell: (row) => row.assigned_to_name || <span className="text-muted-foreground">—</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Activities"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Activities' }]}
        createHref="/crm/activities/new"
        createLabel="New Activity"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Activities"
        columns={columns}
        data={activities}
        pagination={pagination}
        loading={loading}
        editBasePath="/crm/activities"
        deleteEndpoint="/crm/activities"
        onDelete={fetchActivities}
        emptyMessage="No activities found"
        emptyDescription="Create your first activity to get started."
        searchPlaceholder="Search activities..."
        storageKey="crm-activities"
      />
    </div>
  )
}
