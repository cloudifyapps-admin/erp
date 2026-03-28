'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

interface Milestone {
  id: string;
  title: string;
  due_date: string;
  status: string;
  progress: number;
}

export default function MilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: projRaw } = await api.get('/projects', { params: { page_size: 100 } });
      const projects = normalizePaginated<{ id: string }>(projRaw).items;

      const allMilestones: Milestone[] = [];
      for (const proj of projects) {
        try {
          const { data: msRaw } = await api.get(`/projects/${proj.id}/milestones`, {
            params: { page_size: 100 },
          });
          allMilestones.push(...normalizePaginated<Milestone>(msRaw).items);
        } catch { /* skip */ }
      }

      setMilestones(allMilestones);
    } catch {
      toast.error('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'title', label: 'Milestone' },
    { key: 'due_date', label: 'Due Date' },
    {
      key: 'status',
      label: 'Status',
      render: (m: Milestone) => <StatusBadge status={m.status} />,
    },
    {
      key: 'progress',
      label: 'Progress',
      render: (m: Milestone) => (
        <div className="flex items-center gap-2 min-w-[100px]">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${m.progress ?? 0}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{m.progress ?? 0}%</span>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Milestones"
        breadcrumbs={[{ label: 'Projects' }, { label: 'Milestones' }]}
      />
      <DataTable columns={columns} data={milestones} loading={loading} />
    </div>
  );
}
