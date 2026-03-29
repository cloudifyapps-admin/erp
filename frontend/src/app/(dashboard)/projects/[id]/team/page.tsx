'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Users, MoreHorizontal, Trash2 } from 'lucide-react'

interface TeamMember {
  id: string; user_id: string; user_name: string; email: string; role: string
  avatar_url: string; hours_logged: number; tasks_assigned: number; joined_at: string
}

interface Project { id: string; name: string }

function SectionHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {count !== undefined && <Badge variant="secondary" className="text-[11px] h-5 px-1.5">{count}</Badge>}
      </div>
      {action}
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-border/50">
      <Icon className="size-10 text-muted-foreground/30 mb-3" />
      <p className="text-[14px] font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-[12px] text-muted-foreground/60">{description}</p>
    </div>
  )
}

export default function TeamPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('member')

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchMembers = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/members`, { params: { page_size: 100 } })
      setMembers(normalizePaginated<TeamMember>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchMembers() }, [fetchProject, fetchMembers])

  const handleAddMember = async () => {
    if (!newMemberEmail) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${projectId}/members`, { email: newMemberEmail, role: newMemberRole })
      toast.success('Member added'); setShowAddMember(false); setNewMemberEmail(''); setNewMemberRole('member'); fetchMembers()
    } catch { toast.error('Failed to add member') } finally { setSubmitting(false) }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      await api.delete(`/projects/${projectId}/members/${memberId}`)
      toast.success('Member removed'); fetchMembers()
    } catch { toast.error('Failed to remove member') }
  }

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Team"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
        actions={
          <Button size="sm" className="h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm gap-1.5" onClick={() => setShowAddMember(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Member
          </Button>
        }
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        <SectionHeader title="Team Members" count={members.length} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.length === 0 && (
            <div className="col-span-full">
              <EmptyState icon={Users} title="No team members" description="Add team members to collaborate on this project." />
            </div>
          )}
          {members.map((m) => (
            <div key={m.id} className="rounded-lg border border-border/40 p-4 hover:bg-muted/10 transition-colors">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-[14px] font-semibold text-primary shrink-0">
                  {m.user_name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold truncate">{m.user_name}</span>
                    <Badge variant="secondary" className="text-[10px] capitalize">{m.role}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{m.tasks_assigned ?? 0} tasks</span>
                    <span>{m.hours_logged ?? 0}h logged</span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="size-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleRemoveMember(m.id)} className="text-red-600">
                      <Trash2 className="size-4 mr-2" />Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Add Team Member</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-[12px]">Email</Label>
              <Input value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} className="mt-1 h-9 text-[13px]" placeholder="user@company.com" />
            </div>
            <div>
              <Label className="text-[12px]">Role</Label>
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild><Button variant="outline" size="sm" className="h-9 text-[13px]">Cancel</Button></DialogClose>
            <Button size="sm" className="h-9 text-[13px]" onClick={handleAddMember} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
