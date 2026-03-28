'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { DeleteDialog } from '@/components/shared/delete-dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface PurchaseOrder {
  id: string;
  number: string;
  vendor_name: string;
  total_amount: number;
  currency: string;
  status: string;
  order_date: string;
  expected_delivery: string;
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/purchase/purchase-orders', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<PurchaseOrder>(raw);
      setOrders(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/purchase/purchase-orders/${deleteTarget.id}/`);
      toast.success('Purchase order deleted');
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Failed to delete purchase order');
    }
  };

  const columns = [
    { key: 'number', label: 'PO Number' },
    { key: 'vendor_name', label: 'Vendor' },
    {
      key: 'order_date',
      label: 'Order Date',
      render: (o: PurchaseOrder) => o.order_date ? format(new Date(o.order_date), 'MMM d, yyyy') : '—',
    },
    {
      key: 'expected_delivery',
      label: 'Expected Delivery',
      render: (o: PurchaseOrder) => o.expected_delivery ? format(new Date(o.expected_delivery), 'MMM d, yyyy') : '—',
    },
    {
      key: 'total_amount',
      label: 'Total',
      render: (o: PurchaseOrder) => (
        <span className="font-medium tabular-nums">
          {o.currency} {Number(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (o: PurchaseOrder) => <StatusBadge status={o.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (o: PurchaseOrder) => (
        <div className="flex gap-2 justify-end">
          <Button size="icon-sm" variant="ghost" onClick={() => router.push(`/purchase/purchase-orders/${o.id}`)}>
            <Eye />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(o)}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Sent', value: 'sent' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Received', value: 'received' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Purchase Orders"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Purchase Orders' }]}
        createHref="/purchase/purchase-orders/new"
      />
      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
        onFilter={(val) => { setStatusFilter(val); setPagination((p) => ({ ...p, page: 1 })); }}
        filterOptions={filterOptions}
        filterLabel="Status"
      />
      <DeleteDialog
        open={!!deleteTarget}
        title={`Delete PO "${deleteTarget?.number}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
