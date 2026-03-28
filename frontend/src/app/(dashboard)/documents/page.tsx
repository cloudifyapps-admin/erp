'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileCode,
  File,
} from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'

interface Document {
  id: string
  name: string
  file_name: string
  file_type: string
  file_size: number
  category: string
  uploaded_by: string
  related_to: string
  related_id: string
  description: string
  created_at: string
  url: string
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="size-4 text-red-500" />,
  doc: <FileText className="size-4 text-blue-500" />,
  docx: <FileText className="size-4 text-blue-500" />,
  xls: <FileSpreadsheet className="size-4 text-green-500" />,
  xlsx: <FileSpreadsheet className="size-4 text-green-500" />,
  csv: <FileSpreadsheet className="size-4 text-green-600" />,
  png: <FileImage className="size-4 text-purple-500" />,
  jpg: <FileImage className="size-4 text-purple-500" />,
  jpeg: <FileImage className="size-4 text-purple-500" />,
  svg: <FileImage className="size-4 text-indigo-500" />,
  js: <FileCode className="size-4 text-yellow-500" />,
  ts: <FileCode className="size-4 text-blue-600" />,
}

function formatBytes(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [docs, setDocs] = useState<Document[]>([])
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
  const category = searchParams.get('category') ?? ''
  const sortBy = searchParams.get('sort_by') ?? ''
  const sortDirection = searchParams.get('sort_direction') ?? ''

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/documents', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(category && { category }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Document>(raw)
      setDocs(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, category, sortBy, sortDirection])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getExtension = (fileName: string) =>
    fileName?.split('.').pop()?.toLowerCase() ?? ''

  const columns: ServerColumnDef<Document>[] = [
    {
      id: 'name',
      header: 'Name',
      enableSorting: false,
      cell: (row) => {
        const ext = getExtension(row.file_name)
        const icon = FILE_ICONS[ext] ?? <File className="size-4 text-muted-foreground" />
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded border bg-muted/50 shrink-0">
              {icon}
            </div>
            <div>
              <div className="font-medium text-sm">{row.name}</div>
              <div className="text-xs text-muted-foreground">{row.file_name}</div>
            </div>
          </div>
        )
      },
    },
    {
      id: 'category',
      header: 'Category',
      cell: (row) => (
        <span className="capitalize">{row.category?.replace('_', ' ') ?? '—'}</span>
      ),
      meta: {
        filterType: 'select',
        filterKey: 'category',
        filterPlaceholder: 'All Categories',
        filterOptions: [
          { value: 'contract', label: 'Contract' },
          { value: 'invoice', label: 'Invoice' },
          { value: 'report', label: 'Report' },
          { value: 'proposal', label: 'Proposal' },
          { value: 'other', label: 'Other' },
        ],
      },
    },
    {
      id: 'related_to',
      header: 'Related To',
      cell: (row) =>
        row.related_to || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'file_size',
      header: 'Size',
      cell: (row) => formatBytes(row.file_size),
    },
    {
      id: 'uploaded_by',
      header: 'Uploaded By',
      enableSorting: false,
      cell: (row) =>
        row.uploaded_by || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'created_at',
      header: 'Date',
      cell: (row) =>
        row.created_at
          ? new Date(row.created_at).toLocaleDateString()
          : '—',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Documents"
        breadcrumbs={[{ label: 'Documents' }]}
        createHref="/documents/upload"
        createLabel="Upload"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Documents"
        columns={columns}
        data={docs}
        pagination={pagination}
        loading={loading}
        deleteEndpoint="/documents"
        onDelete={fetchData}
        emptyMessage="No documents found"
        emptyDescription="Upload your first document to get started."
        searchPlaceholder="Search documents..."
        storageKey="documents"
      />
    </div>
  )
}
