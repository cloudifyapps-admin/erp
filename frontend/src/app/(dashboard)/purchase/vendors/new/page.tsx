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

interface VendorForm {
  name: string;
  code: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  country: string;
  tax_id: string;
  payment_terms: string;
  currency: string;
  status: string;
  notes: string;
}

const INITIAL: VendorForm = {
  name: '', code: '', email: '', phone: '', website: '',
  address: '', city: '', country: '', tax_id: '',
  payment_terms: 'net30', currency: 'USD', status: 'active', notes: '',
};

export default function NewVendorPage() {
  const router = useRouter();
  const [form, setForm] = useState<VendorForm>(INITIAL);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof VendorForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Vendor name is required'); return; }
    setSaving(true);
    try {
      await api.post('/purchase/vendors/', form);
      toast.success('Vendor created successfully');
      router.push('/purchase/vendors');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create vendor';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <PageHeader
        title="New Vendor"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Vendors', href: '/purchase/vendors' }, { label: 'New' }]}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Vendor Name <span className="text-destructive">*</span></Label>
              <Input id="name" value={form.name} onChange={set('name')} placeholder="Acme Corp" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Vendor Code</Label>
              <Input id="code" value={form.code} onChange={set('code')} placeholder="VND-001" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={set('email')} placeholder="contact@acme.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={set('phone')} placeholder="+1 555 0100" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={form.website} onChange={set('website')} placeholder="https://acme.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tax_id">Tax ID</Label>
              <Input id="tax_id" value={form.tax_id} onChange={set('tax_id')} placeholder="12-3456789" />
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Address</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="address">Street Address</Label>
              <Input id="address" value={form.address} onChange={set('address')} placeholder="123 Main St" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={set('city')} placeholder="New York" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={form.country} onChange={set('country')} placeholder="US" />
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Commercial Terms</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Payment Terms</Label>
              <Select value={form.payment_terms} onValueChange={(v) => setForm((f) => ({ ...f, payment_terms: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="net15">Net 15</SelectItem>
                  <SelectItem value="net30">Net 30</SelectItem>
                  <SelectItem value="net60">Net 60</SelectItem>
                  <SelectItem value="net90">Net 90</SelectItem>
                </SelectContent>
              </Select>
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
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={set('notes')} rows={3} placeholder="Internal notes about this vendor..." />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Vendor'}</Button>
        </div>
      </form>
    </div>
  );
}
