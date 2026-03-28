'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import {
  FileText, FileImage, FileSpreadsheet, FileCode, File,
  Download, Eye, Trash2
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  category: string;
  uploaded_by: string;
  related_to: string;
  related_id: string;
  description: string;
  created_at: string;
  url: string;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="size-4 text-red-500" />,
  doc: <FileText className="size-4 text-blue-500" />,
  docx: <FileText className="size-4 text-blue-500" />,
  xls: <FileSpreadsheet className="size-4 text-green-500" />,
  xlsx: <FileSpreadsheet className="size-4 text-green-500" />,
  csv: <FileSpreadsheet className="size-4 text-green-600" />,
  png: <FileImage className="size-4 text-purple-500" />,
  jpg: <FileImage className="size-4 text-purple-500" />,
  jpeg: <FileImage className="size-4 text-purple-500" />,
  svg: <FileImage className="size-4 text-indigo-500" />,
  js: <FileCode className="size-4 text-yellow-500" />,
  ts: <FileCode className="size-4 text-blue-600" />,
};

function formatBytes(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/documents', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, category: categoryFilter || undefined },
      });
      const normalized = normalizePaginated<Document>(raw);
      setDocs(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, categoryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/documents/${id}/`);
      toast.success('Document deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const getExtension = (fileName: string) => fileName?.split('.').pop()?.toLowerCase() ?? '';

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (d: Document) => {
        const ext = getExtension(d.file_name);
        const icon = FILE_ICONS[ext] ?? <File className="size-4 text-muted-foreground" />;
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded border bg-muted/50 shrink-0">
              {icon}
            </div>
            <div>
              <div className="font-medium text-sm">{d.name}</div>
              <div className="text-xs text-muted-foreground">{d.file_name}</div>
            </div>
          </div>
        );
      },
    },
    { key: 'category', label: 'Category', render: (d: Document) => <span className="capitalize text-sm">{d.category?.replace('_', ' ') ?? '—'}</span> },
    { key: 'related_to', label: 'Related To', render: (d: Document) => d.related_to ? `${d.related_to}` : '—' },
    { key: 'file_size', label: 'Size', render: (d: Document) => formatBytes(d.file_size) },
    { key: 'uploaded_by', label: 'Uploaded By' },
    {
      key: 'created_at',
      label: 'Date',
      render: (d: Document) => format(new Date(d.created_at), 'MMM d, yyyy'),
    },
    {
      key: 'actions',
      label: '',
      render: (d: Document) => (
        <div className="flex gap-1 justify-end">
          {d.url && (
            <Button size="icon-sm" variant="ghost" asChild>
              <a href={d.url} target="_blank" rel="noopener noreferrer"><Eye /></a>
            </Button>
          )}
          {d.url && (
            <Button size="icon-sm" variant="ghost" asChild>
              <a href={d.url} download={d.file_name}><Download /></a>
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" onClick={() => handleDelete(d.id, d.name)}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const filterOptions = [
    { label: 'All Categories', value: '' },
    { label: 'Contract', value: 'contract' },
    { label: 'Invoice', value: 'invoice' },
    { label: 'Report', value: 'report' },
    { label: 'Proposal', value: 'proposal' },
    { label: 'Other', value: 'other' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Documents"
        breadcrumbs={[{ label: 'Documents' }]}
        createHref="/documents/upload"
      />
      <DataTable
        columns={columns}
        data={docs}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
        onFilter={(val) => { setCategoryFilter(val); setPagination((p) => ({ ...p, page: 1 })); }}
        filterOptions={filterOptions}
        filterLabel="Category"
      />
    </div>
  );
}
