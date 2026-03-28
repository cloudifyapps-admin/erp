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
import { Trash2, Pencil, Warehouse } from 'lucide-react';

interface WarehouseItem {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  manager: string;
  capacity: number;
  status: string;
}

export default function WarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WarehouseItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/inventory/warehouses', {
        params: { page: pagination.page, page_size: pagination.pageSize, search },
      });
      const normalized = normalizePaginated<WarehouseItem>(raw);
      setWarehouses(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/inventory/warehouses/${deleteTarget.id}/`);
      toast.success('Warehouse deleted');
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Failed to delete warehouse');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Warehouse',
      render: (w: WarehouseItem) => (
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded bg-muted">
            <Warehouse className="size-4 text-muted-foreground" />
          </div>
          <div>
            <div className="font-medium text-sm">{w.name}</div>
            <div className="text-xs text-muted-foreground">{w.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: (w: WarehouseItem) => [w.city, w.country].filter(Boolean).join(', ') || '—',
    },
    { key: 'manager', label: 'Manager' },
    {
      key: 'capacity',
      label: 'Capacity',
      render: (w: WarehouseItem) => w.capacity ? w.capacity.toLocaleString() : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (w: WarehouseItem) => <StatusBadge status={w.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (w: WarehouseItem) => (
        <div className="flex gap-2 justify-end">
          <Button size="icon-sm" variant="ghost" onClick={() => router.push(`/inventory/warehouses/${w.id}/edit`)}>
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(w)}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Warehouses"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Warehouses' }]}
        createHref="/inventory/warehouses/new"
      />
      <DataTable
        columns={columns}
        data={warehouses}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
      />
      <DeleteDialog
        open={!!deleteTarget}
        title={`Delete warehouse "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
