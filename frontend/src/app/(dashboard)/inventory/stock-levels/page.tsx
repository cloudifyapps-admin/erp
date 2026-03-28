'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface StockLevel {
  id: string;
  product_name: string;
  product_sku: string;
  warehouse_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_point: number;
  unit: string;
}

interface Warehouse {
  id: string;
  name: string;
}

export default function StockLevelsPage() {
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get('/inventory/stock-levels', {
        params: {
          page: pagination.page,
          page_size: pagination.pageSize,
          search,
          warehouse: warehouseFilter || undefined,
          low_stock: lowStockOnly || undefined,
        },
      });
      const normalized = normalizePaginated<StockLevel>(raw);
      setStock(normalized.items);
      setPagination((p) => ({ ...p, total: normalized.total }));
    } catch {
      toast.error('Failed to load stock levels');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search, warehouseFilter, lowStockOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    api.get('/inventory/warehouses', { params: { page_size: 200 } })
      .then(({ data }) => setWarehouses(normalizePaginated<Warehouse>(data).items))
      .catch(() => {});
  }, []);

  const columns = [
    {
      key: 'product',
      label: 'Product',
      render: (s: StockLevel) => (
        <div>
          <div className="font-medium text-sm">{s.product_name}</div>
          <div className="text-xs text-muted-foreground">{s.product_sku}</div>
        </div>
      ),
    },
    { key: 'warehouse_name', label: 'Warehouse' },
    {
      key: 'quantity_on_hand',
      label: 'On Hand',
      render: (s: StockLevel) => (
        <span className="tabular-nums font-medium">{s.quantity_on_hand.toLocaleString()} {s.unit}</span>
      ),
    },
    {
      key: 'quantity_reserved',
      label: 'Reserved',
      render: (s: StockLevel) => (
        <span className="tabular-nums text-muted-foreground">{s.quantity_reserved.toLocaleString()} {s.unit}</span>
      ),
    },
    {
      key: 'quantity_available',
      label: 'Available',
      render: (s: StockLevel) => (
        <span className="tabular-nums font-semibold">{s.quantity_available.toLocaleString()} {s.unit}</span>
      ),
    },
    {
      key: 'status',
      label: 'Stock Status',
      render: (s: StockLevel) => {
        const isLow = s.quantity_available <= s.reorder_point;
        return (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${isLow ? 'text-orange-600' : 'text-green-600'}`}>
            {isLow ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
            {isLow ? 'Low Stock' : 'In Stock'}
          </span>
        );
      },
    },
  ];

  const warehouseOptions = [
    { label: 'All Warehouses', value: '__all__' },
    ...warehouses.map((w) => ({ label: w.name, value: String(w.id) })),
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Stock Levels"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Levels' }]}
      />
      <div className="flex items-center gap-3">
        <Select value={warehouseFilter || '__all__'} onValueChange={(v) => { setWarehouseFilter(v === '__all__' ? '' : v); setPagination((p) => ({ ...p, page: 1 })); }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All Warehouses" /></SelectTrigger>
          <SelectContent>
            {warehouseOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border border-input"
            checked={lowStockOnly}
            onChange={(e) => { setLowStockOnly(e.target.checked); setPagination((p) => ({ ...p, page: 1 })); }}
          />
          Low stock only
        </label>
      </div>
      <DataTable
        columns={columns}
        data={stock}
        loading={loading}
        pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
        onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
      />
    </div>
  );
}
