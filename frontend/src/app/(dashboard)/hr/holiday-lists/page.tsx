'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  description: string;
  applicable_to: string;
}

export default function HolidayListsPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0 });
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/hr/holiday-lists', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, year: yearFilter },
      });
      const normalized = normalizePaginated<Holiday>(raw);
      setHolidays(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, yearFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const HOLIDAY_TYPE_COLORS: Record<string, string> = {
    national: 'bg-blue-100 text-blue-700',
    optional: 'bg-amber-100 text-amber-700',
    company: 'bg-purple-100 text-purple-700',
  };

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (h: Holiday) => (
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">{format(new Date(h.date), 'MMMM d, yyyy')}</div>
            <div className="text-xs text-muted-foreground">{format(new Date(h.date), 'EEEE')}</div>
          </div>
        </div>
      ),
    },
    { key: 'name', label: 'Holiday' },
    {
      key: 'type',
      label: 'Type',
      render: (h: Holiday) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${HOLIDAY_TYPE_COLORS[h.type] ?? 'bg-gray-100 text-gray-700'}`}>
          {h.type}
        </span>
      ),
    },
    { key: 'applicable_to', label: 'Applicable To', render: (h: Holiday) => h.applicable_to ?? 'All' },
    { key: 'description', label: 'Description', render: (h: Holiday) => <span className="text-muted-foreground text-xs">{h.description ?? '—'}</span> },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Holiday Lists"
        breadcrumbs={[{ label: 'HR' }, { label: 'Holiday Lists' }]}
        createHref="/hr/holiday-lists/new"
      />
      <div className="flex gap-3">
        <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setPagination((p) => ({ ...p, page: 1 })); }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={holidays}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
      />
    </div>
  );
}
