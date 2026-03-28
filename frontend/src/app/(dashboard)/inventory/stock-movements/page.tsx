'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { format } from 'date-fns';
import { ArrowDownCircle, ArrowUpCircle, ArrowRightLeft } from 'lucide-react';

interface StockMovement {
  id: string;
  reference: string;
  product_name: string;
  product_sku: string;
  warehouse_name: string;
  movement_type: 'in' | 'out' | 'transfer' | 'adjustment';
  quantity: number;
  unit: string;
  reason: string;
  created_by: string;
  created_at: string;
}

const MOVEMENT_ICONS: Record<string, React.ReactNode> = {
  in: <ArrowDownCircle className="size-4 text-green-600" />,
  out: <ArrowUpCircle className="size-4 text-red-600" />,
  transfer: <ArrowRightLeft className="size-4 text-blue-600" />,
  adjustment: <ArrowRightLeft className="size-4 text-orange-600" />,
};

const MOVEMENT_LABELS: Record<string, string> = {
  in: 'Stock In', out: 'Stock Out', transfer: 'Transfer', adjustment: 'Adjustment',
};

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/inventory/stock-movements', {
        params: { page: pagination.page, page_size: pagination.pageSize, search, movement_type: typeFilter || undefined },
      });
      const normalized = normalizePaginated<StockMovement>(raw);
      setMovements(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'reference', label: 'Reference' },
    {
      key: 'product',
      label: 'Product',
      render: (m: StockMovement) => (
        <div>
          <div className="font-medium text-sm">{m.product_name}</div>
          <div className="text-xs text-muted-foreground">{m.product_sku}</div>
        </div>
      ),
    },
    { key: 'warehouse_name', label: 'Warehouse' },
    {
      key: 'movement_type',
      label: 'Type',
      render: (m: StockMovement) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          {MOVEMENT_ICONS[m.movement_type]}
          {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
        </span>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (m: StockMovement) => {
        const isOut = m.movement_type === 'out';
        return (
          <span className={`tabular-nums font-medium ${isOut ? 'text-red-600' : 'text-green-600'}`}>
            {isOut ? '-' : '+'}{Math.abs(m.quantity).toLocaleString()} {m.unit}
          </span>
        );
      },
    },
    { key: 'reason', label: 'Reason' },
    { key: 'created_by', label: 'By' },
    {
      key: 'created_at',
      label: 'Date',
      render: (m: StockMovement) => format(new Date(m.created_at), 'MMM d, yyyy HH:mm'),
    },
  ];

  const filterOptions = [
    { label: 'All Types', value: '' },
    { label: 'Stock In', value: 'in' },
    { label: 'Stock Out', value: 'out' },
    { label: 'Transfer', value: 'transfer' },
    { label: 'Adjustment', value: 'adjustment' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Stock Movements"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Movements' }]}
      />
      <DataTable
        columns={columns}
        data={movements}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
        onFilter={(val) => { setTypeFilter(val); setPagination((p) => ({ ...p, page: 1 })); }}
        filterOptions={filterOptions}
        filterLabel="Type"
      />
    </div>
  );
}
