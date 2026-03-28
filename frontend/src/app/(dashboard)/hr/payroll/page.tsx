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
import { FileText, Loader2 } from 'lucide-react';

interface PayrollRun {
  id: string;
  period_label: string;
  month: number;
  year: number;
  total_employees: number;
  total_gross: number;
  total_net: number;
  currency: string;
  status: string;
  processed_by: string;
  processed_at: string;
}

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [generatingSlips, setGeneratingSlips] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/hr/payroll-runs', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<PayrollRun>(raw);
      setRuns(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerateSlips = async (runId: string) => {
    setGeneratingSlips(runId);
    try {
      await api.post(`/hr/payroll-runs/${runId}/generate-slips`);
      toast.success('Payslips generated successfully');
    } catch {
      toast.error('Failed to generate payslips');
    } finally {
      setGeneratingSlips(null);
    }
  };

  const columns = [
    { key: 'period_label', label: 'Period' },
    { key: 'total_employees', label: 'Employees', render: (r: PayrollRun) => r.total_employees?.toLocaleString() ?? '—' },
    {
      key: 'total_gross',
      label: 'Gross Total',
      render: (r: PayrollRun) => (
        <span className="tabular-nums">{r.currency} {Number(r.total_gross).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      ),
    },
    {
      key: 'total_net',
      label: 'Net Total',
      render: (r: PayrollRun) => (
        <span className="tabular-nums font-semibold">{r.currency} {Number(r.total_net).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      ),
    },
    { key: 'processed_by', label: 'Processed By', render: (r: PayrollRun) => r.processed_by ?? '—' },
    {
      key: 'processed_at',
      label: 'Date',
      render: (r: PayrollRun) => r.processed_at ? format(new Date(r.processed_at), 'MMM d, yyyy') : '—',
    },
    { key: 'status', label: 'Status', render: (r: PayrollRun) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      render: (r: PayrollRun) => r.status === 'processed' ? (
        <Button
          size="sm"
          variant="outline"
          disabled={generatingSlips === r.id}
          onClick={() => handleGenerateSlips(r.id)}
        >
          {generatingSlips === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
          Generate Slips
        </Button>
      ) : null,
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Processing', value: 'processing' },
    { label: 'Processed', value: 'processed' },
    { label: 'Paid', value: 'paid' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Payroll"
        breadcrumbs={[{ label: 'HR' }, { label: 'Payroll' }]}
        createHref="/hr/payroll/new"
      />
      <DataTable
        columns={columns}
        data={runs}
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
