'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { DeleteDialog } from '@/components/shared/delete-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus, Trash2, Loader2, Sparkles, Shield, ShieldCheck, ShieldAlert,
  Lock, Users2, Search, ChevronDown, ChevronRight, Check,
  Package, FolderKanban, UserCog, Ticket, Settings, ShoppingCart,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────────────────── */

interface Permission {
  key: string
  label: string
  category: string
}

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  member_count: number
  is_system: boolean
}

/* ── Permission Data ───────────────────────────────────────────────── */

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
  // Support
  { key: 'tickets.view', label: 'View Tickets', category: 'Support' },
  { key: 'tickets.manage', label: 'Manage Tickets', category: 'Support' },
  { key: 'tickets.assign', label: 'Assign Tickets', category: 'Support' },
  // Settings
  { key: 'settings.view', label: 'View Settings', category: 'Settings' },
  { key: 'settings.manage', label: 'Manage Settings', category: 'Settings' },
  { key: 'settings.roles', label: 'Manage Roles & Permissions', category: 'Settings' },
]

const PERMISSION_CATEGORIES = [...new Set(ALL_PERMISSIONS.map((p) => p.category))]

const CATEGORY_ICONS: Record<string, typeof Package> = {
  Purchase: ShoppingCart,
  Inventory: Package,
  Projects: FolderKanban,
  HR: UserCog,
  Support: Ticket,
  Settings: Settings,
}

const CATEGORY_COLORS: Record<string, string> = {
  Purchase: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Inventory: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Projects: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  HR: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Support: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  Settings: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
}

/* ── Page Component ────────────────────────────────────────────────── */

