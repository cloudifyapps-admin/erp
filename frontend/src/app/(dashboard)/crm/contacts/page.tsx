'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type ColumnDef } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { FilterBar } from '@/components/shared/filter-bar'

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

interface PaginatedResponse {
  items: Contact[]
  count: number
  page: number
  per_page: number
  pages: number
}

export default function ContactsPage() {
  const searchParams = useSearchParams()
  const [contacts, setContacts] = useState<Contact[]>([])
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

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const { data: raw } = await api.get('/crm/contacts', {
        params: {
          page,
          per_page: 25,
          ...(search && { search }),
          ...(status && { status }),
        },
      })
      const normalized = normalizePaginated<Contact>(raw)
      setContacts(normalized.items)
      setPagination({
        page: normalized.page,
        per_page: normalized.per_page,
        total: normalized.total,
        total_pages: normalized.pages,
      })
    } catch {
      toast.error('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const columns: ColumnDef<Contact>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => (
        <span className="font-medium">
          {row.first_name} {row.last_name}
        </span>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      cell: (row) => row.company || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'job_title',
      header: 'Job Title',
      cell: (row) => row.job_title || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'email',
      header: 'Email',
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (row) => row.phone || row.mobile || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Contacts"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Contacts' }]}
        createHref="/crm/contacts/new"
        createLabel="New Contact"
        createIcon={Plus}
      />
      <FilterBar
        searchPlaceholder="Search contacts..."
        filters={[
          {
            key: 'status',
            placeholder: 'All Statuses',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'archived', label: 'Archived' },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={contacts}
        pagination={pagination}
        loading={loading}
        editBasePath="/crm/contacts"
        deleteEndpoint="/crm/contacts"
        onDelete={fetchContacts}
        emptyMessage="No contacts found"
        emptyDescription="Create your first contact to get started."
      />
    </div>
  )
}
