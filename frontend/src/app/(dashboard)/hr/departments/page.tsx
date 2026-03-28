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

interface Department {
  id: string;
  name: string;
  code: string;
  head_name: string;
  parent_name: string;
  employee_count: number;
  status: string;
}

export default function DepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/hr/departments', {
        params: { page: pagination.page, page_size: pagination.pageSize, search },
      });
      const normalized = normalizePaginated<Department>(raw);
      setDepartments(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/hr/departments/${deleteTarget.id}/`);
      toast.success('Department deleted');
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Failed to delete department');
    }
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Department' },
    { key: 'parent_name', label: 'Parent', render: (d: Department) => d.parent_name ?? '—' },
    { key: 'head_name', label: 'Head', render: (d: Department) => d.head_name ?? '—' },
    { key: 'employee_count', label: 'Employees', render: (d: Department) => d.employee_count?.toLocaleString() ?? 0 },
    { key: 'status', label: 'Status', render: (d: Department) => <StatusBadge status={d.status} /> },
    {
      key: 'actions',
      label: '',
      render: (d: Department) => (
        <div className="flex gap-2 justify-end">
          <Button size="icon-sm" variant="ghost" onClick={() => router.push(`/hr/departments/${d.id}/edit`)}>
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(d)}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Departments"
        breadcrumbs={[{ label: 'HR' }, { label: 'Departments' }]}
        createHref="/hr/departments/new"
      />
      <DataTable
        columns={columns}
        data={departments}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
      />
      <DeleteDialog
        open={!!deleteTarget}
        title={`Delete department "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
