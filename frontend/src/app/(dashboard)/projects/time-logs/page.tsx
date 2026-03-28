'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';

interface TimeLog {
  id: string;
  task_id: string;
  description: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  user_name: string;
}

export default function TimeLogsPage() {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: projRaw } = await api.get('/projects', { params: { page_size: 100 } });
      const projects = normalizePaginated<{ id: string }>(projRaw).items;

      const allLogs: TimeLog[] = [];
      for (const proj of projects) {
        try {
          const { data: logRaw } = await api.get(`/projects/${proj.id}/time-logs`, {
            params: { page_size: 100 },
          });
          allLogs.push(...normalizePaginated<TimeLog>(logRaw).items);
        } catch { /* skip */ }
      }

      setLogs(allLogs);
    } catch {
      toast.error('Failed to load time logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'description', label: 'Description' },
    { key: 'user_name', label: 'User' },
    { key: 'start_time', label: 'Start' },
    { key: 'end_time', label: 'End' },
    {
      key: 'duration_minutes',
      label: 'Duration',
      render: (l: TimeLog) => {
        const hrs = Math.floor((l.duration_minutes ?? 0) / 60);
        const mins = (l.duration_minutes ?? 0) % 60;
        return <span className="tabular-nums">{hrs}h {mins}m</span>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Time Logs"
        breadcrumbs={[{ label: 'Projects' }, { label: 'Time Logs' }]}
      />
      <DataTable columns={columns} data={logs} loading={loading} />
    </div>
  );
}
