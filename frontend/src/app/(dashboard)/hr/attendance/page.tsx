'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  department_name: string;
  date: string;
  check_in: string;
  check_out: string;
  working_hours: number;
  status: string;
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/hr/attendance', {
        params: {
          page: pagination.page, page_size: pagination.pageSize,
          search, status: statusFilter || undefined,
          date_from: dateFrom, date_to: dateTo,
        },
      });
      const normalized = normalizePaginated<AttendanceRecord>(raw);
      setRecords(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'employee_id', label: 'ID' },
    {
      key: 'employee_name',
      label: 'Employee',
      render: (r: AttendanceRecord) => (
        <div>
          <div className="font-medium text-sm">{r.employee_name}</div>
          <div className="text-xs text-muted-foreground">{r.department_name}</div>
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (r: AttendanceRecord) => format(new Date(r.date), 'EEE, MMM d'),
    },
    {
      key: 'check_in',
      label: 'Check In',
      render: (r: AttendanceRecord) => r.check_in ? format(new Date(r.check_in), 'HH:mm') : '—',
    },
    {
      key: 'check_out',
      label: 'Check Out',
      render: (r: AttendanceRecord) => r.check_out ? format(new Date(r.check_out), 'HH:mm') : '—',
    },
    {
      key: 'working_hours',
      label: 'Hours',
      render: (r: AttendanceRecord) => r.working_hours ? `${r.working_hours.toFixed(1)}h` : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: AttendanceRecord) => <StatusBadge status={r.status} />,
    },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Present', value: 'present' },
    { label: 'Absent', value: 'absent' },
    { label: 'Late', value: 'late' },
    { label: 'Half Day', value: 'half_day' },
    { label: 'On Leave', value: 'on_leave' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Attendance"
        breadcrumbs={[{ label: 'HR' }, { label: 'Attendance' }]}
      />
      <div className="flex gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date_from">From</Label>
          <Input id="date_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date_to">To</Label>
          <Input id="date_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={records}
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
