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

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  mobile: string
  company: string
  job_title: string
  status: string
  created_at: string
}

export default function ContactsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [contacts, setContacts] = useState<Contact[]>([])
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

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/contacts', {
        params: {
          page,
          per_page: perPage,
          ...(search && { search }),
          ...(status && { status }),
          ...(sortBy && { sort_by: sortBy }),
          ...(sortDirection && { sort_direction: sortDirection }),
        },
      })
      const normalized = normalizePaginated<Contact>(raw)
      setContacts(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, sortBy, sortDirection])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const columns: ServerColumnDef<Contact>[] = [
    {
      id: 'first_name',
      header: 'Name',
      enableSorting: true,
      cell: (row) => (
        <span className="font-medium">
          {row.first_name} {row.last_name}
        </span>
      ),
    },
    {
      id: 'company',
      header: 'Company',
      cell: (row) => row.company || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'job_title',
      header: 'Job Title',
      cell: (row) => row.job_title || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'email',
      header: 'Email',
      cell: (row) => row.email || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'phone',
      header: 'Phone',
      enableSorting: false,
      cell: (row) => row.phone || row.mobile || <span className="text-muted-foreground">—</span>,
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
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'archived', label: 'Archived' },
        ],
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contacts"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Contacts' }]}
        createHref="/crm/contacts/new"
        createLabel="New Contact"
        createIcon={Plus}
      />
      <AdvancedDataTable
        title="Contacts"
        columns={columns}
        data={contacts}
        pagination={pagination}
        loading={loading}
        editBasePath="/crm/contacts"
        deleteEndpoint="/crm/contacts"
        onDelete={fetchContacts}
        emptyMessage="No contacts found"
        emptyDescription="Create your first contact to get started."
        searchPlaceholder="Search contacts..."
        storageKey="crm-contacts"
      />
    </div>
  )
}
