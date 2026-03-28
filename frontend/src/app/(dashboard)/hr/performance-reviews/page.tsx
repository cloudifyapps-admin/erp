'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { format } from 'date-fns';
import { Star } from 'lucide-react';

interface PerformanceReview {
  id: string;
  employee_name: string;
  employee_id: string;
  reviewer_name: string;
  department_name: string;
  review_period: string;
  overall_rating: number;
  status: string;
  due_date: string;
  completed_at: string;
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`size-3.5 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating?.toFixed(1)}</span>
    </div>
  );
}

export default function PerformanceReviewsPage() {
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/hr/performance-reviews', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, status: statusFilter || undefined },
      });
      const normalized = normalizePaginated<PerformanceReview>(raw);
      setReviews(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load performance reviews');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      key: 'employee_name',
      label: 'Employee',
      render: (r: PerformanceReview) => (
        <div>
          <div className="font-medium text-sm">{r.employee_name}</div>
          <div className="text-xs text-muted-foreground">{r.department_name}</div>
        </div>
      ),
    },
    { key: 'review_period', label: 'Period' },
    { key: 'reviewer_name', label: 'Reviewer', render: (r: PerformanceReview) => r.reviewer_name ?? '—' },
    {
      key: 'overall_rating',
      label: 'Rating',
      render: (r: PerformanceReview) => r.overall_rating ? <RatingStars rating={r.overall_rating} /> : '—',
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (r: PerformanceReview) => r.due_date ? format(new Date(r.due_date), 'MMM d, yyyy') : '—',
    },
    {
      key: 'completed_at',
      label: 'Completed',
      render: (r: PerformanceReview) => r.completed_at ? format(new Date(r.completed_at), 'MMM d, yyyy') : '—',
    },
    { key: 'status', label: 'Status', render: (r: PerformanceReview) => <StatusBadge status={r.status} /> },
  ];

  const filterOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Pending Approval', value: 'pending_approval' },
    { label: 'Completed', value: 'completed' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Performance Reviews"
        breadcrumbs={[{ label: 'HR' }, { label: 'Performance Reviews' }]}
        createHref="/hr/performance-reviews/new"
      />
      <DataTable
        columns={columns}
        data={reviews}
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
