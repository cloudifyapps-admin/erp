'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'

interface ChangeRequest {
  id: string; title: string; description: string; status: string; priority: string
  requested_by: string; requested_by_name: string; approved_by: string; approved_by_name: string
  created_at: string; impact_description: string; impact_analysis: string
  cost_impact: number; budget_impact: number; schedule_impact: number; schedule_impact_days: number
}

interface Project { id: string; name: string; currency: string }

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

function formatCurrency(amount: number, currency: string = '$') {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

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

export default function ChangeRequestsPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [showAddCR, setShowAddCR] = useState(false)
  const [newCRTitle, setNewCRTitle] = useState('')
  const [newCRDesc, setNewCRDesc] = useState('')
  const [newCRPriority, setNewCRPriority] = useState('medium')

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchChangeRequests = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/change-requests`, { params: { page_size: 100 } })
      setChangeRequests(normalizePaginated<ChangeRequest>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchChangeRequests() }, [fetchProject, fetchChangeRequests])

  const handleAddCR = async () => {
    if (!newCRTitle) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${projectId}/change-requests`, { title: newCRTitle, description: newCRDesc, priority: newCRPriority })
      toast.success('Change request submitted'); setShowAddCR(false); setNewCRTitle(''); setNewCRDesc(''); fetchChangeRequests()
    } catch { toast.error('Failed to submit change request') } finally { setSubmitting(false) }
  }

  const handleApproveCR = async (crId: string) => {
    try {
      await api.patch(`/projects/${projectId}/change-requests/${crId}/approve`, { status: 'approved' })
      toast.success('Change request approved'); fetchChangeRequests()
    } catch { toast.error('Failed to approve') }
  }

  const handleRejectCR = async (crId: string) => {
    try {
      await api.patch(`/projects/${projectId}/change-requests/${crId}/approve`, { status: 'rejected' })
      toast.success('Change request rejected'); fetchChangeRequests()
    } catch { toast.error('Failed to reject') }
  }

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  const currency = project?.currency ?? '$'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Change Requests"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
        actions={
          <Button size="sm" className="h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm gap-1.5" onClick={() => setShowAddCR(true)}>
            <Plus className="h-3.5 w-3.5" />New Request
          </Button>
        }
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        <SectionHeader title="Change Requests" count={changeRequests.length} />
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Requested By</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cost Impact</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Schedule (days)</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {changeRequests.length === 0 && (
                <tr><td colSpan={8} className="text-center py-16 text-muted-foreground text-[13px]">No change requests.</td></tr>
              )}
              {changeRequests.map((cr) => (
                <tr key={cr.id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-medium">{cr.title}</div>
                    {(cr.impact_description || cr.impact_analysis) && <div className="text-[11px] text-muted-foreground/70 truncate max-w-xs mt-0.5">{cr.impact_description || cr.impact_analysis}</div>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md capitalize font-semibold ${PRIORITY_COLORS[cr.priority] ?? 'bg-gray-100 text-gray-600'}`}>{cr.priority}</span>
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={cr.status} /></td>
                  <td className="px-4 py-3.5 text-muted-foreground">{cr.requested_by_name ?? '---'}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{(cr.cost_impact || cr.budget_impact) ? formatCurrency(cr.cost_impact || cr.budget_impact, currency) : '---'}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{cr.schedule_impact ?? cr.schedule_impact_days ?? '---'}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{cr.created_at ? format(new Date(cr.created_at), 'MMM d, yyyy') : '---'}</td>
                  <td className="px-4 py-3.5 text-right">
                    {(cr.status === 'pending' || cr.status === 'submitted' || cr.status === 'under_review') && (
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="outline" size="sm" className="h-7 text-[11px] text-green-600" onClick={() => handleApproveCR(cr.id)}>Approve</Button>
                        <Button variant="outline" size="sm" className="h-7 text-[11px] text-red-600" onClick={() => handleRejectCR(cr.id)}>Reject</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showAddCR} onOpenChange={setShowAddCR}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">New Change Request</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-[12px]">Title</Label>
              <Input value={newCRTitle} onChange={(e) => setNewCRTitle(e.target.value)} className="mt-1 h-9 text-[13px]" placeholder="Change request title" />
            </div>
            <div>
              <Label className="text-[12px]">Priority</Label>
              <Select value={newCRPriority} onValueChange={setNewCRPriority}>
                <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px]">Description</Label>
              <Textarea value={newCRDesc} onChange={(e) => setNewCRDesc(e.target.value)} className="mt-1 text-[13px]" rows={3} placeholder="Describe the change and its impact..." />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild><Button variant="outline" size="sm" className="h-9 text-[13px]">Cancel</Button></DialogClose>
            <Button size="sm" className="h-9 text-[13px]" onClick={handleAddCR} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
