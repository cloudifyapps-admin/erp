'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type ColumnDef } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { FilterBar } from '@/components/shared/filter-bar'

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

interface PaginatedResponse {
  items: Lead[]
  total: number
  page: number
  per_page: number
  pages: number
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
    total_pages: 1,
  })

  const page = Number(searchParams.get('page') ?? 1)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/leads', {
        params: {
          page,
          per_page: 25,
          ...(search && { search }),
          ...(status && { status }),
        },
      })
      const normalized = normalizePaginated<Lead>(raw)
      setLeads(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        total_pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const columns: ColumnDef<Lead>[] = [
    {
      key: 'title',
      header: 'Title',
      cell: (row) => (
        <span className="font-medium">{row.title || `${row.first_name} ${row.last_name}`}</span>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      cell: (row) => row.company || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'email',
      header: 'Email',
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (row) => row.phone || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'source',
      header: 'Source',
      cell: (row) =>
        row.source ? (
          <span className="capitalize">{row.source.replace(/_/g, ' ')}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'assigned_to_name',
      header: 'Assigned To',
      cell: (row) =>
        row.assigned_to_name || <span className="text-muted-foreground">—</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Leads"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Leads' }]}
        createHref="/crm/leads/new"
        createLabel="New Lead"
        createIcon={Plus}
      />
      <FilterBar
        searchPlaceholder="Search leads..."
        filters={[
          {
            key: 'status',
            placeholder: 'All Statuses',
            options: [
              { value: 'new', label: 'New' },
              { value: 'qualified', label: 'Qualified' },
              { value: 'converted', label: 'Converted' },
              { value: 'lost', label: 'Lost' },
              { value: 'rejected', label: 'Rejected' },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={leads}
        pagination={pagination}
        loading={loading}
        editBasePath="/crm/leads"
        deleteEndpoint="/crm/leads"
        onDelete={fetchLeads}
        emptyMessage="No leads found"
        emptyDescription="Create your first lead to get started."
      />
    </div>
  )
}
