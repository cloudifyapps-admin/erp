'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DeleteDialog } from '@/components/shared/delete-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, ChevronRight, Loader2, Sparkles } from 'lucide-react';

interface Permission {
  key: string;
  label: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  member_count: number;
  is_system: boolean;
}

const ALL_PERMISSIONS: Permission[] = [
  // Purchase
  { key: 'purchase.vendors.view', label: 'View Vendors', category: 'Purchase' },
  { key: 'purchase.vendors.manage', label: 'Manage Vendors', category: 'Purchase' },
  { key: 'purchase.orders.view', label: 'View Purchase Orders', category: 'Purchase' },
  { key: 'purchase.orders.create', label: 'Create Purchase Orders', category: 'Purchase' },
  { key: 'purchase.orders.approve', label: 'Approve Purchase Orders', category: 'Purchase' },
  // Inventory
  { key: 'inventory.products.view', label: 'View Products', category: 'Inventory' },
  { key: 'inventory.products.manage', label: 'Manage Products', category: 'Inventory' },
  { key: 'inventory.stock.view', label: 'View Stock Levels', category: 'Inventory' },
  { key: 'inventory.stock.adjust', label: 'Adjust Stock', category: 'Inventory' },
  // Projects
  { key: 'projects.view', label: 'View Projects', category: 'Projects' },
  { key: 'projects.create', label: 'Create Projects', category: 'Projects' },
  { key: 'projects.manage', label: 'Manage All Projects', category: 'Projects' },
  // HR
  { key: 'hr.employees.view', label: 'View Employees', category: 'HR' },
  { key: 'hr.employees.manage', label: 'Manage Employees', category: 'HR' },
  { key: 'hr.payroll.view', label: 'View Payroll', category: 'HR' },
  { key: 'hr.payroll.process', label: 'Process Payroll', category: 'HR' },
  { key: 'hr.leave.approve', label: 'Approve Leave Requests', category: 'HR' },
  // Tickets
  { key: 'tickets.view', label: 'View Tickets', category: 'Support' },
  { key: 'tickets.manage', label: 'Manage Tickets', category: 'Support' },
  { key: 'tickets.assign', label: 'Assign Tickets', category: 'Support' },
  // Settings
  { key: 'settings.view', label: 'View Settings', category: 'Settings' },
  { key: 'settings.manage', label: 'Manage Settings', category: 'Settings' },
  { key: 'settings.roles', label: 'Manage Roles & Permissions', category: 'Settings' },
];

const PERMISSION_CATEGORIES = [...new Set(ALL_PERMISSIONS.map((p) => p.category))];

