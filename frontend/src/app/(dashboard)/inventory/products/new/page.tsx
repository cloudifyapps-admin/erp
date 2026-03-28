'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface ProductForm {
  name: string;
  sku: string;
  barcode: string;
  type: string;
  category: string;
  unit: string;
  price: string;
  cost: string;
  currency: string;
  tax_rate: string;
  min_stock_level: string;
  reorder_point: string;
  description: string;
  status: string;
  is_serialized: boolean;
  is_batch_tracked: boolean;
  weight: string;
  weight_unit: string;
}

const INITIAL: ProductForm = {
  name: '', sku: '', barcode: '', type: 'finished_good', category: '',
  unit: 'pcs', price: '', cost: '', currency: 'USD', tax_rate: '0',
  min_stock_level: '0', reorder_point: '0', description: '', status: 'active',
  is_serialized: false, is_batch_tracked: false, weight: '', weight_unit: 'kg',
};

export default function NewProductPage() {
  const router = useRouter();
  const [form, setForm] = useState<ProductForm>(INITIAL);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Product name is required'); return; }
    setSaving(true);
    try {
      await api.post('/inventory/products', {
        name: form.name,
        sku: form.sku || null,
        barcode: form.barcode || null,
        type: form.type,
        status: form.status,
        description: form.description || null,
        selling_price: parseFloat(form.price) || 0,
        purchase_price: parseFloat(form.cost) || 0,
        reorder_level: parseFloat(form.reorder_point) || 0,
        track_inventory: true,
      });
      toast.success('Product created successfully');
      router.push('/inventory/products');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create product';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <PageHeader
        title="New Product"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Products', href: '/inventory/products' }, { label: 'New' }]}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">Product Name <span className="text-destructive">*</span></Label>
              <Input id="name" value={form.name} onChange={set('name')} placeholder="Office Chair" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={form.sku} onChange={set('sku')} placeholder="PRD-001" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" value={form.barcode} onChange={set('barcode')} placeholder="123456789012" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="finished_good">Finished Good</SelectItem>
                  <SelectItem value="raw_material">Raw Material</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="consumable">Consumable</SelectItem>
                  <SelectItem value="asset">Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Input id="category" value={form.category} onChange={set('category')} placeholder="Furniture" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Unit of Measure</Label>
              <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">Pieces</SelectItem>
                  <SelectItem value="kg">Kilograms</SelectItem>
                  <SelectItem value="ltr">Liters</SelectItem>
                  <SelectItem value="mtr">Meters</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={set('description')} rows={3} />
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Pricing</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price">Selling Price</Label>
              <Input id="price" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost">Cost Price</Label>
              <Input id="cost" type="number" min="0" step="0.01" value={form.cost} onChange={set('cost')} placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tax_rate">Tax Rate (%)</Label>
              <Input id="tax_rate" type="number" min="0" max="100" step="0.1" value={form.tax_rate} onChange={set('tax_rate')} />
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Inventory</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min_stock_level">Minimum Stock Level</Label>
              <Input id="min_stock_level" type="number" min="0" value={form.min_stock_level} onChange={set('min_stock_level')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reorder_point">Reorder Point</Label>
              <Input id="reorder_point" type="number" min="0" value={form.reorder_point} onChange={set('reorder_point')} />
            </div>
          </div>
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <Switch
                id="serialized"
                checked={form.is_serialized}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_serialized: v }))}
              />
              <Label htmlFor="serialized">Serial Number Tracking</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="batch"
                checked={form.is_batch_tracked}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_batch_tracked: v }))}
              />
              <Label htmlFor="batch">Batch Tracking</Label>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Product'}</Button>
        </div>
      </form>
    </div>
  );
}
