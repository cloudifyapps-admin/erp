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

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  department_name: string;
  designation: string;
  employment_type: string;
  date_of_joining: string;
  status: string;
}

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/hr/employees', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<Employee>(raw);
      setEmployees(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/hr/employees/${deleteTarget.id}/`);
      toast.success('Employee record deleted');
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Failed to delete employee');
    }
  };

  const columns = [
    { key: 'employee_id', label: 'Employee ID' },
    {
      key: 'full_name',
      label: 'Name',
      render: (e: Employee) => (
        <div>
          <div className="font-medium text-sm">{e.full_name}</div>
          <div className="text-xs text-muted-foreground">{e.email}</div>
        </div>
      ),
    },
    { key: 'department_name', label: 'Department' },
    { key: 'designation', label: 'Designation' },
    {
      key: 'employment_type',
      label: 'Type',
      render: (e: Employee) => (
        <span className="capitalize text-sm">{e.employment_type?.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (e: Employee) => <StatusBadge status={e.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (e: Employee) => (
        <div className="flex gap-2 justify-end">
          <Button size="icon-sm" variant="ghost" onClick={() => router.push(`/hr/employees/${e.id}/edit`)}>
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(e)}>
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
    { label: 'On Leave', value: 'on_leave' },
    { label: 'Terminated', value: 'terminated' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Employees"
        breadcrumbs={[{ label: 'HR' }, { label: 'Employees' }]}
        createHref="/hr/employees/new"
      />
      <DataTable
        columns={columns}
        data={employees}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
        onFilter={(val) => { setStatusFilter(val); setPagination((p) => ({ ...p, page: 1 })); }}
        filterOptions={filterOptions}
        filterLabel="Status"
      />
      <DeleteDialog
        open={!!deleteTarget}
        title={`Delete employee "${deleteTarget?.full_name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
