'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { DeleteDialog } from '@/components/shared/delete-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Trash2, UserPlus, RotateCw, Mail, XCircle, Loader2,
  Search, X, Users2, Clock, Shield, MoreHorizontal, Send,
  Power, UserX, UserCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  full_name: string
  email: string
  role_name: string
  role_id: string
  status: string
  last_active: string
  joined_at: string
}

interface Invitation {
  id: string
  email: string
  status: string
  role_name: string
  invited_by: string
  expires_at: string
  created_at: string
}

interface Role {
  id: string
  name: string
}

type TabValue = 'members' | 'invitations'

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  'bg-pink-500/15 text-pink-700 dark:text-pink-400',
  'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function TeamMembersPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabValue>('members')
  const [search, setSearch] = useState('')

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')
  const [inviting, setInviting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [membersRes, rolesRes, invitationsRes] = await Promise.all([
        api.get('/settings/team-members', { params: { page_size: 200 } }),
        api.get('/settings/team-roles', { params: { page_size: 100 } }),
        api.get('/settings/team-invitations', { params: { page_size: 100 } }),
      ])
      setMembers(normalizePaginated<TeamMember>(membersRes.data).items)
      setRoles(normalizePaginated<Role>(rolesRes.data).items)
      setInvitations(normalizePaginated<Invitation>(invitationsRes.data).items)
    } catch {
      toast.error('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members
    const q = search.toLowerCase()
    return members.filter(
      (m) => m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.role_name?.toLowerCase().includes(q)
    )
  }, [members, search])

  const pendingInvitations = invitations.filter((i) => i.status === 'pending')

  const [togglingStatus, setTogglingStatus] = useState<string | null>(null)

  const handleRoleChange = async (memberId: string, roleId: string) => {
    setUpdatingRole(memberId)
    try {
      await api.patch(`/settings/team-members/${memberId}`, { role_id: roleId })
      setMembers((ms) => ms.map((m) =>
        m.id === memberId ? { ...m, role_id: roleId, role_name: roles.find((r) => r.id === roleId)?.name ?? m.role_name } : m
      ))
      toast.success('Role updated')
    } catch {
      toast.error('Failed to update role')
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleToggleStatus = async (member: TeamMember) => {
    const newActive = member.status !== 'active'
    setTogglingStatus(member.id)
    try {
      await api.patch(`/settings/team-members/${member.id}`, { is_active: newActive })
      setMembers((ms) => ms.map((m) =>
        m.id === member.id ? { ...m, status: newActive ? 'active' : 'inactive' } : m
      ))
      toast.success(newActive ? `${member.full_name} activated` : `${member.full_name} deactivated`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update status')
    } finally {
      setTogglingStatus(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/settings/team-members/${deleteTarget.id}/`)
      toast.success('Team member removed')
      setDeleteTarget(null)
      fetchData()
    } catch {
      toast.error('Failed to remove team member')
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error('Email is required'); return }
    setInviting(true)
    try {
      await api.post('/settings/team-invitations', {
        email: inviteEmail.trim(),
        role_id: inviteRoleId || null,
      })
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRoleId('')
      fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleResend = async (id: string) => {
    try {
      await api.post(`/settings/team-invitations/${id}/resend`)
      toast.success('Invitation resent')
    } catch {
      toast.error('Failed to resend invitation')
    }
  }

  const handleRevokeInvitation = async (id: string) => {
    try {
      await api.delete(`/settings/team-invitations/${id}`)
      toast.success('Invitation revoked')
      fetchData()
    } catch {
      toast.error('Failed to revoke invitation')
    }
  }

  // Stats
  const activeCount = members.filter((m) => m.status === 'active').length
  const roleBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    members.forEach((m) => map.set(m.role_name || 'No Role', (map.get(m.role_name || 'No Role') ?? 0) + 1))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [members])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team Members"
        breadcrumbs={[{ label: 'Team' }, { label: 'Members' }]}
        actions={
          <Button onClick={() => setInviteOpen(true)} className="gap-1.5 rounded-lg font-semibold text-[13px] h-9 px-4 shadow-sm">
            <UserPlus className="size-3.5" />
            Invite Member
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users2 className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{members.length}</p>
            <p className="text-[12px] text-muted-foreground">Total Members</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
          <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <UserCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{activeCount}</p>
            <p className="text-[12px] text-muted-foreground">Active Members</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
          <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Mail className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{pendingInvitations.length}</p>
            <p className="text-[12px] text-muted-foreground">Pending Invitations</p>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              'px-3.5 py-1.5 text-[13px] font-medium rounded-md transition-colors',
              activeTab === 'members' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Members
            <span className="ml-1.5 text-[11px] text-muted-foreground">{members.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={cn(
              'px-3.5 py-1.5 text-[13px] font-medium rounded-md transition-colors flex items-center gap-1.5',
              activeTab === 'invitations' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Invitations
            {pendingInvitations.length > 0 && (
              <span className="flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {pendingInvitations.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'members' && (
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-[13px]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-8 w-32" />
                </div>
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="size-14 rounded-full bg-muted/40 flex items-center justify-center">
                <Users2 className="size-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {search ? 'No members match your search' : 'No team members yet'}
              </p>
              {!search && (
                <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5 mt-1">
                  <UserPlus className="size-3.5" />
                  Invite your first team member
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredMembers.map((m) => (
                <div key={m.id} className={cn('flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group', m.status !== 'active' && 'opacity-60')}>
                  {/* Avatar */}
                  <Avatar>
                    <AvatarFallback className={cn('text-[13px] font-bold', getAvatarColor(m.full_name))}>
                      {getInitials(m.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + Email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold truncate">{m.full_name}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate">{m.email}</p>
                  </div>

                  {/* Role */}
                  <Select
                    value={m.role_id ?? ''}
                    onValueChange={(v) => handleRoleChange(m.id, v)}
                    disabled={updatingRole === m.id}
                  >
                    <SelectTrigger className="w-[150px] h-8 text-[12px] border-transparent bg-muted/30 hover:bg-muted/60 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <Shield className="size-3 text-muted-foreground/60" />
                        <SelectValue placeholder="Select role" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Joined date */}
                  <span className="text-[11px] text-muted-foreground/60 w-24 text-right hidden lg:block">
                    {m.joined_at ? format(new Date(m.joined_at), 'MMM d, yyyy') : '--'}
                  </span>

                  {/* Status Toggle */}
                  <button
                    onClick={() => handleToggleStatus(m)}
                    disabled={togglingStatus === m.id}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50',
                      m.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    )}
                    title={m.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
                  >
                    <span
                      className={cn(
                        'inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
                        m.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>

                  {/* Delete */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(m)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="size-14 rounded-full bg-muted/40 flex items-center justify-center">
                <Mail className="size-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No invitations sent yet</p>
              <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5 mt-1">
                <UserPlus className="size-3.5" />
                Send your first invitation
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {invitations.map((inv) => {
                const isPending = inv.status === 'pending'
                const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date()

                return (
                  <div key={inv.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group">
                    {/* Icon */}
                    <div className={cn(
                      'size-10 rounded-full flex items-center justify-center shrink-0',
                      isPending ? 'bg-amber-500/10' : inv.status === 'accepted' ? 'bg-emerald-500/10' : 'bg-muted'
                    )}>
                      <Mail className={cn(
                        'size-4',
                        isPending ? 'text-amber-600 dark:text-amber-400' : inv.status === 'accepted' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                      )} />
                    </div>

                    {/* Email + Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold truncate">{inv.email}</span>
                        <StatusBadge status={isExpired && isPending ? 'expired' : inv.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Invited by {inv.invited_by} &middot; {inv.created_at ? format(new Date(inv.created_at), 'MMM d, yyyy') : ''}
                      </p>
                    </div>

                    {/* Role */}
                    {inv.role_name && (
                      <Badge variant="secondary" className="text-[11px] h-5">
                        {inv.role_name}
                      </Badge>
                    )}

                    {/* Expires */}
                    <span className="text-[11px] text-muted-foreground/60 w-28 text-right hidden lg:block">
                      {isPending && inv.expires_at ? (
                        isExpired ? (
                          <span className="text-destructive">Expired</span>
                        ) : (
                          <>Expires {format(new Date(inv.expires_at), 'MMM d')}</>
                        )
                      ) : null}
                    </span>

                    {/* Actions */}
                    {isPending && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="size-8" title="Resend" onClick={() => handleResend(inv.id)}>
                          <RotateCw className="size-3.5 text-muted-foreground" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8" title="Revoke" onClick={() => handleRevokeInvitation(inv.id)}>
                          <XCircle className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Send className="size-4 text-primary" />
              </div>
              Invite Team Member
            </DialogTitle>
            <DialogDescription>
              Send an invitation email to add someone to your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email" className="text-[13px] font-medium">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-role" className="text-[13px] font-medium">Role (optional)</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger id="invite-role" className="h-10">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting} className="gap-1.5">
              {inviting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Remove "${deleteTarget?.full_name}" from the team?`}
        description="This will revoke their access to the organization. They can be re-invited later."
        onConfirm={handleDelete}
      />
    </div>
  )
}
