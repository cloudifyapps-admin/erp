'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { format } from 'date-fns';

interface StockAdjustment {
  id: string;
  reference: string;
  warehouse_name: string;
  reason: string;
  adjusted_by: string;
  total_items: number;
  status: string;
  notes: string;
  created_at: string;
}

export default function StockAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/inventory/stock-adjustments', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<StockAdjustment>(raw);
      setAdjustments(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load stock adjustments');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'reference', label: 'Reference' },
    { key: 'warehouse_name', label: 'Warehouse' },
    { key: 'reason', label: 'Reason' },
    { key: 'total_items', label: 'Items', render: (a: StockAdjustment) => a.total_items?.toLocaleString() ?? '—' },
    { key: 'adjusted_by', label: 'Adjusted By' },
    {
      key: 'created_at',
      label: 'Date',
      render: (a: StockAdjustment) => format(new Date(a.created_at), 'MMM d, yyyy'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (a: StockAdjustment) => <StatusBadge status={a.status} />,
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Posted', value: 'posted' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Stock Adjustments"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Adjustments' }]}
        createHref="/inventory/stock-adjustments/new"
      />
      <DataTable
        columns={columns}
        data={adjustments}
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
