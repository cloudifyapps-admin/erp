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

interface ProjectForm {
  name: string;
  code: string;
  description: string;
  client_name: string;
  manager_email: string;
  start_date: string;
  end_date: string;
  budget: string;
  currency: string;
  billing_type: string;
  status: string;
  priority: string;
}

const INITIAL: ProjectForm = {
  name: '', code: '', description: '', client_name: '', manager_email: '',
  start_date: new Date().toISOString().split('T')[0], end_date: '',
  budget: '', currency: 'USD', billing_type: 'fixed', status: 'planning', priority: 'medium',
};

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState<ProjectForm>(INITIAL);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof ProjectForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Project name is required'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/projects', {
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget: form.budget ? parseFloat(form.budget) : null,
        status: form.status,
      });
      toast.success('Project created');
      router.push(`/projects/${data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create project';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <PageHeader
        title="New Project"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'New' }]}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Project Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">Project Name <span className="text-destructive">*</span></Label>
              <Input id="name" value={form.name} onChange={set('name')} placeholder="Website Redesign" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Project Code</Label>
              <Input id="code" value={form.code} onChange={set('code')} placeholder="PRJ-001" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client_name">Client</Label>
              <Input id="client_name" value={form.client_name} onChange={set('client_name')} placeholder="Acme Corp" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
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
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Timeline</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start_date">Start Date</Label>
              <Input id="start_date" type="date" value={form.start_date} onChange={set('start_date')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end_date">End Date</Label>
              <Input id="end_date" type="date" value={form.end_date} onChange={set('end_date')} />
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Budget</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budget">Budget</Label>
              <Input id="budget" type="number" min="0" step="0.01" value={form.budget} onChange={set('budget')} placeholder="0.00" />
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
              <Label>Billing Type</Label>
              <Select value={form.billing_type} onValueChange={(v) => setForm((f) => ({ ...f, billing_type: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Price</SelectItem>
                  <SelectItem value="time_material">Time & Material</SelectItem>
                  <SelectItem value="retainer">Retainer</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Project'}</Button>
        </div>
      </form>
    </div>
  );
}
