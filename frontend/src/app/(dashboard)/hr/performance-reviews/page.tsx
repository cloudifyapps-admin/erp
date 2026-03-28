'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Star } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { StatusBadge } from '@/components/shared/status-badge'

interface PerformanceReview {
  id: string
  employee_name: string
  employee_id: string
  reviewer_name: string
  department_name: string
  review_period: string
  overall_rating: number
  status: string
  due_date: string
  completed_at: string
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-muted text-muted-foreground/30'
          }`}
        />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
        {rating > 0 ? rating.toFixed(1) : '—'}
      </span>
    </div>
  )
}

export default function PerformanceReviewsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
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

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/hr/performance-reviews', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<PerformanceReview>(raw)
      setReviews(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load performance reviews')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const columns: ServerColumnDef<PerformanceReview>[] = [
    {
      id: 'employee_name',
      header: 'Employee',
      enableSorting: false,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.employee_name}</div>
          <div className="text-xs text-muted-foreground">{row.department_name}</div>
        </div>
      ),
    },
    {
      id: 'review_period',
      header: 'Period',
      cell: (row) => row.review_period || '—',
    },
    {
      id: 'reviewer_name',
      header: 'Reviewer',
      enableSorting: false,
      cell: (row) =>
        row.reviewer_name || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'overall_rating',
      header: 'Rating',
      enableSorting: false,
      cell: (row) => <RatingStars rating={row.overall_rating ?? 0} />,
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: (row) =>
        row.due_date ? new Date(row.due_date).toLocaleDateString() : '—',
    },
    {
      id: 'completed_at',
      header: 'Completed',
      cell: (row) =>
        row.completed_at ? new Date(row.completed_at).toLocaleDateString() : '—',
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
          { value: 'in_progress', label: 'In Progress' },
          { value: 'pending_approval', label: 'Pending Approval' },
          { value: 'completed', label: 'Completed' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Performance Reviews"
        breadcrumbs={[{ label: 'HR' }, { label: 'Performance Reviews' }]}
        createHref="/hr/performance-reviews/new"
        createLabel="New Review"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Performance Reviews"
        columns={columns}
        data={reviews}
        pagination={pagination}
        loading={loading}
        editBasePath="/hr/performance-reviews"
        onDelete={fetchReviews}
        emptyMessage="No performance reviews found"
        emptyDescription="Create your first performance review to get started."
        searchPlaceholder="Search reviews..."
        storageKey="hr-performance-reviews"
      />
    </div>
  )
}
