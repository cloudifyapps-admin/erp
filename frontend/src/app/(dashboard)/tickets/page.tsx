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

interface Ticket {
  id: string;
  number: string;
  title: string;
  priority: string;
  status: string;
  category: string;
  assignee_name: string;
  requester_name: string;
  created_at: string;
  updated_at: string;
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-slate-100', text: 'text-slate-700' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  critical: { bg: 'bg-red-100', text: 'text-red-700' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/tickets', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<Ticket>(raw);
      setTickets(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      key: 'number',
      label: '#',
      render: (t: Ticket) => (
        <button
          className="font-mono text-sm font-medium text-primary hover:underline"
          onClick={() => router.push(`/tickets/${t.id}`)}
        >
          {t.number}
        </button>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (t: Ticket) => (
        <button
          className="text-left text-sm hover:underline font-medium max-w-xs truncate block"
          onClick={() => router.push(`/tickets/${t.id}`)}
        >
          {t.title}
        </button>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (t: Ticket) => {
        const style = PRIORITY_STYLES[t.priority] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${style.bg} ${style.text}`}>
            {t.priority}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (t: Ticket) => <StatusBadge status={t.status} />,
    },
    { key: 'category', label: 'Category', render: (t: Ticket) => <span className="capitalize text-sm">{t.category?.replace('_', ' ') ?? '—'}</span> },
    { key: 'assignee_name', label: 'Assignee', render: (t: Ticket) => t.assignee_name ?? 'Unassigned' },
    { key: 'requester_name', label: 'Requester' },
    {
      key: 'created_at',
      label: 'Created',
      render: (t: Ticket) => format(new Date(t.created_at), 'MMM d, yyyy'),
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Pending', value: 'pending' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'Closed', value: 'closed' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Tickets"
        breadcrumbs={[{ label: 'Support' }, { label: 'Tickets' }]}
        createHref="/tickets/new"
      />
      <DataTable
        columns={columns}
        data={tickets}
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
