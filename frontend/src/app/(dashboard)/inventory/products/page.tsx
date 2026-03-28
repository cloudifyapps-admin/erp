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
import { Trash2, Pencil } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  type: string;
  price: number;
  currency: string;
  unit: string;
  status: string;
  category: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/inventory/products', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, type: typeFilter || undefined },
      });
      const normalized = normalizePaginated<Product>(raw);
      setProducts(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/inventory/products/${deleteTarget.id}/`);
      toast.success('Product deleted');
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const columns = [
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    {
      key: 'type',
      label: 'Type',
      render: (p: Product) => (
        <span className="capitalize text-sm">{p.type?.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      render: (p: Product) => (
        <span className="tabular-nums">{p.currency ?? 'USD'} {Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      ),
    },
    { key: 'unit', label: 'Unit' },
    {
      key: 'status',
      label: 'Status',
      render: (p: Product) => <StatusBadge status={p.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (p: Product) => (
        <div className="flex gap-2 justify-end">
          <Button size="icon-sm" variant="ghost" onClick={() => router.push(`/inventory/products/${p.id}/edit`)}>
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(p)}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const filterOptions = [
    { label: 'All Types', value: '' },
    { label: 'Finished Good', value: 'finished_good' },
    { label: 'Raw Material', value: 'raw_material' },
    { label: 'Service', value: 'service' },
    { label: 'Consumable', value: 'consumable' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Products"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Products' }]}
        createHref="/inventory/products/new"
      />
      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
        onFilter={(val) => { setTypeFilter(val); setPagination((p) => ({ ...p, page: 1 })); }}
        filterOptions={filterOptions}
        filterLabel="Type"
      />
      <DeleteDialog
        open={!!deleteTarget}
        title={`Delete product "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
