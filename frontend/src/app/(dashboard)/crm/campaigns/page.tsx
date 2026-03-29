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

interface Campaign {
  id: string
  code: string
  name: string
  type: string
  status: string
  start_date: string
  end_date: string
  budget: number | null
  expected_revenue: number | null
  created_at: string
}

const formatCurrency = (value: number | null) => {
  if (value == null) return <span className="text-muted-foreground">—</span>
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatDate = (value: string | null) => {
  if (!value) return <span className="text-muted-foreground">—</span>
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function CampaignsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
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

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/campaigns', {
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
      const normalized = normalizePaginated<Campaign>(raw)
      setCampaigns(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, type, sortBy, sortDirection])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const columns: ServerColumnDef<Campaign>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (row) => (
        <span className="font-medium">{row.code}</span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <span className="font-medium">{row.name}</span>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) =>
        row.type ? (
          <span className="capitalize">{row.type.replace(/_/g, ' ')}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      meta: {
        filterType: 'select',
        filterKey: 'type',
        filterPlaceholder: 'All Types',
        filterOptions: [
          { value: 'email', label: 'Email' },
          { value: 'event', label: 'Event' },
          { value: 'webinar', label: 'Webinar' },
          { value: 'advertising', label: 'Advertising' },
          { value: 'social_media', label: 'Social Media' },
          { value: 'other', label: 'Other' },
        ],
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
          { value: 'draft', label: 'Draft' },
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
    {
      id: 'start_date',
      header: 'Start Date',
      cell: (row) => formatDate(row.start_date),
    },
    {
      id: 'end_date',
      header: 'End Date',
      cell: (row) => formatDate(row.end_date),
    },
    {
      id: 'budget',
      header: 'Budget',
      cell: (row) => formatCurrency(row.budget),
    },
    {
      id: 'expected_revenue',
      header: 'Expected Revenue',
      cell: (row) => formatCurrency(row.expected_revenue),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Campaigns"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Campaigns' }]}
        createHref="/crm/campaigns/new"
        createLabel="New Campaign"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Campaigns"
        columns={columns}
        data={campaigns}
        pagination={pagination}
        loading={loading}
        editBasePath="/crm/campaigns"
        deleteEndpoint="/crm/campaigns"
        onDelete={fetchCampaigns}
        emptyMessage="No campaigns found"
        emptyDescription="Create your first campaign to get started."
        searchPlaceholder="Search campaigns..."
        storageKey="crm-campaigns"
      />
    </div>
  )
}
