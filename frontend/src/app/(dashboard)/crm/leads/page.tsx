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
  assigned_to_name?: string
  created_at: string
}

export default function LeadsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
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

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/leads', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
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
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const columns: ServerColumnDef<Lead>[] = [
    {
      id: 'title',
      header: 'Title',
      cell: (row) => (
        <span className="font-medium">
          {row.title || `${row.first_name} ${row.last_name}`}
        </span>
      ),
    },
    {
      id: 'company',
      header: 'Company',
      cell: (row) =>
        row.company || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'email',
      header: 'Email',
      cell: (row) => (
        <span className="text-muted-foreground">{row.email}</span>
      ),
    },
    {
      id: 'phone',
      header: 'Phone',
      cell: (row) =>
        row.phone || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'source',
      header: 'Source',
      cell: (row) =>
        row.source ? (
          <span className="capitalize">{row.source.replace(/_/g, ' ')}</span>
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
          { value: 'new', label: 'New' },
          { value: 'qualified', label: 'Qualified' },
          { value: 'converted', label: 'Converted' },
          { value: 'lost', label: 'Lost' },
          { value: 'rejected', label: 'Rejected' },
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
  ]

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
      />
    </div>
  )
}
