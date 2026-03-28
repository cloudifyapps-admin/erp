'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { StatusBadge } from '@/components/shared/status-badge'

interface Task {
  id: string
  title: string
  project_id: string
  status: string
  priority: string
  assignee_name: string
  due_date: string
}

export default function TasksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    pages: 1,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: projRaw } = await api.get('/projects', { params: { page_size: 100 } })
      const projects = normalizePaginated<{ id: string; name: string }>(projRaw).items

      const allTasks: Task[] = []
      for (const proj of projects) {
        try {
          const { data: taskRaw } = await api.get(`/projects/${proj.id}/tasks`, {
            params: { page_size: 200 },
          })
          const items = normalizePaginated<Task>(taskRaw).items
          allTasks.push(...items)
        } catch { /* skip */ }
      }

      setTasks(allTasks)
      setPagination({
        page: 1,
        per_page: 25,
        total: allTasks.length,
        pages: Math.ceil(allTasks.length / 25),
      })
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const columns: ServerColumnDef<Task>[] = [
    {
      id: 'title',
      header: 'Task',
      cell: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (row) => <span className="capitalize">{row.priority}</span>,
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
          { value: 'todo', label: 'To Do' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'review', label: 'Review' },
          { value: 'done', label: 'Done' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    },
    {
      id: 'assignee_name',
      header: 'Assignee',
      enableSorting: false,
      cell: (row) =>
        row.assignee_name || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: (row) =>
        row.due_date
          ? new Date(row.due_date).toLocaleDateString()
          : '—',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tasks"
        breadcrumbs={[{ label: 'Projects' }, { label: 'Tasks' }]}
      />
      <AdvancedDataTable
        title="Tasks"
        columns={columns}
        data={tasks}
        pagination={pagination}
        loading={loading}
        emptyMessage="No tasks found"
        emptyDescription="Tasks will appear here once projects have tasks."
        searchPlaceholder="Search tasks..."
        storageKey="projects-tasks"
      />
    </div>
  )
}
