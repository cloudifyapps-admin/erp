'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
  unit: string;
  tax_rate: string;
}

interface POForm {
  vendor_id: string;
  number: string;
  order_date: string;
  expected_delivery: string;
  currency: string;
  payment_terms: string;
  shipping_address: string;
  notes: string;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
  code: string;
}

const EMPTY_LINE: LineItem = { description: '', quantity: '1', unit_price: '0', unit: 'pcs', tax_rate: '0' };

const INITIAL_FORM: POForm = {
  vendor_id: '', number: '', order_date: new Date().toISOString().split('T')[0],
  expected_delivery: '', currency: 'USD', payment_terms: 'net30',
  shipping_address: '', notes: '', status: 'draft',
};

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [form, setForm] = useState<POForm>(INITIAL_FORM);
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/purchase/vendors', { params: { status: 'active', page_size: 200 } })
      .then(({ data }) => setVendors(normalizePaginated(data).items))
      .catch(() => {});
  }, []);

  const setField = (key: keyof POForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setLine = (idx: number, key: keyof LineItem) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setLines((ls) => ls.map((l, i) => i === idx ? { ...l, [key]: e.target.value } : l));
  };

  const addLine = () => setLines((ls) => [...ls, { ...EMPTY_LINE }]);
  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx));

  const subtotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  const tax = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unit_price) || 0;
    const rate = parseFloat(l.tax_rate) || 0;
    return sum + qty * price * (rate / 100);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendor_id) { toast.error('Please select a vendor'); return; }
    if (lines.every((l) => !l.description)) { toast.error('Add at least one line item'); return; }
    setSaving(true);
    try {
      await api.post('/purchase/purchase-orders/', {
        ...form,
        items: lines.filter((l) => l.description).map((l) => ({
          ...l,
          quantity: parseFloat(l.quantity),
          unit_price: parseFloat(l.unit_price),
          tax_rate: parseFloat(l.tax_rate),
        })),
      });
      toast.success('Purchase order created');
      router.push('/purchase/purchase-orders');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create PO';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl">
      <PageHeader
        title="New Purchase Order"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Purchase Orders', href: '/purchase/purchase-orders' }, { label: 'New' }]}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Order Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Vendor <span className="text-destructive">*</span></Label>
              <Select value={form.vendor_id} onValueChange={(v) => setForm((f) => ({ ...f, vendor_id: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name} ({v.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="number">PO Number</Label>
              <Input id="number" value={form.number} onChange={setField('number')} placeholder="Auto-generated if blank" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="order_date">Order Date</Label>
              <Input id="order_date" type="date" value={form.order_date} onChange={setField('order_date')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expected_delivery">Expected Delivery</Label>
              <Input id="expected_delivery" type="date" value={form.expected_delivery} onChange={setField('expected_delivery')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Payment Terms</Label>
              <Select value={form.payment_terms} onValueChange={(v) => setForm((f) => ({ ...f, payment_terms: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="net15">Net 15</SelectItem>
                  <SelectItem value="net30">Net 30</SelectItem>
                  <SelectItem value="net60">Net 60</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shipping_address">Shipping Address</Label>
            <Textarea id="shipping_address" value={form.shipping_address} onChange={setField('shipping_address')} rows={2} />
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Line Items</h2>
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              <Plus /> Add Line
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium">Description</th>
                  <th className="text-right py-2 px-3 font-medium w-20">Qty</th>
                  <th className="text-left py-2 px-3 font-medium w-20">Unit</th>
                  <th className="text-right py-2 px-3 font-medium w-28">Unit Price</th>
                  <th className="text-right py-2 px-3 font-medium w-20">Tax %</th>
                  <th className="text-right py-2 pl-3 font-medium w-28">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const amount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
                  return (
                    <tr key={idx} className="border-b">
                      <td className="py-2 pr-3">
                        <Input value={line.description} onChange={setLine(idx, 'description')} placeholder="Item description" className="h-7 text-sm" />
                      </td>
                      <td className="py-2 px-3">
                        <Input value={line.quantity} onChange={setLine(idx, 'quantity')} type="number" min="0" className="h-7 text-sm text-right" />
                      </td>
                      <td className="py-2 px-3">
                        <Input value={line.unit} onChange={setLine(idx, 'unit')} className="h-7 text-sm" />
                      </td>
                      <td className="py-2 px-3">
                        <Input value={line.unit_price} onChange={setLine(idx, 'unit_price')} type="number" min="0" step="0.01" className="h-7 text-sm text-right" />
                      </td>
                      <td className="py-2 px-3">
                        <Input value={line.tax_rate} onChange={setLine(idx, 'tax_rate')} type="number" min="0" max="100" step="0.1" className="h-7 text-sm text-right" />
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums font-medium">
                        {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pl-2">
                        <Button type="button" size="icon-xs" variant="ghost" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                          <Trash2 className="text-destructive size-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <div className="w-64 flex flex-col gap-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span className="tabular-nums">{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>Total ({form.currency})</span>
                <span className="tabular-nums">{(subtotal + tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Notes</h2>
          <Textarea value={form.notes} onChange={setField('notes')} rows={3} placeholder="Internal notes or instructions for the vendor..." />
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving} variant="outline" onClick={() => setForm((f) => ({ ...f, status: 'draft' }))}>
            {saving ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Submit Order'}
          </Button>
        </div>
      </form>
    </div>
  );
}