export default function TeamRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  const fetchRoleDetail = useCallback(async (roleId: string) => {
    try {
      const { data } = await api.get(`/settings/team-roles/${roleId}`);
      const role: Role = {
        ...data,
        id: String(data.id),
        permissions: data.permissions ?? [],
        member_count: data.member_count ?? 0,
        is_system: data.is_system ?? false,
      };
      setSelectedRole(role);
    } catch {
      toast.error('Failed to load role details');
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const { data: raw } = await api.get('/settings/team-roles');
      const list = normalizePaginated<Role>(raw).items.map((r) => ({
        ...r,
        id: String(r.id),
        permissions: r.permissions ?? [],
        member_count: r.member_count ?? 0,
        is_system: r.is_system ?? false,
      }));
      setRoles(list);
      if (list.length > 0 && !selectedRole) {
        fetchRoleDetail(list[0].id);
      }
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, fetchRoleDetail]);

  useEffect(() => { fetchRoles(); }, []); // eslint-disable-line

  const togglePermission = (key: string) => {
    if (!selectedRole || selectedRole.is_system) return;
    setSelectedRole((r) => {
      if (!r) return r;
      const has = r.permissions.includes(key);
      return { ...r, permissions: has ? r.permissions.filter((p) => p !== key) : [...r.permissions, key] };
    });
  };

  const toggleCategory = (category: string) => {
    if (!selectedRole || selectedRole.is_system) return;
    const catPerms = ALL_PERMISSIONS.filter((p) => p.category === category).map((p) => p.key);
    const allChecked = catPerms.every((k) => selectedRole.permissions.includes(k));
    setSelectedRole((r) => {
      if (!r) return r;
      const without = r.permissions.filter((p) => !catPerms.includes(p));
      return { ...r, permissions: allChecked ? without : [...without, ...catPerms] };
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/settings/team-roles/${selectedRole.id}/`, {
        permissions: selectedRole.permissions,
      });
      setRoles((rs) => rs.map((r) => r.id === selectedRole.id ? data : r));
      toast.success('Permissions saved');
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName) { toast.error('Role name is required'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/settings/team-roles/', { name: newRoleName, description: newRoleDesc, permissions: [] });
      setRoles((rs) => [...rs, data]);
      setSelectedRole(data);
      setCreatingNew(false);
      setNewRoleName('');
      setNewRoleDesc('');
      toast.success('Role created');
    } catch {
      toast.error('Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/settings/team-roles/${deleteTarget.id}/`);
      const updated = roles.filter((r) => r.id !== deleteTarget.id);
      setRoles(updated);
      if (selectedRole?.id === deleteTarget.id) {
        if (updated[0]) fetchRoleDetail(updated[0].id);
        else setSelectedRole(null);
      }
      setDeleteTarget(null);
      toast.success('Role deleted');
    } catch {
      toast.error('Failed to delete role');
    }
  };

  const handleSeedDefaults = async () => {
    setSeedingDefaults(true);
    try {
      const { data } = await api.post('/settings/team-roles/seed-defaults');
      toast.success(data.message || 'Default roles created');
      setSelectedRole(null);
      await fetchRoles();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create default roles');
    } finally {
      setSeedingDefaults(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Team Roles"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Team Roles' }]}
      />

      <div className="flex gap-4 h-full">
        {/* Role list */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => fetchRoleDetail(role.id)}
              className={`w-full text-left rounded-lg p-3 transition-colors border ${
                selectedRole?.id === role.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{role.name}</span>
                <ChevronRight className="size-3.5 opacity-60" />
              </div>
              <span className={`text-xs ${selectedRole?.id === role.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {role.member_count ?? 0} members
              </span>
              {role.is_system && (
                <span className={`block text-[10px] mt-0.5 ${selectedRole?.id === role.id ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  System role
                </span>
              )}
            </button>
          ))}

          {creatingNew ? (
            <Card className="p-3 flex flex-col gap-2">
              <Input
                placeholder="Role name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                autoFocus
                className="h-7 text-xs"
              />
              <Input
                placeholder="Description (optional)"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                className="h-7 text-xs"
              />
              <div className="flex gap-2">
                <Button size="xs" onClick={handleCreateRole} disabled={saving}>Create</Button>
                <Button size="xs" variant="ghost" onClick={() => setCreatingNew(false)}>Cancel</Button>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreatingNew(true)}>
                <Plus /> New Role
              </Button>
              {roles.length <= 1 && (
                <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={seedingDefaults}>
                  <Sparkles className="size-3.5" />
                  {seedingDefaults ? 'Loading...' : 'Load Default Roles'}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Permissions */}
        {selectedRole && (
          <Card className="flex-1 p-5 flex flex-col gap-4 overflow-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{selectedRole.name}</h2>
                {selectedRole.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{selectedRole.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                {!selectedRole.is_system && (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteTarget(selectedRole)}>
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                )}
                {!selectedRole.is_system && (
                  <Button size="sm" onClick={handleSavePermissions} disabled={saving}>
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Save Permissions
                  </Button>
                )}
              </div>
            </div>

            {selectedRole.is_system && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded p-3">
                System roles cannot be modified. They are managed automatically.
              </div>
            )}

            <div className="flex flex-col gap-6">
              {PERMISSION_CATEGORIES.map((category) => {
                const catPerms = ALL_PERMISSIONS.filter((p) => p.category === category);
                const checkedCount = catPerms.filter((p) => selectedRole.permissions.includes(p.key)).length;
                const allChecked = checkedCount === catPerms.length;
                const someChecked = checkedCount > 0 && !allChecked;

                return (
                  <div key={category} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${category}`}
                        checked={allChecked}
                        data-indeterminate={someChecked}
                        onCheckedChange={() => toggleCategory(category)}
                        disabled={selectedRole.is_system}
                        className={someChecked ? 'data-[state=checked]:bg-primary/50' : ''}
                      />
                      <Label htmlFor={`cat-${category}`} className="text-sm font-semibold cursor-pointer">
                        {category}
                      </Label>
                      <span className="text-xs text-muted-foreground ml-auto">{checkedCount}/{catPerms.length}</span>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      {catPerms.map((perm) => (
                        <div key={perm.key} className="flex items-center gap-2">
                          <Checkbox
                            id={perm.key}
                            checked={selectedRole.permissions.includes(perm.key)}
                            onCheckedChange={() => togglePermission(perm.key)}
                            disabled={selectedRole.is_system}
                          />
                          <Label htmlFor={perm.key} className="text-sm cursor-pointer font-normal">
                            {perm.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <DeleteDialog
        open={!!deleteTarget}
        title={`Delete role "${deleteTarget?.name}"? ${deleteTarget?.member_count ? `This will affect ${deleteTarget.member_count} members.` : ''}`}
        onConfirm={handleDeleteRole}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
