'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ExpenseClaim {
  id: string;
  claim_number: string;
  employee_name: string;
  department_name: string;
  title: string;
  category: string;
  total_amount: number;
  currency: string;
  expense_date: string;
  status: string;
  submitted_at: string;
}

export default function ExpenseClaimsPage() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/hr/expense-claims', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<ExpenseClaim>(raw);
      setClaims(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load expense claims');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(`${id}-${action}`);
    try {
      await api.post(`/hr/expense-claims/${id}/${action}/`);
      toast.success(`Claim ${action}d`);
      fetchData();
    } catch {
      toast.error(`Failed to ${action} claim`);
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    { key: 'claim_number', label: 'Claim #' },
    {
      key: 'employee',
      label: 'Employee',
      render: (c: ExpenseClaim) => (
        <div>
          <div className="font-medium text-sm">{c.employee_name}</div>
          <div className="text-xs text-muted-foreground">{c.department_name}</div>
        </div>
      ),
    },
    { key: 'title', label: 'Title' },
    { key: 'category', label: 'Category', render: (c: ExpenseClaim) => <span className="capitalize text-sm">{c.category?.replace('_', ' ')}</span> },
    {
      key: 'total_amount',
      label: 'Amount',
      render: (c: ExpenseClaim) => (
        <span className="tabular-nums font-medium">
          {c.currency} {Number(c.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'expense_date',
      label: 'Date',
      render: (c: ExpenseClaim) => format(new Date(c.expense_date), 'MMM d, yyyy'),
    },
    { key: 'status', label: 'Status', render: (c: ExpenseClaim) => <StatusBadge status={c.status} /> },
    {
      key: 'actions',
      label: '',
      render: (c: ExpenseClaim) => c.status === 'pending' ? (
        <div className="flex gap-2 justify-end">
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-green-600 hover:bg-green-50"
            disabled={actionLoading !== null}
            onClick={() => handleAction(c.id, 'approve')}
          >
            <CheckCircle2 />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/5"
            disabled={actionLoading !== null}
            onClick={() => handleAction(c.id, 'reject')}
          >
            <XCircle />
          </Button>
        </div>
      ) : null,
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Paid', value: 'paid' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Expense Claims"
        breadcrumbs={[{ label: 'HR' }, { label: 'Expense Claims' }]}
        createHref="/hr/expense-claims/new"
      />
      <DataTable
        columns={columns}
        data={claims}
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
