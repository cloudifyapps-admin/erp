'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

interface Task {
  id: string;
  title: string;
  project_id: string;
  status: string;
  priority: string;
  assignee_name: string;
  due_date: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all projects to get tasks across projects
      const { data: projRaw } = await api.get('/projects', { params: { page_size: 100 } });
      const projects = normalizePaginated<{ id: string; name: string }>(projRaw).items;

      const allTasks: Task[] = [];
      for (const proj of projects) {
        try {
          const { data: taskRaw } = await api.get(`/projects/${proj.id}/tasks`, {
            params: { page_size: 200 },
          });
          const items = normalizePaginated<Task>(taskRaw).items;
          allTasks.push(...items);
        } catch { /* skip */ }
      }

      setTasks(allTasks);
      setPagination((p) => ({ ...p, total: allTasks.length }));
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'title', label: 'Task' },
    {
      key: 'priority',
      label: 'Priority',
      render: (t: Task) => (
        <span className="capitalize text-sm">{t.priority}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (t: Task) => <StatusBadge status={t.status} />,
    },
    { key: 'assignee_name', label: 'Assignee' },
    { key: 'due_date', label: 'Due Date' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Tasks"
        breadcrumbs={[{ label: 'Projects' }, { label: 'Tasks' }]}
      />
      <DataTable
        columns={columns}
        data={tasks}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
      />
    </div>
  );
}
