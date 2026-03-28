'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';

interface StockTransfer {
  id: string;
  reference: string;
  source_warehouse: string;
  destination_warehouse: string;
  total_items: number;
  transferred_by: string;
  transfer_date: string;
  status: string;
  notes: string;
}

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/inventory/stock-transfers', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<StockTransfer>(raw);
      setTransfers(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load stock transfers');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'reference', label: 'Reference' },
    {
      key: 'route',
      label: 'Route',
      render: (t: StockTransfer) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span>{t.source_warehouse}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span>{t.destination_warehouse}</span>
        </span>
      ),
    },
    { key: 'total_items', label: 'Items', render: (t: StockTransfer) => t.total_items?.toLocaleString() ?? '—' },
    { key: 'transferred_by', label: 'Transferred By' },
    {
      key: 'transfer_date',
      label: 'Date',
      render: (t: StockTransfer) => t.transfer_date ? format(new Date(t.transfer_date), 'MMM d, yyyy') : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (t: StockTransfer) => <StatusBadge status={t.status} />,
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'In Transit', value: 'in_transit' },
    { label: 'Received', value: 'received' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Stock Transfers"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Transfers' }]}
        createHref="/inventory/stock-transfers/new"
      />
      <DataTable
        columns={columns}
        data={transfers}
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