export default function TeamRolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [seedingDefaults, setSeedingDefaults] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(PERMISSION_CATEGORIES))

  // Create role dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchRoleDetail = useCallback(async (roleId: string) => {
    try {
      const { data } = await api.get(`/settings/team-roles/${roleId}`)
      const role: Role = {
        ...data,
        id: String(data.id),
        permissions: data.permissions ?? [],
        member_count: data.member_count ?? 0,
        is_system: data.is_system ?? false,
      }
      setSelectedRole(role)
    } catch {
      toast.error('Failed to load role details')
    }
  }, [])

  const fetchRoles = useCallback(async () => {
    try {
      const { data: raw } = await api.get('/settings/team-roles')
      const list = normalizePaginated<Role>(raw).items.map((r) => ({
        ...r,
        id: String(r.id),
        permissions: r.permissions ?? [],
        member_count: r.member_count ?? 0,
        is_system: r.is_system ?? false,
      }))
      setRoles(list)
      if (list.length > 0 && !selectedRole) {
        fetchRoleDetail(list[0].id)
      }
    } catch {
      toast.error('Failed to load roles')
    } finally {
      setLoading(false)
    }
  }, [selectedRole, fetchRoleDetail])

  useEffect(() => { fetchRoles() }, []) // eslint-disable-line

  const togglePermission = (key: string) => {
    if (!selectedRole || selectedRole.is_system) return
    setSelectedRole((r) => {
      if (!r) return r
      const has = r.permissions.includes(key)
      return { ...r, permissions: has ? r.permissions.filter((p) => p !== key) : [...r.permissions, key] }
    })
  }

  const toggleCategory = (category: string) => {
    if (!selectedRole || selectedRole.is_system) return
    const catPerms = ALL_PERMISSIONS.filter((p) => p.category === category).map((p) => p.key)
    const allChecked = catPerms.every((k) => selectedRole.permissions.includes(k))
    setSelectedRole((r) => {
      if (!r) return r
      const without = r.permissions.filter((p) => !catPerms.includes(p))
      return { ...r, permissions: allChecked ? without : [...without, ...catPerms] }
    })
  }

  const toggleExpandCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const handleSavePermissions = async () => {
    if (!selectedRole) return
    setSaving(true)
    try {
      await api.patch(`/settings/team-roles/${selectedRole.id}/`, {
        permissions: selectedRole.permissions,
      })
      setRoles((rs) => rs.map((r) => r.id === selectedRole.id ? { ...r, permissions: selectedRole.permissions } : r))
      toast.success('Permissions saved')
    } catch {
      toast.error('Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateRole = async () => {
    if (!newRoleName) { toast.error('Role name is required'); return }
    setCreating(true)
    try {
      const { data } = await api.post('/settings/team-roles/', { name: newRoleName, description: newRoleDesc, permissions: [] })
      const role = { ...data, id: String(data.id), permissions: data.permissions ?? [], member_count: 0, is_system: false }
      setRoles((rs) => [...rs, role])
      setSelectedRole(role)
      setCreateOpen(false)
      setNewRoleName('')
      setNewRoleDesc('')
      toast.success('Role created')
    } catch {
      toast.error('Failed to create role')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/settings/team-roles/${deleteTarget.id}/`)
      const updated = roles.filter((r) => r.id !== deleteTarget.id)
      setRoles(updated)
      if (selectedRole?.id === deleteTarget.id) {
        if (updated[0]) fetchRoleDetail(updated[0].id)
        else setSelectedRole(null)
      }
      setDeleteTarget(null)
      toast.success('Role deleted')
    } catch {
      toast.error('Failed to delete role')
    }
  }

  const handleSeedDefaults = async () => {
    setSeedingDefaults(true)
    try {
      const { data } = await api.post('/settings/team-roles/seed-defaults')
      toast.success(data.message || 'Default roles created')
      setSelectedRole(null)
      await fetchRoles()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create default roles')
    } finally {
      setSeedingDefaults(false)
    }
  }

  // Permission count for selected role
  const permissionCount = selectedRole?.permissions?.length ?? 0
  const totalPermissions = ALL_PERMISSIONS.length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roles & Permissions"
        breadcrumbs={[{ label: 'Team' }, { label: 'Roles & Permissions' }]}
        actions={
          <div className="flex items-center gap-2">
            {roles.length <= 1 && (
              <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={seedingDefaults} className="gap-1.5 h-9 text-[13px]">
                <Sparkles className="size-3.5" />
                {seedingDefaults ? 'Loading...' : 'Load Defaults'}
              </Button>
            )}
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5 rounded-lg font-semibold text-[13px] h-9 px-4 shadow-sm">
              <Plus className="size-3.5" />
              New Role
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-[280px_1fr] gap-5 min-h-[500px]">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 min-h-[500px]">

          {/* ── Role List ──────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            {roles.map((role) => {
              const isSelected = selectedRole?.id === role.id
              return (
                <button
                  key={role.id}
                  onClick={() => fetchRoleDetail(role.id)}
                  className={cn(
                    'w-full text-left rounded-xl p-4 transition-all border',
                    isSelected
                      ? 'bg-primary/5 border-primary/30 shadow-sm ring-1 ring-primary/20'
                      : 'bg-card border-border/40 hover:border-border/70 hover:shadow-sm'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'size-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      isSelected ? 'bg-primary/10' : 'bg-muted/60'
                    )}>
                      {role.is_system ? (
                        <Lock className={cn('size-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      ) : (
                        <Shield className={cn('size-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[13px] font-semibold truncate', isSelected && 'text-primary')}>
                          {role.name}
                        </span>
                        {role.is_system && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">System</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Users2 className="size-3" />
                          {role.member_count ?? 0} members
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <ShieldCheck className="size-3" />
                          {role.permissions?.length ?? 0} permissions
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}

            {roles.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/50 p-8 text-center">
                <Shield className="size-8 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-[13px] text-muted-foreground font-medium">No roles yet</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Create a role or load defaults</p>
              </div>
            )}
          </div>

          {/* ── Permissions Panel ──────────────────────────────── */}
          {selectedRole ? (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm flex flex-col">
              {/* Panel Header */}
              <div className="px-6 py-5 border-b border-border/30 bg-muted/10">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      {selectedRole.is_system ? (
                        <Lock className="size-5 text-primary" />
                      ) : (
                        <ShieldCheck className="size-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-[16px] font-semibold">{selectedRole.name}</h2>
                      {selectedRole.description && (
                        <p className="text-[12px] text-muted-foreground mt-0.5">{selectedRole.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[11px] h-5 gap-1">
                          <ShieldCheck className="size-3" />
                          {permissionCount}/{totalPermissions} permissions
                        </Badge>
                        <Badge variant="outline" className="text-[11px] h-5 gap-1">
                          <Users2 className="size-3" />
                          {selectedRole.member_count} members
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!selectedRole.is_system && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive h-8 text-[12px] gap-1"
                          onClick={() => setDeleteTarget(selectedRole)}
                        >
                          <Trash2 className="size-3" />
                          Delete
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-[12px] gap-1 shadow-sm"
                          onClick={handleSavePermissions}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                          Save Changes
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {selectedRole.is_system && (
                  <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                    <ShieldAlert className="size-4 text-amber-500 shrink-0" />
                    <span>System roles are managed automatically and cannot be modified.</span>
                  </div>
                )}
              </div>

              {/* Permission Categories */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-2">
                  {PERMISSION_CATEGORIES.map((category) => {
                    const catPerms = ALL_PERMISSIONS.filter((p) => p.category === category)
                    const checkedCount = catPerms.filter((p) => selectedRole.permissions.includes(p.key)).length
                    const allChecked = checkedCount === catPerms.length
                    const someChecked = checkedCount > 0 && !allChecked
                    const isExpanded = expandedCategories.has(category)
                    const CatIcon = CATEGORY_ICONS[category] ?? Shield
                    const catColor = CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground'

                    return (
                      <div key={category} className="rounded-lg border border-border/30 overflow-hidden">
                        {/* Category Header */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                          onClick={() => toggleExpandCategory(category)}
                        >
                          <div className={cn('size-7 rounded-md flex items-center justify-center shrink-0', catColor)}>
                            <CatIcon className="size-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-semibold">{category}</span>
                          </div>
                          {/* Category toggle */}
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {checkedCount}/{catPerms.length}
                            </span>
                            <Checkbox
                              checked={allChecked}
                              data-indeterminate={someChecked}
                              onCheckedChange={() => toggleCategory(category)}
                              disabled={selectedRole.is_system}
                              className={cn('size-4', someChecked && 'data-[state=checked]:bg-primary/50')}
                            />
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-muted-foreground/50" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground/50" />
                          )}
                        </div>

                        {/* Permission items */}
                        {isExpanded && (
                          <div className="divide-y divide-border/20">
                            {catPerms.map((perm) => {
                              const checked = selectedRole.permissions.includes(perm.key)
                              return (
                                <label
                                  key={perm.key}
                                  className={cn(
                                    'flex items-center gap-3 px-4 py-2.5 pl-14 cursor-pointer hover:bg-muted/20 transition-colors',
                                    selectedRole.is_system && 'cursor-not-allowed opacity-60'
                                  )}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => togglePermission(perm.key)}
                                    disabled={selectedRole.is_system}
                                    className="size-4"
                                  />
                                  <span className="text-[12px] font-medium flex-1">{perm.label}</span>
                                  {checked && (
                                    <Check className="size-3.5 text-primary" />
                                  )}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/40 flex flex-col items-center justify-center py-20 gap-3">
              <div className="size-16 rounded-2xl bg-muted/30 flex items-center justify-center">
                <Shield className="size-7 text-muted-foreground/30" />
              </div>
              <p className="text-[14px] font-medium text-muted-foreground">Select a role to manage permissions</p>
              <p className="text-[12px] text-muted-foreground/60">Choose a role from the left panel</p>
            </div>
          )}
        </div>
      )}

      {/* Create Role Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="size-4 text-primary" />
              </div>
              Create New Role
            </DialogTitle>
            <DialogDescription>
              Define a new role and then configure its permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium">Role Name *</Label>
              <Input
                placeholder="e.g. Sales Manager"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateRole()}
                className="h-10"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium">Description (optional)</Label>
              <Textarea
                placeholder="What can this role do?"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                className="resize-none text-[13px]"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreateRole} disabled={creating || !newRoleName.trim()} className="gap-1.5">
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-3.5" />}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        title={`Delete role "${deleteTarget?.name}"?`}
        description={deleteTarget?.member_count ? `This will affect ${deleteTarget.member_count} member(s). They will lose all permissions associated with this role.` : 'This action cannot be undone.'}
        onConfirm={handleDeleteRole}
      />
    </div>
  )
}
