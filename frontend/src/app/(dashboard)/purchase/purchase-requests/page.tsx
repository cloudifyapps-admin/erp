'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface PurchaseRequest {
  id: string;
  number: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  requested_by: string;
  department: string;
  required_by: string;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function PurchaseRequestsPage() {
  const [prs, setPrs] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/purchase/purchase-requests', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<PurchaseRequest>(raw);
      setPrs(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load purchase requests');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'number', label: 'PR Number' },
    { key: 'title', label: 'Title' },
    {
      key: 'priority',
      label: 'Priority',
      render: (r: PurchaseRequest) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[r.priority] ?? 'bg-gray-100 text-gray-700'}`}>
          {r.priority}
        </span>
      ),
    },
    { key: 'requested_by', label: 'Requested By' },
    { key: 'department', label: 'Department' },
    {
      key: 'required_by',
      label: 'Required By',
      render: (r: PurchaseRequest) => r.required_by ? format(new Date(r.required_by), 'MMM d, yyyy') : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: PurchaseRequest) => <StatusBadge status={r.status} />,
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Pending Approval', value: 'pending_approval' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Ordered', value: 'ordered' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Purchase Requests"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Purchase Requests' }]}
        createHref="/purchase/purchase-requests/new"
      />
      <DataTable
        columns={columns}
        data={prs}
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
