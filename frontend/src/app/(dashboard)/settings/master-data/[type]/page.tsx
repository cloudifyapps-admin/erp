'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DeleteDialog } from '@/components/shared/delete-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Trash2, Plus, ArrowLeft, Search, Sparkles } from 'lucide-react';

interface MasterItem {
  id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

const TYPE_LABELS: Record<string, string> = {
  'leave-types': 'Leave Types',
  'product-categories': 'Product Categories',
  'product-brands': 'Product Brands',
  'ticket-categories': 'Ticket Categories',
  'ticket-statuses': 'Ticket Statuses',
  'ticket-priorities': 'Ticket Priorities',
  'document-categories': 'Document Categories',
  'units-of-measure': 'Units of Measure',
  'tax-regions': 'Tax Regions',
  'tax-types': 'Tax Types',
  'lead-sources': 'Lead Sources',
  'lead-statuses': 'Lead Statuses',
  'opportunity-stages': 'Opportunity Stages',
  'activity-types': 'Activity Types',
  'task-statuses': 'Task Statuses',
  'salutations': 'Salutations',
  'industries': 'Industries',
  'customer-ratings': 'Customer Ratings',
  'lost-reasons': 'Lost Reasons',
  'competitors': 'Competitors',
  'territories': 'Territories',
};

const EMPTY_FORM = { name: '', code: '', description: '', is_active: true, sort_order: 0 };

export default function MasterDataTypePage() {
  const params = useParams();
  const router = useRouter();
  const typeSlug = params.type as string;
  const typeLabel = TYPE_LABELS[typeSlug] ?? typeSlug;
  const singularLabel = typeLabel.replace(/ies$/, 'y').replace(/ses$/, 'se').replace(/s$/, '');

  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MasterItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MasterItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw } = await api.get(`/settings/master-data/${typeSlug}`);
      setItems(normalizePaginated<MasterItem>(raw).items);
    } catch {
      toast.error(`Failed to load ${typeLabel.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [typeSlug, typeLabel]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.name.toLowerCase().includes(q) || (item.code ?? '').toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: MasterItem) => {
    setEditTarget(item);
    setForm({ name: item.name, code: item.code ?? '', description: item.description ?? '', is_active: item.is_active, sort_order: item.sort_order ?? 0 });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await api.patch(`/settings/master-data/${typeSlug}/${editTarget.id}`, form);
        toast.success(`${singularLabel} updated`);
      } else {
        await api.post(`/settings/master-data/${typeSlug}`, form);
        toast.success(`${singularLabel} created`);
      }
      setDialogOpen(false);
      fetchItems();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/settings/master-data/${typeSlug}/${deleteTarget.id}`);
      toast.success(`${singularLabel} deleted`);
      setDeleteTarget(null);
      fetchItems();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleToggleActive = async (item: MasterItem) => {
    try {
      await api.patch(`/settings/master-data/${typeSlug}/${item.id}`, { is_active: !item.is_active });
      toast.success(`${item.name} ${item.is_active ? 'deactivated' : 'activated'}`);
      fetchItems();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      await api.post(`/settings/master-data/${typeSlug}/seed-defaults`);
      toast.success(`Default ${typeLabel.toLowerCase()} loaded successfully`);
      fetchItems();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(detail || `Failed to load defaults`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={typeLabel}
        breadcrumbs={[
          { label: 'Settings' },
          { label: 'Master Data', href: '/settings/master-data' },
          { label: typeLabel },
        ]}
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${typeLabel.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/settings/master-data')}>
            <ArrowLeft className="size-4 mr-1.5" /> Back
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4 mr-1.5" /> Add {singularLabel}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">
              {items.length === 0
                ? `No ${typeLabel.toLowerCase()} configured yet.`
                : 'No results match your search.'}
            </p>
            {items.length === 0 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding}>
                  <Sparkles className="size-4 mr-1.5" />
                  {seeding ? 'Loading...' : 'Load Defaults'}
                </Button>
                <span className="text-muted-foreground text-xs">or</span>
                <Button onClick={openCreate}>
                  <Plus className="size-4 mr-1.5" /> Add {singularLabel.toLowerCase()} manually
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-12">#</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Description</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground w-20">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      {item.code ? (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                          {item.code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate hidden md:table-cell">
                      {item.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className="inline-flex items-center gap-1.5 text-xs cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <span className={`size-2 rounded-full ${item.is_active ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                        <span className={item.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(item)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => setDeleteTarget(item)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Item count */}
      {!loading && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {filteredItems.length} of {items.length} {typeLabel.toLowerCase()}
        </p>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit' : 'Add'} {singularLabel}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="item-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
                placeholder={`Enter ${singularLabel.toLowerCase()} name`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-code">Code</Label>
              <Input
                id="item-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. SICK_LEAVE"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-desc">Description</Label>
              <Input
                id="item-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-sort">Sort Order</Label>
              <Input
                id="item-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="item-active"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-input"
              />
              <Label htmlFor="item-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
