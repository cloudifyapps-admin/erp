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

interface LeaveRequest {
  id: string;
  employee_name: string;
  employee_id: string;
  department_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: string;
  applied_on: string;
}

export default function LeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/hr/leave-requests', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<LeaveRequest>(raw);
      setRequests(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.post(`/hr/leave-requests/${id}/approve/`);
      toast.success('Leave request approved');
      fetchData();
    } catch {
      toast.error('Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await api.post(`/hr/leave-requests/${id}/reject/`);
      toast.success('Leave request rejected');
      fetchData();
    } catch {
      toast.error('Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (r: LeaveRequest) => (
        <div>
          <div className="font-medium text-sm">{r.employee_name}</div>
          <div className="text-xs text-muted-foreground">{r.department_name}</div>
        </div>
      ),
    },
    { key: 'leave_type', label: 'Leave Type', render: (r: LeaveRequest) => <span className="capitalize">{r.leave_type?.replace('_', ' ')}</span> },
    {
      key: 'dates',
      label: 'Dates',
      render: (r: LeaveRequest) => (
        <span className="text-sm">
          {format(new Date(r.start_date), 'MMM d')} – {format(new Date(r.end_date), 'MMM d, yyyy')}
        </span>
      ),
    },
    { key: 'days', label: 'Days', render: (r: LeaveRequest) => `${r.days}d` },
    { key: 'reason', label: 'Reason', render: (r: LeaveRequest) => <span className="text-muted-foreground text-xs truncate max-w-xs block">{r.reason}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (r: LeaveRequest) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (r: LeaveRequest) => r.status === 'pending' ? (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-200 hover:bg-green-50"
            disabled={actionLoading === r.id}
            onClick={() => handleApprove(r.id)}
          >
            <CheckCircle2 className="size-3.5" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/20 hover:bg-destructive/5"
            disabled={actionLoading === r.id}
            onClick={() => handleReject(r.id)}
          >
            <XCircle className="size-3.5" /> Reject
          </Button>
        </div>
      ) : null,
    },
  ];

  const filterOptions = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Leave Requests"
        breadcrumbs={[{ label: 'HR' }, { label: 'Leave Requests' }]}
        createHref="/hr/leave-requests/new"
      />
      <DataTable
        columns={columns}
        data={requests}
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
