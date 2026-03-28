'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
  code: string;
  status: string;
  progress: number;
  manager_name: string;
  client_name: string;
  start_date: string;
  end_date: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/projects', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<Project>(raw);
      setProjects(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      key: 'name',
      label: 'Project',
      render: (p: Project) => (
        <button
          className="text-left hover:underline font-medium text-sm"
          onClick={() => router.push(`/projects/${p.id}`)}
        >
          {p.name}
          <span className="block text-xs text-muted-foreground font-normal">{p.code}</span>
        </button>
      ),
    },
    { key: 'client_name', label: 'Client' },
    { key: 'manager_name', label: 'Manager' },
    {
      key: 'progress',
      label: 'Progress',
      render: (p: Project) => (
        <div className="flex items-center gap-2 min-w-[100px]">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, p.progress ?? 0)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{p.progress ?? 0}%</span>
        </div>
      ),
    },
    {
      key: 'start_date',
      label: 'Start',
      render: (p: Project) => p.start_date ? format(new Date(p.start_date), 'MMM d, yyyy') : '—',
    },
    {
      key: 'end_date',
      label: 'Due',
      render: (p: Project) => p.end_date ? format(new Date(p.end_date), 'MMM d, yyyy') : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (p: Project) => <StatusBadge status={p.status} />,
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Planning', value: 'planning' },
    { label: 'Active', value: 'active' },
    { label: 'On Hold', value: 'on_hold' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Projects"
        breadcrumbs={[{ label: 'Projects' }]}
        createHref="/projects/new"
      />
      <DataTable
        columns={columns}
        data={projects}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
        onFilter={(val) => { setStatusFilter(val); setPagination((p) => ({ ...p, page: 1 })); }}
        filterOptions={filterOptions}
        filterLabel="Status"
      />
    </div>
  );
}
