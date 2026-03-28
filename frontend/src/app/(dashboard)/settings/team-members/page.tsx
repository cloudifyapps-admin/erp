'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { DeleteDialog } from '@/components/shared/delete-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, UserPlus, RotateCw, Mail, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role_name: string;
  role_id: string;
  status: string;
  last_active: string;
  joined_at: string;
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  role_name: string;
  invited_by: string;
  expires_at: string;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
}

export default function TeamMembersPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviting, setInviting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, rolesRes, invitationsRes] = await Promise.all([
        api.get('/settings/team-members', { params: { page: pagination.page, page_size: pagination.pageSize, search } }),
        api.get('/settings/team-roles', { params: { page_size: 100 } }),
        api.get('/settings/team-invitations', { params: { page_size: 100 } }),
      ]);
      const normalizedMembers = normalizePaginated<TeamMember>(membersRes.data);
      setMembers(normalizedMembers.items);
      setPagination((p) => ({ ...p, total: normalizedMembers.total }));
      setRoles(normalizePaginated<Role>(rolesRes.data).items);
      setInvitations(normalizePaginated<Invitation>(invitationsRes.data).items);
    } catch {
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRoleChange = async (memberId: string, roleId: string) => {
    setUpdatingRole(memberId);
    try {
      await api.patch(`/settings/team-members/${memberId}/`, { role_id: roleId });
      setMembers((ms) => ms.map((m) => m.id === memberId ? { ...m, role_id: roleId, role_name: roles.find((r) => r.id === roleId)?.name ?? m.role_name } : m));
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/settings/team-members/${deleteTarget.id}/`);
      toast.success('Team member removed');
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Failed to remove team member');
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    setInviting(true);
    try {
      await api.post('/settings/team-invitations', {
        email: inviteEmail.trim(),
        role_id: inviteRoleId || null,
      });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRoleId('');
      fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(detail || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (id: string) => {
    try {
      await api.post(`/settings/team-invitations/${id}/resend`);
      toast.success('Invitation resent');
    } catch {
      toast.error('Failed to resend invitation');
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    try {
      await api.delete(`/settings/team-invitations/${id}`);
      toast.success('Invitation revoked');
      fetchData();
    } catch {
      toast.error('Failed to revoke invitation');
    }
  };

  const memberColumns = [
    {
      key: 'full_name',
      label: 'Member',
      render: (m: TeamMember) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
            {m.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-sm">{m.full_name}</div>
            <div className="text-xs text-muted-foreground">{m.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (m: TeamMember) => (
        <Select
          value={m.role_id ?? ''}
          onValueChange={(v) => handleRoleChange(m.id, v)}
          disabled={updatingRole === m.id}
        >
          <SelectTrigger className="w-40 h-7 text-xs"><SelectValue placeholder="Select role" /></SelectTrigger>
          <SelectContent>
            {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (m: TeamMember) => <StatusBadge status={m.status} />,
    },
    {
      key: 'joined_at',
      label: 'Joined',
      render: (m: TeamMember) => m.joined_at ? format(new Date(m.joined_at), 'MMM d, yyyy') : '—',
    },
    {
      key: 'actions',
      label: '',
      render: (m: TeamMember) => (
        <div className="flex justify-end">
          <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(m)}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');
  const pastInvitations = invitations.filter((i) => i.status !== 'pending');

  const invitationColumns = [
    {
      key: 'email',
      label: 'Email',
      render: (i: Invitation) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm shrink-0">
            <Mail className="size-4" />
          </div>
          <div>
            <div className="font-medium text-sm">{i.email}</div>
            <div className="text-xs text-muted-foreground">Invited by {i.invited_by}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role_name',
      label: 'Role',
      render: (i: Invitation) => <span className="text-sm">{i.role_name}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (i: Invitation) => <StatusBadge status={i.status} />,
    },
    {
      key: 'expires_at',
      label: 'Expires',
      render: (i: Invitation) => i.expires_at ? format(new Date(i.expires_at), 'MMM d, yyyy HH:mm') : '—',
    },
    {
      key: 'actions',
      label: '',
      render: (i: Invitation) =>
        i.status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <Button size="icon-sm" variant="ghost" title="Resend" onClick={() => handleResend(i.id)}>
              <RotateCw className="size-3.5" />
            </Button>
            <Button size="icon-sm" variant="ghost" title="Revoke" onClick={() => handleRevokeInvitation(i.id)}>
              <XCircle className="size-3.5 text-destructive" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Team Members"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Team Members' }]}
      />

      <Tabs defaultValue="members">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invitations">
              Invitations
              {pendingInvitations.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                  {pendingInvitations.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus /> Invite Member
          </Button>
        </div>

        <TabsContent value="members" className="mt-4">
          <DataTable
            columns={memberColumns}
            data={members}
            loading={loading}
            pagination={{ ...pagination, onPageChange: (p) => setPagination((prev) => ({ ...prev, page: p })) }}
            onSearch={(q) => { setSearch(q); setPagination((p) => ({ ...p, page: 1 })); }}
          />
        </TabsContent>

        <TabsContent value="invitations" className="mt-4">
          {invitations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No invitations sent yet. Click &quot;Invite Member&quot; to get started.
            </div>
          ) : (
            <DataTable
              columns={invitationColumns}
              data={invitations}
              loading={loading}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation email to add someone to your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Role (optional)</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger id="invite-role">
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
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting && <Loader2 className="mr-2 size-4 animate-spin" />}
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
  );
}
