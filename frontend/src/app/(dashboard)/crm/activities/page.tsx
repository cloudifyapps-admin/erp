'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { format } from 'date-fns';

interface Activity {
  id: string;
  type: string;
  subject: string;
  description: string;
  related_to_type: string;
  related_to_id: string;
  due_date: string;
  status: string;
  assigned_to_name: string;
  created_at: string;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/crm/activities', {
        params: { page: pagination.page, page_size: pagination.pageSize, search },
      });
      const normalized = normalizePaginated<Activity>(raw);
      setActivities(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (a: Activity) => (
        <span className="capitalize text-sm">{a.type?.replace(/_/g, ' ')}</span>
      ),
    },
    { key: 'subject', label: 'Subject' },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (a: Activity) => a.due_date ? format(new Date(a.due_date), 'MMM d, yyyy') : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (a: Activity) => <StatusBadge status={a.status} />,
    },
    { key: 'assigned_to_name', label: 'Assigned To' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Activities"
        breadcrumbs={[{ label: 'CRM' }, { label: 'Activities' }]}
        createHref="/crm/activities/new"
      />
      <DataTable
        columns={columns}
        data={activities}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
      />
    </div>
  );
}
