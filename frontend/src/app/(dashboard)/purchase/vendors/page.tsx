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

interface Vendor {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  status: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/purchase/vendors', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<Vendor>(raw);
      setVendors(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/purchase/vendors/${deleteTarget.id}/`);
      toast.success('Vendor deleted');
      setDeleteTarget(null);
      fetchVendors();
    } catch {
      toast.error('Failed to delete vendor');
    }
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'status',
      label: 'Status',
      render: (v: Vendor) => <StatusBadge status={v.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (v: Vendor) => (
        <div className="flex gap-2 justify-end">
          <Button size="icon-sm" variant="ghost" onClick={() => router.push(`/purchase/vendors/${v.id}/edit`)}>
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(v)}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Vendors"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Vendors' }]}
        createHref="/purchase/vendors/new"
      />
      <DataTable
        columns={columns}
        data={vendors}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
        onFilter={(val) => { setStatusFilter(val); setPagination((p) => ({ ...p, page: 1 })); }}
        filterOptions={filterOptions}
        filterLabel="Status"
      />
      <DeleteDialog
        open={!!deleteTarget}
        title={`Delete vendor "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
