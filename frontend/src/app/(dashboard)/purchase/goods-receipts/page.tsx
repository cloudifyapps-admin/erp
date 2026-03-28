'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { format } from 'date-fns';

interface GoodsReceipt {
  id: string;
  number: string;
  po_number: string;
  vendor_name: string;
  received_by: string;
  received_date: string;
  warehouse: string;
  status: string;
}

export default function GoodsReceiptsPage() {
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/purchase/goods-receipts', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<GoodsReceipt>(raw);
      setReceipts(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load goods receipts');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'number', label: 'GR Number' },
    { key: 'po_number', label: 'PO Number' },
    { key: 'vendor_name', label: 'Vendor' },
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'received_by', label: 'Received By' },
    {
      key: 'received_date',
      label: 'Date',
      render: (r: GoodsReceipt) => r.received_date ? format(new Date(r.received_date), 'MMM d, yyyy') : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: GoodsReceipt) => <StatusBadge status={r.status} />,
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Received', value: 'received' },
    { label: 'Partial', value: 'partial' },
    { label: 'Closed', value: 'closed' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Goods Receipts"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Goods Receipts' }]}
        createHref="/purchase/goods-receipts/new"
      />
      <DataTable
        columns={columns}
        data={receipts}
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
