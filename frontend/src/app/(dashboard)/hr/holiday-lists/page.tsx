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

interface Holiday {
  id: string
  name: string
  date: string
  type: string
  description: string
  applicable_to: string
}

const HOLIDAY_TYPE_COLORS: Record<string, string> = {
  national: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  optional: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  company: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

export default function HolidayListsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [holidays, setHolidays] = useState<Holiday[]>([])
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
  const type = searchParams.get('type') ?? ''
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  const fetchHolidays = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/hr/holiday-lists', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(type && { type }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Holiday>(raw)
      setHolidays(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load holidays')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, type, sortBy, sortDirection])

  useEffect(() => {
    fetchHolidays()
  }, [fetchHolidays])

  const columns: ServerColumnDef<Holiday>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: (row) => (
        <span>
          {new Date(row.date).toLocaleDateString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
            HOLIDAY_TYPE_COLORS[row.type] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          {row.type}
        </span>
      ),
      meta: {
        filterType: 'select',
        filterKey: 'type',
        filterPlaceholder: 'All Types',
        filterOptions: [
          { value: 'national', label: 'National' },
          { value: 'optional', label: 'Optional' },
          { value: 'company', label: 'Company' },
        ],
      },
    },
    {
      id: 'applicable_to',
      header: 'Applicable To',
      cell: (row) =>
        row.applicable_to || <span className="text-muted-foreground">All</span>,
    },
    {
      id: 'description',
      header: 'Description',
      enableSorting: false,
      cell: (row) => (
        <span className="text-muted-foreground truncate max-w-[250px] inline-block">
          {row.description || '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Holiday Lists"
        breadcrumbs={[{ label: 'HR' }, { label: 'Holiday Lists' }]}
        createHref="/hr/holiday-lists/new"
        createLabel="New Holiday"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Holiday Lists"
        columns={columns}
        data={holidays}
        pagination={pagination}
        loading={loading}
        emptyMessage="No holidays found"
        emptyDescription="Add your first holiday to get started."
        searchPlaceholder="Search holidays..."
        storageKey="hr-holiday-lists"
      />
    </div>
  )
}
